import "server-only";
import type { CurrentUser } from "./auth";
import { UserFacingError } from "./actions";
import { db } from "./db";
import { jakartaDateKey } from "./format";
import { formatInvoiceNo } from "./invoice";
import { computeTotals, effectivePrice, PricingError } from "./pricing";
import { getOpenShift } from "./shift";
import { applyStockDelta } from "./stock";
import type { CheckoutInput } from "./validation";

export type CheckoutResult = { saleId: string; invoiceNo: string; total: number; change: number };

/** Dilempar bila total di layar kasir sudah tidak sesuai harga terbaru. */
export class PriceChangedError extends UserFacingError {
  constructor(readonly serverTotal: number) {
    super("Harga berubah sejak barang dimasukkan ke keranjang. Periksa total baru, lalu bayar lagi.");
  }
}

/**
 * Transaksi tunai: semua angka dihitung ulang di server dari harga di database.
 * Sale, item, pembayaran, nomor invoice, dan pengurangan stok terjadi dalam satu
 * transaksi database; bila satu gagal (mis. stok habis), semuanya batal.
 */
export async function checkoutCash(user: CurrentUser, input: CheckoutInput): Promise<CheckoutResult> {
  const shift = await getOpenShift(user.id);
  if (!shift) throw new UserFacingError("Buka shift dulu sebelum bertransaksi.");
  if (!shift.branch.isActive) throw new UserFacingError("Cabang ini sudah nonaktif.");

  const productIds = input.items.map((i) => i.productId);
  const stocks = await db.branchStock.findMany({
    where: { branchId: shift.branchId, productId: { in: productIds }, product: { isActive: true } },
    select: {
      productId: true,
      priceOverride: true,
      product: { select: { name: true, price: true, cost: true } },
    },
  });
  const byId = new Map(stocks.map((s) => [s.productId, s]));
  const missing = input.items.filter((i) => !byId.has(i.productId));
  if (missing.length > 0) {
    throw new UserFacingError("Ada produk di keranjang yang sudah tidak dijual. Hapus dari keranjang lalu coba lagi.");
  }

  const lines = input.items.map((i) => {
    const s = byId.get(i.productId)!;
    return {
      productId: i.productId,
      productName: s.product.name,
      unitCost: s.product.cost,
      unitPrice: effectivePrice(s.product.price, s.priceOverride),
      qty: i.qty,
      discount: i.discount,
    };
  });

  let totals;
  try {
    totals = computeTotals(lines, { taxRate: shift.branch.taxRate, transactionDiscount: input.transactionDiscount });
  } catch (err) {
    if (err instanceof PricingError) throw new UserFacingError(err.message);
    throw err;
  }
  if (totals.total !== input.expectedTotal) throw new PriceChangedError(totals.total);
  if (input.tendered < totals.total) throw new UserFacingError("Uang yang diterima kurang dari total belanja.");

  const now = new Date();
  const dateKey = jakartaDateKey(now);
  const change = input.tendered - totals.total;

  return db.$transaction(async (tx) => {
    // Nomor urut per cabang per hari. Baris counter terkunci sampai transaksi selesai,
    // jadi dua checkout bersamaan pasti mendapat nomor berbeda.
    const [{ lastSeq }] = await tx.$queryRaw<{ lastSeq: number }[]>`
      INSERT INTO "InvoiceCounter" ("branchId", "date", "lastSeq") VALUES (${shift.branchId}, ${dateKey}, 1)
      ON CONFLICT ("branchId", "date") DO UPDATE SET "lastSeq" = "InvoiceCounter"."lastSeq" + 1
      RETURNING "lastSeq"`;
    const invoiceNo = formatInvoiceNo(shift.branch.code, dateKey, lastSeq);

    const sale = await tx.sale.create({
      data: {
        invoiceNo,
        branchId: shift.branchId,
        shiftId: shift.id,
        cashierId: user.id,
        status: "COMPLETED",
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxRate: shift.branch.taxRate,
        taxTotal: totals.taxTotal,
        total: totals.total,
        createdAt: now,
        completedAt: now,
        items: {
          create: lines.map((l, i) => ({
            productId: l.productId,
            productName: l.productName,
            unitPrice: l.unitPrice,
            unitCost: l.unitCost,
            quantity: l.qty,
            discount: totals.lines[i].discount,
            lineTotal: totals.lines[i].lineTotal,
          })),
        },
        payments: {
          create: {
            method: "CASH",
            status: "PAID",
            provider: "cash",
            amount: totals.total,
            tendered: input.tendered,
            change,
            createdAt: now,
            paidAt: now,
          },
        },
      },
      select: { id: true },
    });

    // Urutan tetap (per productId) supaya dua checkout yang berisi produk sama
    // tidak saling menunggu dalam urutan terbalik (deadlock).
    for (const l of [...lines].sort((a, b) => a.productId.localeCompare(b.productId))) {
      await applyStockDelta(tx, {
        branchId: shift.branchId,
        productId: l.productId,
        delta: -l.qty,
        type: "SALE",
        refId: sale.id,
        userId: user.id,
      });
    }

    return { saleId: sale.id, invoiceNo, total: totals.total, change };
  });
}

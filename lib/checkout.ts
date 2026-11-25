import "server-only";
import type { Prisma, SaleStatus } from "@/generated/prisma/client";
import type { CurrentUser } from "./auth";
import { UserFacingError } from "./actions";
import { db } from "./db";
import { jakartaDateKey } from "./format";
import { formatInvoiceNo } from "./invoice";
import { computeTotals, effectivePrice, PricingError, type Totals } from "./pricing";
import { getOpenShift } from "./shift";
import { applyStockDelta } from "./stock";
import type { CartInput, CheckoutInput } from "./validation";

export type CheckoutResult = { saleId: string; invoiceNo: string; total: number; change: number };

/** Dilempar bila total di layar kasir sudah tidak sesuai harga terbaru. */
export class PriceChangedError extends UserFacingError {
  constructor(readonly serverTotal: number) {
    super("Harga berubah sejak barang dimasukkan ke keranjang. Periksa total baru, lalu bayar lagi.");
  }
}

type Shift = NonNullable<Awaited<ReturnType<typeof getOpenShift>>>;
type PricedLine = { productId: string; productName: string; unitCost: number; unitPrice: number; qty: number; discount: number };
type PricedCart = { shift: Shift; lines: PricedLine[]; totals: Totals };

/**
 * Validasi keranjang terhadap database: shift harus terbuka, produk masih dijual,
 * harga diambil dari server, dan total harus sama dengan yang dilihat kasir.
 */
async function priceCart(user: CurrentUser, input: CartInput): Promise<PricedCart> {
  const shift = await getOpenShift(user.id);
  if (!shift) throw new UserFacingError("Buka shift dulu sebelum bertransaksi.");
  if (!shift.branch.isActive) throw new UserFacingError("Cabang ini sudah nonaktif.");

  const pending = await db.sale.findFirst({
    where: { cashierId: user.id, shiftId: shift.id, status: "PENDING_PAYMENT" },
    select: { invoiceNo: true },
  });
  if (pending) {
    throw new UserFacingError(`Transaksi ${pending.invoiceNo} masih menunggu pembayaran. Selesaikan atau batalkan dulu.`);
  }

  const stocks = await db.branchStock.findMany({
    where: { branchId: shift.branchId, productId: { in: input.items.map((i) => i.productId) }, product: { isActive: true } },
    select: { productId: true, priceOverride: true, product: { select: { name: true, price: true, cost: true } } },
  });
  const byId = new Map(stocks.map((s) => [s.productId, s]));
  if (input.items.some((i) => !byId.has(i.productId))) {
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

  let totals: Totals;
  try {
    totals = computeTotals(lines, { taxRate: shift.branch.taxRate, transactionDiscount: input.transactionDiscount });
  } catch (err) {
    if (err instanceof PricingError) throw new UserFacingError(err.message);
    throw err;
  }
  if (totals.total !== input.expectedTotal) throw new PriceChangedError(totals.total);
  return { shift, lines, totals };
}

/**
 * Buat Sale beserta item dan nomor invoice, lalu kurangi stok. Stok selalu berkurang
 * saat transaksi dibuat, termasuk yang masih menunggu QRIS/kartu (stok "dipesan"),
 * dan dikembalikan bila transaksi dibatalkan. Harus dipanggil di dalam transaksi.
 */
async function createSale(
  tx: Prisma.TransactionClient,
  user: CurrentUser,
  { shift, lines, totals }: PricedCart,
  status: SaleStatus,
  now: Date,
  payments?: Prisma.PaymentCreateWithoutSaleInput[],
) {
  const dateKey = jakartaDateKey(now);
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
      status,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxRate: shift.branch.taxRate,
      taxTotal: totals.taxTotal,
      total: totals.total,
      createdAt: now,
      completedAt: status === "COMPLETED" ? now : null,
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
      ...(payments && { payments: { create: payments } }),
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
  return { saleId: sale.id, invoiceNo };
}

/** Transaksi tunai penuh: langsung selesai dalam satu transaksi database. */
export async function checkoutCash(user: CurrentUser, input: CheckoutInput): Promise<CheckoutResult> {
  const priced = await priceCart(user, input);
  const { total } = priced.totals;
  if (input.tendered < total) throw new UserFacingError("Uang yang diterima kurang dari total belanja.");
  const change = input.tendered - total;
  const now = new Date();

  return db.$transaction(async (tx) => {
    const { saleId, invoiceNo } = await createSale(tx, user, priced, "COMPLETED", now, [
      { method: "CASH", status: "PAID", provider: "cash", amount: total, tendered: input.tendered, change, createdAt: now, paidAt: now },
    ]);
    return { saleId, invoiceNo, total, change };
  });
}

/** Transaksi yang akan dibayar QRIS/kartu (atau kombinasi): dibuat dulu, stok dipesan. */
export async function createPendingSale(user: CurrentUser, input: CartInput) {
  const priced = await priceCart(user, input);
  return db.$transaction((tx) => createSale(tx, user, priced, "PENDING_PAYMENT", new Date()));
}

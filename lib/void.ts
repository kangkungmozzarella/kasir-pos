import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "./auth";
import { AuthError } from "./auth";
import { UserFacingError } from "./actions";
import { db } from "./db";
import { getPaymentProvider } from "./payments";
import { can } from "./permissions";
import { applyStockDelta } from "./stock";
import { voidBlocker } from "./void-rules";

export type VoidResult = {
  invoiceNo: string;
  /** Uang tunai yang harus dikembalikan kasir dari laci. */
  cashRefund: number;
  /** Pembayaran QRIS/kartu yang dikembalikan lewat provider. */
  providerRefund: number;
};

type Client = typeof db | Prisma.TransactionClient;

function loadForVoid(client: Client, saleId: string) {
  return client.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      invoiceNo: true,
      status: true,
      branchId: true,
      createdAt: true,
      shift: { select: { status: true } },
      payments: { select: { id: true, method: true, status: true, amount: true, providerRef: true } },
    },
  });
}

function assertAllowed(user: CurrentUser, sale: NonNullable<Awaited<ReturnType<typeof loadForVoid>>>) {
  if (!can(user.role, "sale:void")) throw new AuthError("Hanya admin atau pemilik yang bisa membatalkan transaksi.", 403);
  if (user.role === "ADMIN" && sale.branchId !== user.branchId) {
    throw new AuthError("Anda hanya bisa membatalkan transaksi di cabang sendiri.", 403);
  }
  const blocker = voidBlocker({ status: sale.status, createdAt: sale.createdAt, shiftStatus: sale.shift.status });
  if (blocker) throw new UserFacingError(blocker);
}

/**
 * Batalkan (void) transaksi: stok dikembalikan sebagai VOID_RETURN, pembayaran yang
 * sudah masuk ditandai REFUNDED, dan pembayaran yang masih menunggu dihentikan.
 * Bisa untuk transaksi selesai maupun yang macet menunggu pembayaran.
 *
 * Urutan: validasi, lalu pengembalian dana ke provider (di luar transaksi database,
 * idempoten per providerRef), lalu pencatatan di database dengan baris Sale terkunci.
 * Bila dua admin menekan void bersamaan, yang kedua ditolak setelah kunci dilepas.
 */
export async function voidSale(user: CurrentUser, saleId: string, reason: string, appUrl: string): Promise<VoidResult> {
  const sale = await loadForVoid(db, saleId);
  if (!sale) throw new UserFacingError("Transaksi tidak ditemukan.");
  assertAllowed(user, sale);

  const provider = getPaymentProvider(appUrl);
  const refunded = new Set<string>();
  for (const p of sale.payments) {
    if (p.status === "PAID" && p.method !== "CASH" && p.providerRef) {
      await provider.refund({ providerRef: p.providerRef, amount: p.amount });
      refunded.add(p.id);
    }
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${saleId} FOR UPDATE`;
    const locked = (await loadForVoid(tx, saleId))!;
    assertAllowed(user, locked);

    const now = new Date();
    const paid = locked.payments.filter((p) => p.status === "PAID");
    // QRIS yang dibayar tepat di antara langkah pengembalian dana dan kunci ini belum dikembalikan.
    if (paid.some((p) => p.method !== "CASH" && !refunded.has(p.id))) {
      throw new UserFacingError("Ada pembayaran yang baru saja masuk. Ulangi pembatalan.");
    }
    await tx.payment.updateMany({ where: { saleId, status: "PAID" }, data: { status: "REFUNDED", refundedAt: now } });
    await tx.payment.updateMany({ where: { saleId, status: "PENDING" }, data: { status: "EXPIRED" } });

    const items = await tx.saleItem.findMany({ where: { saleId }, select: { productId: true, quantity: true } });
    for (const item of items.sort((a, b) => a.productId.localeCompare(b.productId))) {
      await applyStockDelta(tx, {
        branchId: locked.branchId,
        productId: item.productId,
        delta: item.quantity,
        type: "VOID_RETURN",
        refId: saleId,
        note: `Void: ${reason}`,
        userId: user.id,
      });
    }
    await tx.sale.update({
      where: { id: saleId },
      data: { status: "VOIDED", voidReason: reason, voidedById: user.id, voidedAt: now },
    });

    const sum = (rows: typeof paid) => rows.reduce((s, p) => s + p.amount, 0);
    return {
      invoiceNo: locked.invoiceNo,
      cashRefund: sum(paid.filter((p) => p.method === "CASH")),
      providerRefund: sum(paid.filter((p) => p.method !== "CASH")),
    };
  });
}

import "server-only";
import type { Prisma, StockMovementType } from "@/generated/prisma/client";

/** Stok tidak cukup atau baris stok tidak ada. Pesannya aman ditampilkan. */
export class StockError extends Error {}

type Tx = Prisma.TransactionClient;

type Change = {
  branchId: string;
  productId: string;
  type: StockMovementType;
  refId?: string | null;
  note?: string | null;
  userId?: string | null;
};

/**
 * Tambah/kurangi stok secara atomik dan catat StockMovement. Harus dipanggil di dalam
 * `db.$transaction`. Pengecekan "stok tidak boleh minus" ada di klausa WHERE dari satu
 * perintah UPDATE, jadi dua kasir yang menjual barang terakhir bersamaan tidak bisa
 * sama-sama berhasil.
 */
export async function applyStockDelta(tx: Tx, change: Change & { delta: number }): Promise<number> {
  const { branchId, productId, delta } = change;
  if (!Number.isInteger(delta) || delta === 0) throw new Error(`Perubahan stok tidak valid: ${delta}`);

  const updated = await tx.branchStock.updateMany({
    where: { branchId, productId, ...(delta < 0 ? { quantity: { gte: -delta } } : {}) },
    data: { quantity: { increment: delta } },
  });
  if (updated.count === 0) {
    const row = await tx.branchStock.findUnique({
      where: { branchId_productId: { branchId, productId } },
      select: { quantity: true, product: { select: { name: true } } },
    });
    if (!row) throw new StockError("Produk ini belum terdaftar di stok cabang.");
    throw new StockError(`Stok ${row.product.name} tidak cukup (tersisa ${row.quantity}).`);
  }

  await recordMovement(tx, change, delta);
  const row = await tx.branchStock.findUniqueOrThrow({
    where: { branchId_productId: { branchId, productId } },
    select: { quantity: true },
  });
  return row.quantity;
}

/**
 * Stok opname: set stok ke hasil hitung fisik. Baris dikunci (FOR UPDATE) dulu supaya
 * selisih yang dicatat benar walau ada penjualan pada saat yang sama.
 * Mengembalikan selisih (positif = lebih, negatif = kurang). Selisih 0 tidak dicatat.
 */
export async function setStockCount(tx: Tx, change: Change & { counted: number }): Promise<number> {
  const { branchId, productId, counted } = change;
  const rows = await tx.$queryRaw<{ quantity: number }[]>`
    SELECT quantity FROM "BranchStock"
    WHERE "branchId" = ${branchId} AND "productId" = ${productId}
    FOR UPDATE`;
  if (rows.length === 0) throw new StockError("Produk ini belum terdaftar di stok cabang.");

  const delta = counted - rows[0].quantity;
  if (delta === 0) return 0;
  await tx.branchStock.update({
    where: { branchId_productId: { branchId, productId } },
    data: { quantity: counted },
  });
  await recordMovement(tx, change, delta);
  return delta;
}

function recordMovement(tx: Tx, change: Change, quantity: number) {
  return tx.stockMovement.create({
    data: {
      branchId: change.branchId,
      productId: change.productId,
      type: change.type,
      quantity,
      refId: change.refId ?? null,
      note: change.note ?? null,
      userId: change.userId ?? null,
    },
  });
}

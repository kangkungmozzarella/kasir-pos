import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "./auth";
import { AuthError } from "./auth";
import { UserFacingError } from "./actions";
import { db } from "./db";
import { jakartaDateKey } from "./format";
import { can } from "./permissions";
import { applyStockDelta } from "./stock";
import type { TransferInput } from "./validation";

type Tx = Prisma.TransactionClient;

/**
 * Transfer stok antar-cabang: DRAFT -> SENT -> RECEIVED (atau DRAFT -> CANCELLED).
 *
 * - Cabang asal membuat dan mengirim. Saat dikirim, stok asal berkurang (TRANSFER_OUT);
 *   barang dianggap "di jalan" dan tidak bisa dijual di mana pun.
 * - Cabang tujuan menerima. Saat diterima, stok tujuan bertambah (TRANSFER_IN).
 * - Admin hanya bisa bertindak atas nama cabangnya; Pemilik atas nama cabang mana pun.
 */

function assertManager(user: CurrentUser) {
  if (!can(user.role, "transfer:manage")) throw new AuthError("Hanya admin atau pemilik yang bisa mengelola transfer.", 403);
}

/** Admin hanya boleh bertindak untuk cabangnya sendiri. */
function assertBranch(user: CurrentUser, branchId: string, action: string) {
  assertManager(user);
  if (user.role === "ADMIN" && user.branchId !== branchId) {
    throw new AuthError(`Hanya admin cabang ${action} yang bisa melakukan ini.`, 403);
  }
}

/** "MDN01" + 26 Nov 2026 + 3 -> "TRF-MDN01-20261126-03". */
export function formatTransferNo(branchCode: string, dateKey: string, seq: number) {
  return `TRF-${branchCode}-${dateKey}-${String(seq).padStart(2, "0")}`;
}

async function validateInput(user: CurrentUser, input: TransferInput) {
  const fromBranchId = user.role === "OWNER" ? input.fromBranchId : user.branchId;
  if (!fromBranchId) throw new UserFacingError("Pilih cabang asal.");
  assertBranch(user, fromBranchId, "asal");
  if (fromBranchId === input.toBranchId) throw new UserFacingError("Cabang tujuan harus berbeda dengan cabang asal.");

  const branches = await db.branch.findMany({
    where: { id: { in: [fromBranchId, input.toBranchId] }, isActive: true },
    select: { id: true, code: true },
  });
  const from = branches.find((b) => b.id === fromBranchId);
  if (!from || !branches.some((b) => b.id === input.toBranchId)) throw new UserFacingError("Cabang tidak ditemukan atau sudah nonaktif.");

  const known = await db.branchStock.count({
    where: { branchId: fromBranchId, productId: { in: input.items.map((i) => i.productId) }, product: { isActive: true } },
  });
  if (known !== input.items.length) throw new UserFacingError("Ada produk yang tidak dijual di cabang asal.");
  return from;
}

export async function createTransfer(user: CurrentUser, input: TransferInput) {
  const from = await validateInput(user, input);
  const now = new Date();
  return db.$transaction(async (tx) => {
    const date = `TRF-${jakartaDateKey(now)}`;
    const [{ lastSeq }] = await tx.$queryRaw<{ lastSeq: number }[]>`
      INSERT INTO "InvoiceCounter" ("branchId", "date", "lastSeq") VALUES (${from.id}, ${date}, 1)
      ON CONFLICT ("branchId", "date") DO UPDATE SET "lastSeq" = "InvoiceCounter"."lastSeq" + 1
      RETURNING "lastSeq"`;
    return tx.stockTransfer.create({
      data: {
        transferNo: formatTransferNo(from.code, jakartaDateKey(now), lastSeq),
        fromBranchId: from.id,
        toBranchId: input.toBranchId,
        createdById: user.id,
        note: input.note,
        items: { create: input.items.map((i) => ({ productId: i.productId, quantity: i.qty })) },
      },
      select: { id: true, transferNo: true },
    });
  });
}

/** Kunci baris transfer supaya kirim/terima/batal untuk transfer yang sama berjalan bergantian. */
async function lockTransfer(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "StockTransfer" WHERE id = ${id} FOR UPDATE`;
  const t = await tx.stockTransfer.findUnique({
    where: { id },
    select: {
      id: true,
      transferNo: true,
      status: true,
      fromBranchId: true,
      toBranchId: true,
      items: { select: { productId: true, quantity: true }, orderBy: { productId: "asc" } },
    },
  });
  if (!t) throw new UserFacingError("Transfer tidak ditemukan.");
  return t;
}

export async function updateDraft(user: CurrentUser, id: string, input: TransferInput) {
  await validateInput(user, input);
  return db.$transaction(async (tx) => {
    const t = await lockTransfer(tx, id);
    assertBranch(user, t.fromBranchId, "asal");
    if (t.status !== "DRAFT") throw new UserFacingError("Hanya draf yang bisa diubah.");
    if ((user.role === "OWNER" ? input.fromBranchId : user.branchId) !== t.fromBranchId) {
      throw new UserFacingError("Cabang asal tidak bisa diubah. Batalkan draf ini dan buat transfer baru.");
    }
    await tx.stockTransferItem.deleteMany({ where: { transferId: id } });
    await tx.stockTransfer.update({
      where: { id },
      data: {
        toBranchId: input.toBranchId,
        note: input.note,
        items: { create: input.items.map((i) => ({ productId: i.productId, quantity: i.qty })) },
      },
    });
    return { transferNo: t.transferNo };
  });
}

/** Kirim: stok cabang asal berkurang. Satu produk kurang stok membatalkan seluruh pengiriman. */
export async function sendTransfer(user: CurrentUser, id: string) {
  return db.$transaction(async (tx) => {
    const t = await lockTransfer(tx, id);
    assertBranch(user, t.fromBranchId, "asal");
    if (t.status !== "DRAFT") throw new UserFacingError("Transfer ini sudah dikirim atau dibatalkan.");
    for (const item of t.items) {
      await applyStockDelta(tx, {
        branchId: t.fromBranchId,
        productId: item.productId,
        delta: -item.quantity,
        type: "TRANSFER_OUT",
        refId: t.id,
        note: t.transferNo,
        userId: user.id,
      });
    }
    await tx.stockTransfer.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), sentById: user.id } });
    return { transferNo: t.transferNo };
  });
}

/** Terima: stok cabang tujuan bertambah. Produk yang belum terdaftar di cabang tujuan dibuatkan barisnya. */
export async function receiveTransfer(user: CurrentUser, id: string) {
  return db.$transaction(async (tx) => {
    const t = await lockTransfer(tx, id);
    assertBranch(user, t.toBranchId, "tujuan");
    if (t.status !== "SENT") {
      throw new UserFacingError(t.status === "RECEIVED" ? "Transfer ini sudah diterima." : "Transfer ini belum dikirim.");
    }
    for (const item of t.items) {
      await tx.branchStock.upsert({
        where: { branchId_productId: { branchId: t.toBranchId, productId: item.productId } },
        create: { branchId: t.toBranchId, productId: item.productId, quantity: 0 },
        update: {},
      });
      await applyStockDelta(tx, {
        branchId: t.toBranchId,
        productId: item.productId,
        delta: item.quantity,
        type: "TRANSFER_IN",
        refId: t.id,
        note: t.transferNo,
        userId: user.id,
      });
    }
    await tx.stockTransfer.update({ where: { id }, data: { status: "RECEIVED", receivedAt: new Date(), receivedById: user.id } });
    return { transferNo: t.transferNo };
  });
}

/** Batalkan draf. Transfer yang sudah dikirim tidak bisa dibatalkan (barang sudah di jalan). */
export async function cancelTransfer(user: CurrentUser, id: string) {
  return db.$transaction(async (tx) => {
    const t = await lockTransfer(tx, id);
    assertBranch(user, t.fromBranchId, "asal");
    if (t.status !== "DRAFT") throw new UserFacingError("Hanya draf yang bisa dibatalkan.");
    await tx.stockTransfer.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    return { transferNo: t.transferNo };
  });
}

/** Siapa boleh melihat transfer: pemilik, atau admin cabang asal/tujuan. */
export function canSeeTransfer(user: CurrentUser, t: { fromBranchId: string; toBranchId: string }) {
  if (user.role === "OWNER") return true;
  return user.role === "ADMIN" && (user.branchId === t.fromBranchId || user.branchId === t.toBranchId);
}

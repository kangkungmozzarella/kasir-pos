import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentUser } from "./auth";
import { db } from "./db";
import { applyStockDelta } from "./stock";
import { cancelTransfer, createTransfer, receiveTransfer, sendTransfer, updateDraft } from "./transfer";

let mdn01: string;
let mdn02: string;
let admin01: CurrentUser;
let admin02: CurrentUser;
let owner: CurrentUser;
let kasir: CurrentUser;

const asUser = (u: { id: string; name: string; email: string; role: CurrentUser["role"]; branchId: string | null }): CurrentUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  branchId: u.branchId,
  branch: null,
});
const byEmail = (email: string) => db.user.findUniqueOrThrow({ where: { email } }).then(asUser);
const productId = (sku: string) => db.product.findUniqueOrThrow({ where: { sku } }).then((p) => p.id);
async function stockOf(branchId: string, pid: string) {
  return (await db.branchStock.findUniqueOrThrow({ where: { branchId_productId: { branchId, productId: pid } } })).quantity;
}
/** Set stok lewat PURCHASE/ADJUSTMENT yang tercatat, supaya audit tetap cocok. */
async function ensureStock(branchId: string, pid: string, min: number) {
  const q = await stockOf(branchId, pid);
  if (q < min) await db.$transaction((tx) => applyStockDelta(tx, { branchId, productId: pid, delta: min - q, type: "PURCHASE", note: "Persiapan test" }));
}

beforeAll(async () => {
  [mdn01, mdn02] = await Promise.all(["MDN01", "MDN02"].map((code) => db.branch.findUniqueOrThrow({ where: { code } }).then((b) => b.id)));
  [admin01, admin02, owner, kasir] = await Promise.all([
    byEmail("admin.mdn01@demo.test"),
    byEmail("admin.mdn02@demo.test"),
    byEmail("pemilik@demo.test"),
    byEmail("kasir1.mdn01@demo.test"),
  ]);
});

afterAll(() => db.$disconnect());

describe("transfer stok", () => {
  it("draf tidak mengubah stok; kirim mengurangi asal; terima menambah tujuan; tercatat di riwayat", async () => {
    const [a, b] = await Promise.all([productId("SKU-0030"), productId("SKU-0031")]);
    await ensureStock(mdn01, a, 20);
    await ensureStock(mdn01, b, 20);
    const before = { a1: await stockOf(mdn01, a), b1: await stockOf(mdn01, b), a2: await stockOf(mdn02, a), b2: await stockOf(mdn02, b) };

    const t = await createTransfer(admin01, {
      fromBranchId: null,
      toBranchId: mdn02,
      note: "Medan Baru kehabisan",
      items: [
        { productId: a, qty: 5 },
        { productId: b, qty: 3 },
      ],
    });
    expect(t.transferNo).toMatch(/^TRF-MDN01-\d{8}-\d{2}$/);
    expect(await stockOf(mdn01, a)).toBe(before.a1);

    // Admin cabang tujuan tidak bisa mengirim atas nama cabang asal.
    await expect(sendTransfer(admin02, t.id)).rejects.toThrow("cabang asal");
    await sendTransfer(admin01, t.id);
    expect(await stockOf(mdn01, a)).toBe(before.a1 - 5);
    expect(await stockOf(mdn01, b)).toBe(before.b1 - 3);
    expect(await stockOf(mdn02, a)).toBe(before.a2); // masih di jalan

    // Admin cabang asal tidak bisa "menerima" kirimannya sendiri.
    await expect(receiveTransfer(admin01, t.id)).rejects.toThrow("cabang tujuan");
    await receiveTransfer(admin02, t.id);
    expect(await stockOf(mdn02, a)).toBe(before.a2 + 5);
    expect(await stockOf(mdn02, b)).toBe(before.b2 + 3);

    const moves = await db.stockMovement.findMany({ where: { refId: t.id }, orderBy: { quantity: "asc" } });
    expect(moves.map((m) => [m.type, m.quantity])).toEqual([
      ["TRANSFER_OUT", -5],
      ["TRANSFER_OUT", -3],
      ["TRANSFER_IN", 3],
      ["TRANSFER_IN", 5],
    ]);
    await expect(receiveTransfer(admin02, t.id)).rejects.toThrow("sudah diterima");
    await expect(cancelTransfer(admin01, t.id)).rejects.toThrow("Hanya draf");
  });

  it("stok asal tidak cukup: seluruh pengiriman batal, tidak ada stok yang berkurang sebagian", async () => {
    const [a, b] = await Promise.all([productId("SKU-0032"), productId("SKU-0033")]);
    await ensureStock(mdn01, a, 10);
    const qa = await stockOf(mdn01, a);
    const qb = await stockOf(mdn01, b);
    const t = await createTransfer(admin01, {
      fromBranchId: null,
      toBranchId: mdn02,
      note: null,
      items: [
        { productId: a, qty: 1 },
        { productId: b, qty: qb + 1 },
      ],
    });
    await expect(sendTransfer(admin01, t.id)).rejects.toThrow("tidak cukup");
    expect(await stockOf(mdn01, a)).toBe(qa);
    expect((await db.stockTransfer.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("DRAFT");

    // Perbaiki jumlah di draf, lalu kirim.
    await updateDraft(admin01, t.id, { fromBranchId: null, toBranchId: mdn02, note: "Jumlah diperbaiki", items: [{ productId: a, qty: 1 }] });
    await sendTransfer(admin01, t.id);
    expect(await stockOf(mdn01, a)).toBe(qa - 1);
    expect(await stockOf(mdn01, b)).toBe(qb);
  });

  it("kirim serentak lima kali: stok berkurang sekali", async () => {
    const a = await productId("SKU-0034");
    await ensureStock(mdn02, a, 30);
    const before = await stockOf(mdn02, a);
    const t = await createTransfer(owner, { fromBranchId: mdn02, toBranchId: mdn01, note: null, items: [{ productId: a, qty: 4 }] });
    expect(t.transferNo).toMatch(/^TRF-MDN02-/);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => sendTransfer(owner, t.id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf(mdn02, a)).toBe(before - 4);
  });

  it("aturan: kasir ditolak, cabang asal = tujuan ditolak, draf bisa dibatalkan", async () => {
    const a = await productId("SKU-0035");
    const input = { fromBranchId: null, toBranchId: mdn02, note: null, items: [{ productId: a, qty: 1 }] };
    await expect(createTransfer(kasir, input)).rejects.toThrow("Hanya admin atau pemilik");
    await expect(createTransfer(admin01, { ...input, toBranchId: mdn01 })).rejects.toThrow("harus berbeda");
    // Admin tidak bisa mengaku sebagai cabang lain: fromBranchId dari klien diabaikan.
    const t = await createTransfer(admin01, { ...input, fromBranchId: mdn02 });
    expect((await db.stockTransfer.findUniqueOrThrow({ where: { id: t.id } })).fromBranchId).toBe(mdn01);
    await expect(cancelTransfer(admin02, t.id)).rejects.toThrow("cabang asal");
    await cancelTransfer(admin01, t.id);
    await expect(sendTransfer(admin01, t.id)).rejects.toThrow("sudah dikirim atau dibatalkan");
  });

  it("audit: jumlah semua pergerakan stok sama dengan stok di setiap cabang", async () => {
    const rows = await db.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "BranchStock" bs
      WHERE bs.quantity <> coalesce((SELECT sum(m.quantity) FROM "StockMovement" m
        WHERE m."branchId" = bs."branchId" AND m."productId" = bs."productId"), 0)`;
    expect(rows[0].n).toBe(0);
  });
});

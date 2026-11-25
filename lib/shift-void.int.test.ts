import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentUser } from "./auth";
import { checkoutCash, createPendingSale } from "./checkout";
import { db } from "./db";
import { computeTotals } from "./pricing";
import { applyWebhook, cancelPendingSale, payCashRemaining, startQris } from "./sale-flow";
import { closeShift, getShiftRecap, openShift } from "./shift";
import { voidSale } from "./void";

// Berkas ini memakai cabang MDN02 supaya tidak bercampur dengan shift yang dibuka sale-flow.int.test.ts.
const APP = "http://localhost:3000";
let branch: { id: string; taxRate: number };
let kasir: CurrentUser;
let kasir2: CurrentUser;
let admin: CurrentUser;
let adminLain: CurrentUser;
let owner: CurrentUser;

const asUser = (u: { id: string; name: string; email: string; role: CurrentUser["role"]; branchId: string | null }): CurrentUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  branchId: u.branchId,
  branch: null,
});

async function stockOf(productId: string) {
  return (await db.branchStock.findUniqueOrThrow({ where: { branchId_productId: { branchId: branch.id, productId } } })).quantity;
}
async function cart(sku: string, qty = 1) {
  const s = await db.branchStock.findFirstOrThrow({ where: { branchId: branch.id, product: { sku } }, include: { product: true } });
  const unitPrice = s.priceOverride ?? s.product.price;
  const total = computeTotals([{ unitPrice, qty }], { taxRate: branch.taxRate }).total;
  return { productId: s.productId, input: { items: [{ productId: s.productId, qty, discount: 0 }], transactionDiscount: 0, expectedTotal: total }, total };
}
async function payQris(user: CurrentUser, saleId: string, amount: number) {
  const state = await startQris(user, saleId, amount, APP);
  const ref = (await db.payment.findUniqueOrThrow({ where: { id: state.active!.id } })).providerRef!;
  await applyWebhook({ providerRef: ref, status: "PAID" });
}

beforeAll(async () => {
  branch = await db.branch.findUniqueOrThrow({ where: { code: "MDN02" }, select: { id: true, taxRate: true } });
  const byEmail = (email: string) => db.user.findUniqueOrThrow({ where: { email } }).then(asUser);
  [kasir, kasir2, admin, adminLain, owner] = await Promise.all([
    byEmail("kasir1.mdn02@demo.test"),
    byEmail("kasir2.mdn02@demo.test"),
    byEmail("admin.mdn02@demo.test"),
    byEmail("admin.mdn01@demo.test"),
    byEmail("pemilik@demo.test"),
  ]);
});

afterAll(() => db.$disconnect());

describe("tutup shift", () => {
  it("kas diharapkan = modal + tunai bersih; QRIS/kartu tidak dihitung; selisih tercatat", async () => {
    const shift = await openShift(kasir, { openingCash: 200_000, branchId: null });

    const a = await cart("SKU-0010");
    await checkoutCash(kasir, { ...a.input, tendered: a.total + 7_000 }); // ada kembalian

    const b = await cart("SKU-0004"); // kombinasi: 20.000 QRIS + sisanya tunai
    const { saleId: splitId } = await createPendingSale(kasir, b.input);
    await payQris(kasir, splitId, 20_000);
    await payCashRemaining(kasir, splitId, 100_000);

    const c = await cart("SKU-0005"); // lunas QRIS
    const { saleId: qrisId } = await createPendingSale(kasir, c.input);
    await payQris(kasir, qrisId, c.total);

    const cash = a.total + (b.total - 20_000);
    const recap = (await getShiftRecap(kasir, shift.id))!;
    expect(recap.status).toBe("OPEN");
    expect(recap.salesCount).toBe(3);
    expect(recap.revenue).toBe(a.total + b.total + c.total);
    expect(recap.methods.CASH.amount).toBe(cash);
    expect(recap.methods.QRIS.amount).toBe(20_000 + c.total);
    expect(recap.expected).toBe(200_000 + cash);

    // Transaksi yang masih menunggu pembayaran menahan tutup shift.
    const d = await cart("SKU-0006");
    const { saleId: pendingId, invoiceNo } = await createPendingSale(kasir, d.input);
    await expect(closeShift(kasir, { countedCash: 0, note: null })).rejects.toThrow(`Transaksi ${invoiceNo} masih menunggu pembayaran`);
    await cancelPendingSale(kasir, pendingId);

    const closed = await closeShift(kasir, { countedCash: 200_000 + cash - 2_000, note: "Kurang uang receh" });
    expect(closed.difference).toEqual({ amount: -2_000, kind: "kurang" });

    const after = (await getShiftRecap(kasir, shift.id))!;
    expect(after.status).toBe("CLOSED");
    expect(after.expectedCash).toBe(200_000 + cash);
    expect(after.countedCash).toBe(200_000 + cash - 2_000);
    expect(after.voided.map((v) => v.invoiceNo)).toEqual([invoiceNo]);

    await expect(checkoutCash(kasir, { ...a.input, tendered: a.total })).rejects.toThrow("Buka shift dulu");
    await expect(closeShift(kasir, { countedCash: 0, note: null })).rejects.toThrow("Tidak ada shift yang sedang terbuka");
  });

  it("checkout yang berjalan bersamaan dengan tutup shift: tidak ada transaksi yang tercecer di luar rekap", async () => {
    const shift = await openShift(kasir2, { openingCash: 0, branchId: null });
    const a = await cart("SKU-0012");
    const results = await Promise.allSettled([
      ...Array.from({ length: 6 }, () => checkoutCash(kasir2, { ...a.input, tendered: a.total })),
      closeShift(kasir2, { countedCash: 0, note: null }),
      ...Array.from({ length: 6 }, () => checkoutCash(kasir2, { ...a.input, tendered: a.total })),
    ]);
    expect(results[6].status).toBe("fulfilled"); // tutup shift selalu berhasil

    const recap = (await getShiftRecap(kasir2, shift.id))!;
    const okSales = results.filter((r, i) => i !== 6 && r.status === "fulfilled").length;
    expect(recap.salesCount).toBe(okSales);
    expect(recap.expectedCash).toBe(okSales * a.total);
    expect(await db.sale.count({ where: { shiftId: shift.id } })).toBe(okSales);
  });
});

describe("void", () => {
  let shiftId: string;

  beforeAll(async () => {
    shiftId = (await openShift(kasir, { openingCash: 100_000, branchId: null })).id;
  });

  it("void transaksi tunai: stok kembali (VOID_RETURN), pembayaran REFUNDED, kas diharapkan turun", async () => {
    const { productId, input, total } = await cart("SKU-0020", 3);
    const before = await stockOf(productId);
    const { saleId } = await checkoutCash(kasir, { ...input, tendered: total });
    const expectedBefore = (await getShiftRecap(kasir, shiftId))!.expected;

    const result = await voidSale(admin, saleId, "Salah input jumlah", APP);
    expect(result).toMatchObject({ cashRefund: total, providerRefund: 0 });
    expect(await stockOf(productId)).toBe(before);

    const sale = await db.sale.findUniqueOrThrow({ where: { id: saleId }, include: { payments: true } });
    expect(sale.status).toBe("VOIDED");
    expect(sale.voidReason).toBe("Salah input jumlah");
    expect(sale.voidedById).toBe(admin.id);
    expect(sale.payments.every((p) => p.status === "REFUNDED" && p.refundedAt)).toBe(true);
    const back = await db.stockMovement.findMany({ where: { refId: saleId, type: "VOID_RETURN" } });
    expect(back.map((m) => m.quantity)).toEqual([3]);

    expect((await getShiftRecap(kasir, shiftId))!.expected).toBe(expectedBefore - total);
    await expect(voidSale(admin, saleId, "Ulang", APP)).rejects.toThrow("sudah dibatalkan");
  });

  it("void transaksi QRIS: dana dikembalikan lewat provider", async () => {
    const { input, total } = await cart("SKU-0021");
    const { saleId } = await createPendingSale(kasir, input);
    await payQris(kasir, saleId, total);
    const result = await voidSale(owner, saleId, "Pembeli membatalkan", APP);
    expect(result).toMatchObject({ cashRefund: 0, providerRefund: total });
  });

  it("transaksi yang macet sebagian lunas bisa di-void admin: QR yang menunggu dihentikan", async () => {
    const { productId, input, total } = await cart("SKU-0022");
    const before = await stockOf(productId);
    const { saleId } = await createPendingSale(kasir, input);
    const half = Math.floor(total / 2);
    await payQris(kasir, saleId, half);
    await startQris(kasir, saleId, total - half, APP); // QR kedua masih menunggu

    const result = await voidSale(admin, saleId, "Pembeli pergi sebelum lunas", APP);
    expect(result.providerRefund).toBe(half);
    expect(await stockOf(productId)).toBe(before);
    const statuses = (await db.payment.findMany({ where: { saleId }, orderBy: { createdAt: "asc" } })).map((p) => p.status);
    expect(statuses).toEqual(["REFUNDED", "EXPIRED"]);
  });

  it("dua void bersamaan: hanya satu berhasil, stok kembali sekali", async () => {
    const { productId, input, total } = await cart("SKU-0023", 2);
    const before = await stockOf(productId);
    const { saleId } = await checkoutCash(kasir, { ...input, tendered: total });
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => voidSale(admin, saleId, "Klik ganda", APP)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf(productId)).toBe(before);
  });

  it("kasir dan admin cabang lain tidak bisa void; transaksi lama di shift tertutup ditolak", async () => {
    const { input, total } = await cart("SKU-0024");
    const { saleId } = await checkoutCash(kasir, { ...input, tendered: total });
    await expect(voidSale(kasir, saleId, "Coba coba", APP)).rejects.toThrow("Hanya admin atau pemilik");
    await expect(voidSale(adminLain, saleId, "Coba coba", APP)).rejects.toThrow("cabang sendiri");

    const old = await db.sale.findFirstOrThrow({
      where: { branchId: branch.id, status: "COMPLETED", shift: { status: "CLOSED" }, createdAt: { lt: new Date(Date.now() - 2 * 86_400_000) } },
    });
    await expect(voidSale(owner, old.id, "Terlambat", APP)).rejects.toThrow("hari sebelumnya");
  });
});

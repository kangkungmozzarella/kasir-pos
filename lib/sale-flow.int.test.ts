import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentUser } from "./auth";
import { checkoutCash, createPendingSale } from "./checkout";
import { db } from "./db";
import { computeTotals } from "./pricing";
import {
  applyWebhook,
  cancelActivePayment,
  cancelPendingSale,
  getSaleState,
  payByCard,
  payCashRemaining,
  startQris,
} from "./sale-flow";
import { applyStockDelta, StockError } from "./stock";

const APP = "http://localhost:3000";
let branch: { id: string; taxRate: number };
let cashiers: CurrentUser[];

async function product(sku: string) {
  return db.branchStock.findFirstOrThrow({ where: { branchId: branch.id, product: { sku } }, include: { product: true } });
}
async function stockOf(productId: string) {
  return (await db.branchStock.findUniqueOrThrow({ where: { branchId_productId: { branchId: branch.id, productId } } })).quantity;
}
/** Keranjang 1 produk. Stok diisi dulu lewat PURCHASE supaya test tidak bergantung pada stok acak dari seed. */
async function cart(sku: string, qty = 1) {
  const s = await product(sku);
  if (s.quantity < 50) {
    await db.$transaction((tx) => applyStockDelta(tx, { branchId: branch.id, productId: s.productId, delta: 100, type: "PURCHASE", note: "Persiapan test" }));
  }
  const unitPrice = s.priceOverride ?? s.product.price;
  const total = computeTotals([{ unitPrice, qty }], { taxRate: branch.taxRate }).total;
  return { productId: s.productId, input: { items: [{ productId: s.productId, qty, discount: 0 }], transactionDiscount: 0, expectedTotal: total }, total };
}

beforeAll(async () => {
  branch = await db.branch.findUniqueOrThrow({ where: { code: "MDN01" }, select: { id: true, taxRate: true } });
  const users = await db.user.findMany({ where: { branchId: branch.id, role: "CASHIER" }, orderBy: { email: "asc" } });
  cashiers = users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, branchId: u.branchId, branch: null }));
  for (const c of cashiers) {
    await db.shift.create({ data: { branchId: branch.id, cashierId: c.id, openingCash: 0 } });
  }
});

afterAll(() => db.$disconnect());

describe("stok", () => {
  it("20 pengurangan serentak atas stok 5: tepat 5 berhasil, stok tidak minus", async () => {
    const s = await product("SKU-0001");
    await db.branchStock.update({ where: { id: s.id }, data: { quantity: 5 } });
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        db.$transaction((tx) => applyStockDelta(tx, { branchId: branch.id, productId: s.productId, delta: -1, type: "SALE" })),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason instanceof StockError)).toBe(true);
    expect(await stockOf(s.productId)).toBe(0);
  });
});

describe("checkout tunai", () => {
  it("15 checkout serentak dari dua kasir: nomor invoice unik tanpa lompatan, stok berkurang tepat", async () => {
    const { productId, input, total } = await cart("SKU-0027");
    const before = await stockOf(productId);
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, i) => checkoutCash(cashiers[i % 2], { ...input, tendered: total })),
    );
    const seqs = results.map((r) => Number(r.invoiceNo.slice(-4))).sort((a, b) => a - b);
    expect(new Set(results.map((r) => r.invoiceNo)).size).toBe(15);
    expect(seqs.at(-1)! - seqs[0]).toBe(14);
    expect(await stockOf(productId)).toBe(before - 15);
  });
});

describe("transaksi QRIS, kartu, dan kombinasi", () => {
  const kasir = () => cashiers[0];

  it("stok dipesan saat transaksi dibuat; QRIS lunas lewat webhook; webhook ganda tidak berefek", async () => {
    const { productId, input, total } = await cart("SKU-0003", 2);
    const before = await stockOf(productId);

    const { saleId } = await createPendingSale(kasir(), input);
    expect(await stockOf(productId)).toBe(before - 2); // dipesan

    const state = await startQris(kasir(), saleId, total, APP);
    const qr = state.active!;
    expect(qr.method).toBe("QRIS");
    expect(qr.qrString).toMatch(/^http:\/\/localhost:3000\/simulator\/pay\/MOCK-QR-/);
    const ref = (await db.payment.findUniqueOrThrow({ where: { id: qr.id } })).providerRef!;

    expect(await applyWebhook({ providerRef: ref, status: "PAID" })).toBe("applied");
    expect(await applyWebhook({ providerRef: ref, status: "PAID" })).toBe("duplicate");
    expect(await applyWebhook({ providerRef: "MOCK-QR-tidak-ada", status: "PAID" })).toBe("unknown");

    const done = await getSaleState(saleId, kasir());
    expect(done?.status).toBe("COMPLETED");
    expect(done?.paid).toBe(total);
    expect(await stockOf(productId)).toBe(before - 2); // tidak berkurang dua kali
    const moves = await db.stockMovement.count({ where: { refId: saleId } });
    expect(moves).toBe(1);
  });

  it("kombinasi: sebagian QRIS, sisanya tunai dengan kembalian", async () => {
    const { input, total } = await cart("SKU-0004"); // 38.000 + PPN = 42.180
    const { saleId } = await createPendingSale(kasir(), input);
    const s1 = await startQris(kasir(), saleId, 20_000, APP);
    expect(s1.remaining).toBe(total - 20_000);
    const ref = (await db.payment.findUniqueOrThrow({ where: { id: s1.active!.id } })).providerRef!;
    await applyWebhook({ providerRef: ref, status: "PAID" });

    const s2 = await getSaleState(saleId, kasir());
    expect(s2?.status).toBe("PENDING_PAYMENT");
    expect(s2?.remaining).toBe(total - 20_000);

    const s3 = await payCashRemaining(kasir(), saleId, 50_000);
    expect(s3.status).toBe("COMPLETED");
    expect(s3.change).toBe(50_000 - (total - 20_000));
    expect(s3.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0)).toBe(total);
  });

  it("kartu dengan nominal berakhiran 13 ditolak; kartu berikutnya disetujui dan melunasi", async () => {
    const { input, total } = await cart("SKU-0005");
    const { saleId } = await createPendingSale(kasir(), input);

    const declined = await payByCard(kasir(), saleId, 1_013, APP);
    expect(declined.declined).toMatch(/ditolak/);
    expect(declined.state.remaining).toBe(total);

    const ok = await payByCard(kasir(), saleId, total, APP);
    expect(ok.declined).toBeNull();
    expect(ok.state.status).toBe("COMPLETED");
    const card = ok.state.payments.find((p) => p.status === "PAID")!;
    expect(card.cardLast4).toMatch(/^\d{4}$/);
    expect(card.approvalCode).toMatch(/^\d{6}$/);
  });

  it("nominal melebihi sisa tagihan ditolak, dan hanya satu pembayaran menunggu dalam satu waktu", async () => {
    const { input, total } = await cart("SKU-0006");
    const { saleId } = await createPendingSale(kasir(), input);
    await expect(startQris(kasir(), saleId, total + 1, APP)).rejects.toThrow(/melebihi sisa tagihan/);
    await startQris(kasir(), saleId, 1_000, APP);
    await expect(startQris(kasir(), saleId, 1_000, APP)).rejects.toThrow(/masih ada pembayaran yang menunggu/i);
    await expect(payCashRemaining(kasir(), saleId, total)).rejects.toThrow(/menunggu/);
    await cancelActivePayment(kasir(), saleId);
    await cancelPendingSale(kasir(), saleId);
  });

  it("QR kedaluwarsa: webhook terlambat diabaikan, transaksi tetap menunggu", async () => {
    const { input, total } = await cart("SKU-0007");
    const { saleId } = await createPendingSale(kasir(), input);
    const s = await startQris(kasir(), saleId, total, APP);
    const p = await db.payment.update({ where: { id: s.active!.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    expect(await applyWebhook({ providerRef: p.providerRef!, status: "PAID" })).toBe("expired");
    const after = await getSaleState(saleId, kasir());
    expect(after?.status).toBe("PENDING_PAYMENT");
    expect(after?.active).toBeNull();
    expect(after?.remaining).toBe(total);
    await cancelPendingSale(kasir(), saleId);
  });

  it("batal sebelum lunas mengembalikan stok; tidak bisa dibatalkan kasir bila sudah ada pembayaran", async () => {
    const { productId, input, total } = await cart("SKU-0008", 3);
    const before = await stockOf(productId);
    const { saleId } = await createPendingSale(kasir(), input);
    expect(await stockOf(productId)).toBe(before - 3);
    await cancelPendingSale(kasir(), saleId);
    expect(await stockOf(productId)).toBe(before);
    const sale = await db.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(sale.status).toBe("VOIDED");
    expect(await db.stockMovement.count({ where: { refId: saleId, type: "VOID_RETURN" } })).toBe(1);

    const second = await createPendingSale(kasir(), input);
    const card = await payByCard(kasir(), second.saleId, 1_000, APP);
    expect(card.state.paid).toBe(1_000);
    await expect(cancelPendingSale(kasir(), second.saleId)).rejects.toThrow(/Sudah ada pembayaran/);
    await payCashRemaining(kasir(), second.saleId, total);
  });

  it("kasir tidak bisa membuka transaksi baru selama ada yang menunggu pembayaran", async () => {
    const { input, total } = await cart("SKU-0011");
    const { saleId, invoiceNo } = await createPendingSale(kasir(), input);
    await expect(checkoutCash(kasir(), { ...input, tendered: total })).rejects.toThrow(invoiceNo);
    await cancelPendingSale(kasir(), saleId);
  });

  it("kasir lain tidak bisa membayar atau membatalkan transaksi milik kasir ini", async () => {
    const { input } = await cart("SKU-0010");
    const { saleId } = await createPendingSale(kasir(), input);
    await expect(startQris(cashiers[1], saleId, 1_000, APP)).rejects.toThrow(/bukan milik Anda/);
    await expect(cancelPendingSale(cashiers[1], saleId)).rejects.toThrow(/bukan milik Anda/);
    expect(await getSaleState(saleId, cashiers[1])).toBeNull();
    await cancelPendingSale(kasir(), saleId);
  });
});

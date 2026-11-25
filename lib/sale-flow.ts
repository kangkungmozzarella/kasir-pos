import "server-only";
import type { PaymentMethod, PaymentStatus, Prisma, SaleStatus } from "@/generated/prisma/client";
import type { CurrentUser } from "./auth";
import { UserFacingError } from "./actions";
import { db } from "./db";
import { formatRupiah } from "./format";
import { getPaymentProvider } from "./payments";
import type { WebhookStatus } from "./payments/provider";
import { applyStockDelta } from "./stock";

type Tx = Prisma.TransactionClient;

/** Batas waktu menunggu terminal EDC; pembayaran kartu yang tertahan lebih lama dianggap gagal. */
const CARD_TIMEOUT_MS = 60_000;

export type PaymentView = {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  tendered: number | null;
  change: number | null;
  qrString: string | null;
  expiresAt: Date | null;
  cardLast4: string | null;
  approvalCode: string | null;
};

export type SaleState = {
  saleId: string;
  invoiceNo: string;
  status: SaleStatus;
  total: number;
  paid: number;
  /** Total dikurangi pembayaran yang sudah masuk dan yang sedang menunggu. */
  remaining: number;
  payments: PaymentView[];
  /** Pembayaran yang sedang menunggu (QRIS/kartu); maksimal satu. */
  active: PaymentView | null;
};

const paymentSelect = {
  id: true,
  method: true,
  status: true,
  amount: true,
  tendered: true,
  change: true,
  qrString: true,
  expiresAt: true,
  cardLast4: true,
  approvalCode: true,
} as const;

/** Tandai pembayaran yang sudah lewat masa berlakunya. Dipanggil sebelum membaca status. */
async function expireStale(client: Tx | typeof db, saleId: string) {
  await client.payment.updateMany({
    where: { saleId, status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
}

function toState(sale: {
  id: string;
  invoiceNo: string;
  status: SaleStatus;
  total: number;
  payments: PaymentView[];
}): SaleState {
  const paid = sale.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  const active = sale.payments.find((p) => p.status === "PENDING") ?? null;
  return {
    saleId: sale.id,
    invoiceNo: sale.invoiceNo,
    status: sale.status,
    total: sale.total,
    paid,
    remaining: sale.total - paid - (active?.amount ?? 0),
    payments: sale.payments,
    active,
  };
}

export async function getSaleState(saleId: string, user: CurrentUser): Promise<SaleState | null> {
  await expireStale(db, saleId);
  const sale = await db.sale.findFirst({
    where: { id: saleId, cashierId: user.id },
    select: { id: true, invoiceNo: true, status: true, total: true, payments: { select: paymentSelect, orderBy: { createdAt: "asc" } } },
  });
  return sale ? toState(sale) : null;
}

/** Transaksi menunggu pembayaran milik kasir ini di shift yang terbuka (untuk melanjutkan setelah reload). */
export async function findPendingSale(user: CurrentUser) {
  const sale = await db.sale.findFirst({
    where: { cashierId: user.id, status: "PENDING_PAYMENT", shift: { status: "OPEN" } },
    select: { id: true, items: { select: { productId: true, quantity: true, discount: true } }, discountTotal: true },
  });
  if (!sale) return null;
  const state = await getSaleState(sale.id, user);
  return state && { state, items: sale.items, transactionDiscount: sale.discountTotal };
}

/**
 * Kunci baris Sale (FOR UPDATE) supaya pembayaran, webhook, dan pembatalan untuk
 * transaksi yang sama berjalan bergantian, bukan bersamaan.
 */
async function lockSale(tx: Tx, saleId: string) {
  await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${saleId} FOR UPDATE`;
  await expireStale(tx, saleId);
  const sale = await tx.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      invoiceNo: true,
      status: true,
      total: true,
      cashierId: true,
      branchId: true,
      shift: { select: { status: true } },
      payments: { select: paymentSelect, orderBy: { createdAt: "asc" } },
    },
  });
  if (!sale) throw new UserFacingError("Transaksi tidak ditemukan.");
  return sale;
}

/** Kunci transaksi milik kasir ini yang masih menunggu pembayaran. */
async function lockOwnPending(tx: Tx, saleId: string, user: CurrentUser) {
  const sale = await lockSale(tx, saleId);
  if (sale.cashierId !== user.id) throw new UserFacingError("Transaksi ini bukan milik Anda.");
  if (sale.status !== "PENDING_PAYMENT") throw new UserFacingError("Transaksi ini sudah tidak menunggu pembayaran.");
  if (sale.shift.status !== "OPEN") throw new UserFacingError("Shift transaksi ini sudah ditutup.");
  return sale;
}

/** Selesaikan transaksi bila jumlah pembayaran yang masuk sudah sama dengan total. */
async function completeIfPaid(tx: Tx, saleId: string) {
  const sale = await tx.sale.findUniqueOrThrow({
    where: { id: saleId },
    select: { status: true, total: true, payments: { where: { status: "PAID" }, select: { amount: true } } },
  });
  const paid = sale.payments.reduce((s, p) => s + p.amount, 0);
  if (sale.status === "PENDING_PAYMENT" && paid === sale.total) {
    await tx.sale.update({ where: { id: saleId }, data: { status: "COMPLETED", completedAt: new Date() } });
  }
}

async function stateOf(tx: Tx, saleId: string) {
  const sale = await tx.sale.findUniqueOrThrow({
    where: { id: saleId },
    select: { id: true, invoiceNo: true, status: true, total: true, payments: { select: paymentSelect, orderBy: { createdAt: "asc" } } },
  });
  return toState(sale);
}

function assertAmount(state: SaleState, amount: number) {
  if (state.active) throw new UserFacingError("Masih ada pembayaran yang menunggu. Selesaikan atau batalkan dulu.");
  if (amount > state.remaining) {
    throw new UserFacingError(`Nominal melebihi sisa tagihan (${formatRupiah(state.remaining)}).`);
  }
}

// ---------------------------------------------------------------------------
//  QRIS
// ---------------------------------------------------------------------------

export async function startQris(user: CurrentUser, saleId: string, amount: number, appUrl: string): Promise<SaleState> {
  const provider = getPaymentProvider(appUrl);
  const paymentId = await db.$transaction(async (tx) => {
    const sale = await lockOwnPending(tx, saleId, user);
    assertAmount(toState(sale), amount);
    const p = await tx.payment.create({
      data: { saleId, method: "QRIS", status: "PENDING", provider: provider.name, amount },
      select: { id: true },
    });
    return p.id;
  });

  // Panggilan ke provider di luar transaksi database: gateway sungguhan butuh waktu,
  // dan baris Sale tidak boleh terkunci selama itu.
  try {
    const qr = await provider.createQris({ paymentId, amount });
    await db.payment.update({
      where: { id: paymentId },
      data: { providerRef: qr.providerRef, qrString: qr.qrString, expiresAt: qr.expiresAt },
    });
  } catch (err) {
    await db.payment.update({ where: { id: paymentId }, data: { status: "FAILED" } });
    throw err;
  }
  return (await getSaleState(saleId, user))!;
}

/** Kasir membatalkan QR yang sedang tampil (mis. pembeli ganti ke tunai). */
export async function cancelActivePayment(user: CurrentUser, saleId: string): Promise<SaleState> {
  return db.$transaction(async (tx) => {
    const sale = await lockOwnPending(tx, saleId, user);
    const active = toState(sale).active;
    if (active?.method === "QRIS") {
      await tx.payment.update({ where: { id: active.id }, data: { status: "EXPIRED" } });
    }
    return stateOf(tx, saleId);
  });
}

// ---------------------------------------------------------------------------
//  Kartu (EDC)
// ---------------------------------------------------------------------------

export async function payByCard(
  user: CurrentUser,
  saleId: string,
  amount: number,
  appUrl: string,
): Promise<{ state: SaleState; declined: string | null }> {
  const provider = getPaymentProvider(appUrl);
  const paymentId = await db.$transaction(async (tx) => {
    const sale = await lockOwnPending(tx, saleId, user);
    assertAmount(toState(sale), amount);
    const p = await tx.payment.create({
      data: {
        saleId,
        method: "CARD",
        status: "PENDING",
        provider: provider.name,
        amount,
        expiresAt: new Date(Date.now() + CARD_TIMEOUT_MS),
      },
      select: { id: true },
    });
    return p.id;
  });

  // Menunggu terminal 2 sampai 4 detik, di luar transaksi database.
  const result = await provider.chargeCard({ paymentId, amount }).catch(() => null);

  const state = await db.$transaction(async (tx) => {
    await lockSale(tx, saleId);
    const current = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { status: true } });
    if (current.status !== "PENDING") return stateOf(tx, saleId); // sudah kedaluwarsa
    await tx.payment.update({
      where: { id: paymentId },
      data: result
        ? {
            status: result.status,
            providerRef: result.providerRef,
            cardLast4: result.cardLast4,
            approvalCode: result.approvalCode,
            paidAt: result.status === "PAID" ? new Date() : null,
          }
        : { status: "FAILED" },
    });
    if (result?.status === "PAID") await completeIfPaid(tx, saleId);
    return stateOf(tx, saleId);
  });
  const declined = !result ? "Terminal tidak merespons. Coba lagi." : result.status === "FAILED" ? (result.message ?? "Kartu ditolak.") : null;
  return { state, declined };
}

// ---------------------------------------------------------------------------
//  Tunai sebagai pelunasan terakhir
// ---------------------------------------------------------------------------

export async function payCashRemaining(user: CurrentUser, saleId: string, tendered: number): Promise<SaleState & { change: number }> {
  return db.$transaction(async (tx) => {
    const sale = await lockOwnPending(tx, saleId, user);
    const state = toState(sale);
    if (state.active) throw new UserFacingError("Masih ada pembayaran yang menunggu. Selesaikan atau batalkan dulu.");
    if (tendered < state.remaining) throw new UserFacingError("Uang yang diterima kurang dari sisa tagihan.");
    const now = new Date();
    const change = tendered - state.remaining;
    await tx.payment.create({
      data: { saleId, method: "CASH", status: "PAID", provider: "cash", amount: state.remaining, tendered, change, createdAt: now, paidAt: now },
    });
    await completeIfPaid(tx, saleId);
    return { ...(await stateOf(tx, saleId)), change };
  });
}

// ---------------------------------------------------------------------------
//  Pembatalan sebelum lunas
// ---------------------------------------------------------------------------

/**
 * Batalkan transaksi yang belum ada pembayaran masuk: stok yang dipesan dikembalikan
 * (tercatat sebagai VOID_RETURN) dan transaksi ditandai VOIDED. Nomor invoice tetap
 * tercatat, jadi urutan nomor tidak berlubang tanpa jejak.
 */
export async function cancelPendingSale(user: CurrentUser, saleId: string) {
  return db.$transaction(async (tx) => {
    const sale = await lockOwnPending(tx, saleId, user);
    const state = toState(sale);
    if (state.paid > 0) {
      throw new UserFacingError(
        `Sudah ada pembayaran ${formatRupiah(state.paid)} yang masuk. Lunasi sisanya, atau minta admin membatalkan transaksi.`,
      );
    }
    await tx.payment.updateMany({ where: { saleId, status: "PENDING" }, data: { status: "EXPIRED" } });
    const items = await tx.saleItem.findMany({ where: { saleId }, select: { productId: true, quantity: true } });
    for (const item of items.sort((a, b) => a.productId.localeCompare(b.productId))) {
      await applyStockDelta(tx, {
        branchId: sale.branchId,
        productId: item.productId,
        delta: item.quantity,
        type: "VOID_RETURN",
        refId: saleId,
        note: "Dibatalkan sebelum lunas",
        userId: user.id,
      });
    }
    await tx.sale.update({
      where: { id: saleId },
      data: { status: "VOIDED", voidReason: "Dibatalkan kasir sebelum lunas", voidedById: user.id, voidedAt: new Date() },
    });
    return { invoiceNo: sale.invoiceNo };
  });
}

// ---------------------------------------------------------------------------
//  Webhook dari provider
// ---------------------------------------------------------------------------

export type WebhookOutcome = "applied" | "duplicate" | "expired" | "unknown";

/**
 * Terapkan notifikasi provider. Idempoten: webhook yang sama dikirim dua kali hanya
 * berefek sekali, karena status pembayaran dicek ulang setelah barisnya dikunci.
 */
export async function applyWebhook({ providerRef, status }: { providerRef: string; status: WebhookStatus }): Promise<WebhookOutcome> {
  const payment = await db.payment.findUnique({ where: { providerRef }, select: { id: true, saleId: true } });
  if (!payment) return "unknown";

  return db.$transaction(async (tx) => {
    await lockSale(tx, payment.saleId); // juga menandai QR yang sudah lewat waktu sebagai EXPIRED
    const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id }, select: { status: true } });
    if (current.status === "EXPIRED") return "expired";
    if (current.status !== "PENDING") return "duplicate";

    await tx.payment.update({
      where: { id: payment.id },
      data: { status, paidAt: status === "PAID" ? new Date() : null },
    });
    if (status === "PAID") await completeIfPaid(tx, payment.saleId);
    return "applied";
  });
}

/** Data untuk halaman simulator (publik): secukupnya, tanpa detail barang atau pembeli. */
export async function getSimulatorPayment(providerRef: string) {
  const payment = await db.payment.findUnique({
    where: { providerRef },
    select: {
      saleId: true,
      amount: true,
      status: true,
      expiresAt: true,
      method: true,
      sale: { select: { invoiceNo: true, branch: { select: { name: true } } } },
    },
  });
  if (!payment || payment.method !== "QRIS") return null;
  if (payment.status === "PENDING" && payment.expiresAt && payment.expiresAt < new Date()) {
    await expireStale(db, payment.saleId);
    return { ...payment, status: "EXPIRED" as const };
  }
  return payment;
}

import type { PaymentMethod, PaymentStatus, SaleStatus } from "@/generated/prisma/enums";

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  COMPLETED: "Selesai",
  VOIDED: "Dibatalkan",
  PENDING_PAYMENT: "Menunggu pembayaran",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = { CASH: "Tunai", QRIS: "QRIS", CARD: "Kartu" };

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PAID: "Lunas",
  PENDING: "Menunggu",
  FAILED: "Gagal",
  EXPIRED: "Kedaluwarsa",
  REFUNDED: "Dikembalikan",
};

/** "Tunai", "QRIS + Tunai": metode yang benar-benar menerima uang, urut sesuai waktu bayar. */
export function methodSummary(payments: { method: PaymentMethod; status: PaymentStatus }[]): string {
  const methods = [...new Set(payments.filter((p) => p.status === "PAID" || p.status === "REFUNDED").map((p) => p.method))];
  return methods.length ? methods.map((m) => METHOD_LABEL[m]).join(" + ") : "Belum dibayar";
}

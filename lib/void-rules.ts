import { jakartaDateKey } from "./format";

type VoidCandidate = {
  status: "PENDING_PAYMENT" | "COMPLETED" | "VOIDED";
  createdAt: Date;
  shiftStatus: "OPEN" | "CLOSED";
};

/**
 * Alasan transaksi tidak bisa di-void, atau null bila boleh. Aturan bisnis: void hanya
 * untuk transaksi di shift yang masih terbuka, atau yang dibuat hari ini (WIB).
 */
export function voidBlocker(sale: VoidCandidate, now: Date = new Date()): string | null {
  if (sale.status === "VOIDED") return "Transaksi ini sudah dibatalkan.";
  if (sale.shiftStatus === "OPEN") return null;
  if (jakartaDateKey(sale.createdAt) === jakartaDateKey(now)) return null;
  return "Transaksi dari hari sebelumnya di shift yang sudah ditutup tidak bisa dibatalkan.";
}

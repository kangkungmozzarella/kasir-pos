/** MDN01 + 20261125 + 7 -> "MDN01-20261125-0007". Urutan di atas 9999 tetap ditulis utuh. */
export function formatInvoiceNo(branchCode: string, dateKey: string, seq: number): string {
  if (!/^\d{8}$/.test(dateKey)) throw new Error(`Tanggal invoice harus YYYYMMDD, dapat ${dateKey}`);
  if (!Number.isInteger(seq) || seq < 1) throw new Error(`Nomor urut invoice tidak valid: ${seq}`);
  return `${branchCode}-${dateKey}-${String(seq).padStart(4, "0")}`;
}

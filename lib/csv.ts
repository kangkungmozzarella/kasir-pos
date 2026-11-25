/**
 * Pemisah titik koma: Excel dengan pengaturan wilayah Indonesia memakai ";" sebagai
 * pemisah daftar, jadi file berpemisah koma terbuka sebagai satu kolom panjang.
 * Google Sheets dan LibreOffice mendeteksi keduanya.
 */
export const CSV_SEPARATOR = ";";

/**
 * Satu sel CSV. Teks yang diawali = + - @ diberi tanda kutip tunggal supaya tidak
 * dijalankan sebagai rumus saat dibuka di spreadsheet (CSV injection). Angka dibiarkan.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  let s = value;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(csvCell).join(CSV_SEPARATOR) + "\r\n";
}

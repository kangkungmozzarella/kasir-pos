/**
 * Hitungan kas laci. Modul murni (tanpa database) supaya bisa diuji unit.
 *
 * Kas yang diharapkan = modal awal + semua pembayaran tunai yang masuk di shift itu.
 * `Payment.amount` untuk tunai sudah bersih dari kembalian (uang diterima dikurangi
 * kembalian), jadi cukup dijumlahkan. Transaksi yang di-void tidak dihitung karena
 * uangnya sudah dikembalikan ke pembeli.
 */
export function expectedCash(openingCash: number, cashPaid: number): number {
  return openingCash + cashPaid;
}

export type CashDifference = { amount: number; kind: "pas" | "lebih" | "kurang" };

/** Selisih uang yang dihitung terhadap yang diharapkan. Positif = lebih. */
export function cashDifference(counted: number, expected: number): CashDifference {
  const amount = counted - expected;
  return { amount, kind: amount === 0 ? "pas" : amount > 0 ? "lebih" : "kurang" };
}

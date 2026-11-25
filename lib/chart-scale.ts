/**
 * Skala sumbu Y yang "bulat": 0, 250 rb, 500 rb, 750 rb, 1 jt. Modul murni untuk diuji.
 * Langkah dipilih dari 1, 2, 2,5, dan 5 kali pangkat sepuluh, sehingga label mudah dibaca.
 */
export function niceTicks(max: number, target = 4): number[] {
  if (!(max > 0)) return [0];
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Math.round(i * step));
}

const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });

/** 1.250.000 -> "1,3 jt"; 500.000 -> "500 rb". Untuk label sumbu, bukan untuk nominal transaksi. */
export function formatCompact(n: number): string {
  return compact.format(n);
}

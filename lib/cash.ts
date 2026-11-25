/**
 * Nominal yang paling mungkin diserahkan pembeli: pecahan 50.000 / 100.000 bila cukup,
 * plus pembulatan ke atas. Maksimal tiga, selalu lebih besar dari total.
 */
export function quickAmounts(total: number): number[] {
  const up = (step: number) => Math.ceil(total / step) * step;
  const candidates = [50_000, 100_000, up(10_000), up(50_000), up(100_000)];
  return [...new Set(candidates.filter((n) => n > total))].sort((a, b) => a - b).slice(0, 3);
}

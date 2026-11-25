export const TIME_ZONE = "Asia/Jakarta";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 12500 -> "Rp 12.500". Nominal selalu integer Rupiah. */
export function formatRupiah(amount: number): string {
  if (!Number.isInteger(amount)) throw new Error(`Nominal harus bilangan bulat, dapat ${amount}`);
  // Intl memakai spasi tak terputus; dipertahankan supaya "Rp" tidak terpisah dari angkanya.
  return rupiah.format(amount);
}

/** 12500 -> "12.500" (tanpa simbol, untuk kolom angka dan struk). */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Tanggal kalender di Jakarta sebagai "YYYYMMDD" (dipakai nomor invoice). */
export function jakartaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}${get("month")}${get("day")}`;
}

/** Pukul 00.00 WIB, `daysAgo` hari sebelum tanggal `now` (WIB tidak punya DST, selalu UTC+7). */
export function jakartaDayStart(daysAgo = 0, now: Date = new Date()): Date {
  const key = jakartaDateKey(now);
  const utcMidnight = Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)));
  return new Date(utcMidnight - 7 * 3_600_000 - daysAgo * 86_400_000);
}

/** Tanggal WIB untuk <input type="date">: "YYYY-MM-DD". */
export function jakartaDateInput(date: Date): string {
  const k = jakartaDateKey(date);
  return `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`;
}

/** "YYYY-MM-DD" -> pukul 00.00 WIB pada tanggal itu, atau null bila tidak valid. */
export function parseJakartaDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(utc - 7 * 3_600_000);
  return jakartaDateInput(d) === value ? d : null; // tolak 2026-02-31 dan sejenisnya
}

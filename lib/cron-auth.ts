import { timingSafeEqual } from "node:crypto";

/**
 * Cek header Authorization dari Vercel Cron ("Bearer <CRON_SECRET>"). Perbandingan
 * waktu-konstan; rahasia kosong atau terlalu pendek selalu ditolak.
 */
export function isAuthorizedCron(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

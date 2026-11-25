import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tanda tangan webhook ala payment gateway: HMAC-SHA256 atas `${timestamp}.${body}`.
 * Timestamp ikut ditandatangani supaya webhook lama tidak bisa dikirim ulang (replay).
 */
export const SIGNATURE_HEADER = "x-mock-signature";
export const TIMESTAMP_HEADER = "x-mock-timestamp";
export const MAX_AGE_SECONDS = 5 * 60;

export function sign(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export type VerifyResult = { ok: true } | { ok: false; reason: "missing" | "stale" | "mismatch" };

export function verify(
  secret: string,
  { signature, timestamp, body }: { signature: string | null; timestamp: string | null; body: string },
  nowSeconds = Math.floor(Date.now() / 1000),
): VerifyResult {
  if (!signature || !timestamp || !/^\d+$/.test(timestamp)) return { ok: false, reason: "missing" };
  const ts = Number(timestamp);
  if (Math.abs(nowSeconds - ts) > MAX_AGE_SECONDS) return { ok: false, reason: "stale" };

  const expected = Buffer.from(sign(secret, ts, body), "hex");
  const given = Buffer.from(signature, "hex");
  // timingSafeEqual: perbandingan waktu-konstan supaya tanda tangan tidak bisa ditebak per karakter.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "mismatch" };
  return { ok: true };
}

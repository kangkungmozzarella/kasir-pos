import "server-only";
import { headers } from "next/headers";

/**
 * Origin yang dipakai pengunjung saat ini (mis. http://192.168.1.10:3000 atau domain
 * Vercel). Dipakai untuk isi QR, supaya HP di jaringan yang sama bisa membuka simulator.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

import { connection } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { seedDemo } from "@/lib/demo-seed";

// Seed ulang memakan beberapa detik; beri ruang di batas waktu fungsi serverless.
export const maxDuration = 60;

/**
 * Reset data demo (dipanggil Vercel Cron setiap hari 03.00 WIB, lihat vercel.json).
 * MENGHAPUS SEMUA DATA. Dua pengaman: harus diaktifkan dengan DEMO_RESET_ENABLED=true,
 * dan harus membawa CRON_SECRET. Jangan pernah aktifkan di database toko sungguhan.
 */
export async function GET(request: Request) {
  // Tanpa ini Cache Components me-render route saat build (pemeriksaan env terjadi
  // sebelum header dibaca), dan jawaban 404 dari waktu build ikut tersimpan.
  await connection();
  if (process.env.DEMO_RESET_ENABLED !== "true") {
    return new Response("Reset demo tidak aktif di lingkungan ini.", { status: 404 });
  }
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Tidak diizinkan.", { status: 401 });
  }
  const started = Date.now();
  const summary = await seedDemo(db, () => {});
  return Response.json({ ok: true, ...summary, ms: Date.now() - started });
}

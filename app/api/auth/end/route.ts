import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";

/**
 * Hapus cookie session lalu kembali ke /login. Dipakai saat cookie masih berlaku
 * tapi akunnya sudah dinonaktifkan atau dihapus; tanpa ini proxy.ts akan terus
 * mengembalikan pengguna dari /login ke halaman beranda (redirect loop).
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL("/login", request.url));
}

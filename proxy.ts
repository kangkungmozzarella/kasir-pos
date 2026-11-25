import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import { SESSION_COOKIE, sessionOptions, type SessionData } from "@/lib/session-config";
import { homePathFor } from "@/lib/roles";

// Rute yang boleh dibuka tanpa login.
const PUBLIC_PREFIXES = ["/login", "/simulator"];

/**
 * Pemeriksaan optimis: hanya membaca cookie, tanpa database. Tujuannya mengarahkan
 * pengunjung ke halaman yang tepat dengan cepat. Otorisasi sebenarnya tetap dicek
 * di server lewat lib/auth.ts pada setiap halaman, server action, dan route handler.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSession(request);
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (pathname === "/") {
    return redirect(request, session ? homePathFor(session.role) : "/login");
  }
  if (pathname === "/login" && session) {
    return redirect(request, homePathFor(session.role));
  }
  if (!isPublic && !session) {
    return redirect(request, "/login");
  }
  return NextResponse.next();
}

async function readSession(request: NextRequest): Promise<SessionData | null> {
  const seal = request.cookies.get(SESSION_COOKIE)?.value;
  if (!seal) return null;
  const { password, ttl } = sessionOptions();
  const data = await unsealData<Partial<SessionData>>(seal, { password, ttl });
  return data.userId && data.role ? (data as SessionData) : null;
}

function redirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export const config = {
  // Lewati API (punya pemeriksaan sendiri), aset Next, dan file statis.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { getSession } from "./session";
import { homePathFor, type Role } from "./roles";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string | null;
  branch: { id: string; code: string; name: string } | null;
};

/**
 * Data Access Layer: satu-satunya tempat yang membaca session lalu mencocokkan
 * dengan database. Dicek ulang ke DB setiap request supaya user yang dinonaktifkan
 * langsung kehilangan akses walau cookienya masih berlaku.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session.userId) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      branchId: true,
      isActive: true,
      branch: { select: { id: true, code: true, name: true } },
    },
  });
  if (!user || !user.isActive) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role, branchId: user.branchId, branch: user.branch };
});

/** Untuk halaman: arahkan ke /login bila belum masuk, atau ke beranda role bila tidak berhak. */
export async function requireUser(allowed?: readonly Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  // Lewat route handler supaya cookie yang tidak berlaku lagi ikut dihapus.
  if (!user) redirect("/api/auth/end");
  if (allowed && !allowed.includes(user.role)) redirect(homePathFor(user.role));
  return user;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
  }
}

/** Untuk server action dan route handler: lempar AuthError, jangan redirect. */
export async function assertUser(allowed?: readonly Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Sesi berakhir. Silakan masuk lagi.", 401);
  if (allowed && !allowed.includes(user.role)) {
    throw new AuthError("Anda tidak punya akses untuk tindakan ini.", 403);
  }
  return user;
}

import "server-only";
import bcrypt from "bcryptjs";
import type { CurrentUser } from "./auth";
import { db } from "./db";
import { afterFailure, lockRemaining } from "./pin-rules";

/**
 * Ganti kasir dengan PIN di perangkat kasir yang sudah login. PIN hanya 4 sampai 6
 * digit, jadi tebakan dibatasi: 5 kali salah berturut-turut mengunci PIN akun itu
 * selama 5 menit. Hanya akun di cabang yang sama yang bisa dipilih.
 */

/** Akun yang bisa diganti dari perangkat ini: cabang yang sama, aktif, punya PIN. */
export async function switchCandidates(user: CurrentUser) {
  if (!user.branchId) return [];
  const now = new Date();
  const users = await db.user.findMany({
    where: { branchId: user.branchId, isActive: true, pin: { not: null }, id: { not: user.id }, role: { in: ["CASHIER", "ADMIN"] } },
    orderBy: [{ role: "desc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, pinLockedUntil: true },
  });
  return users.map((u) => ({ id: u.id, name: u.name, role: u.role, locked: !!u.pinLockedUntil && u.pinLockedUntil > now }));
}

export type SwitchResult =
  | { ok: true; user: { id: string; role: CurrentUser["role"]; branchId: string | null } }
  | { ok: false; error: string };

export async function switchByPin(current: CurrentUser, targetId: string, pin: string): Promise<SwitchResult> {
  if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: "PIN berupa 4 sampai 6 angka." };

  // Baris user dikunci: percobaan bersamaan untuk akun yang sama dihitung satu per satu,
  // jadi tebakan paralel tidak bisa melewati batas 5 kali.
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${targetId} FOR UPDATE`;
    const target = await tx.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, role: true, branchId: true, isActive: true, pin: true, pinFailedCount: true, pinLockedUntil: true },
    });
    if (!target || !target.pin || !target.isActive || target.role === "OWNER" || !current.branchId || target.branchId !== current.branchId) {
      return { ok: false as const, error: "Akun ini tidak bisa dipakai di perangkat ini." };
    }

    const now = new Date();
    const state = { failedCount: target.pinFailedCount, lockedUntil: target.pinLockedUntil };
    const wait = lockRemaining(state, now);
    if (wait > 0) {
      return { ok: false as const, error: `PIN ${target.name} dikunci karena terlalu banyak salah. Coba lagi dalam ${Math.ceil(wait / 60_000)} menit.` };
    }

    if (!(await bcrypt.compare(pin, target.pin))) {
      const next = afterFailure(state, now);
      await tx.user.update({ where: { id: target.id }, data: { pinFailedCount: next.failedCount, pinLockedUntil: next.lockedUntil } });
      return {
        ok: false as const,
        error: next.locked
          ? `PIN salah. PIN ${target.name} dikunci 5 menit.`
          : `PIN salah. Sisa ${next.remaining} percobaan sebelum dikunci 5 menit.`,
      };
    }

    await tx.user.update({ where: { id: target.id }, data: { pinFailedCount: 0, pinLockedUntil: null } });
    return { ok: true as const, user: { id: target.id, role: target.role, branchId: target.branchId } };
  });
}

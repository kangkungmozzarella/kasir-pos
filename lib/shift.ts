import "server-only";
import type { CurrentUser } from "./auth";
import { UserFacingError } from "./actions";
import { db } from "./db";
import { resolveBranchScope } from "./permissions";

export function getOpenShift(userId: string) {
  return db.shift.findFirst({
    where: { cashierId: userId, status: "OPEN" },
    include: { branch: { select: { id: true, name: true, code: true, taxRate: true, isActive: true } } },
  });
}

/**
 * Buka shift. Satu kasir maksimal satu shift OPEN: advisory lock per user membuat
 * dua permintaan bersamaan (mis. tombol diklik dua kali) berjalan bergantian,
 * dan yang kedua cukup mendapatkan shift yang sudah dibuka.
 */
export async function openShift(user: CurrentUser, input: { openingCash: number; branchId: string | null }) {
  const branchId = resolveBranchScope(user, input.branchId);
  if (!branchId) throw new UserFacingError("Pilih cabang tempat Anda berjaga.");

  const branch = await db.branch.findFirst({ where: { id: branchId, isActive: true }, select: { id: true } });
  if (!branch) throw new UserFacingError("Cabang tidak ditemukan atau sudah nonaktif.");

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`shift:${user.id}`}, 0))`;
    const existing = await tx.shift.findFirst({ where: { cashierId: user.id, status: "OPEN" } });
    if (existing) return existing;
    return tx.shift.create({ data: { branchId, cashierId: user.id, openingCash: input.openingCash } });
  });
}

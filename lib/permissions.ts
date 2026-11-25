import type { Role } from "./roles";

/** Siapa boleh melakukan apa. Dicek di server; UI hanya menyembunyikan tombol. */
export const PERMISSIONS = {
  "pos:use": ["CASHIER", "ADMIN", "OWNER"],
  "dashboard:view": ["ADMIN", "OWNER"],
  "product:manage": ["ADMIN", "OWNER"],
  "stock:manage": ["ADMIN", "OWNER"],
  "user:manage": ["ADMIN", "OWNER"],
  "sale:void": ["ADMIN", "OWNER"],
  "branch:manage": ["OWNER"],
  "report:all-branches": ["OWNER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

type Scoped = { role: Role; branchId: string | null };

/**
 * Cabang mana yang boleh disentuh user.
 * - OWNER: cabang yang diminta, atau `null` (= semua cabang) bila tidak diminta.
 * - ADMIN/CASHIER: selalu cabangnya sendiri; meminta cabang lain ditolak.
 */
export function resolveBranchScope(user: Scoped, requestedBranchId?: string | null): string | null {
  if (user.role === "OWNER") return requestedBranchId ?? null;
  if (!user.branchId) throw new Error("Akun ini belum ditempatkan di cabang mana pun.");
  if (requestedBranchId && requestedBranchId !== user.branchId) {
    throw new Error("Anda hanya bisa mengakses data cabang sendiri.");
  }
  return user.branchId;
}

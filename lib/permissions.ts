import type { Role } from "./roles";

/**
 * Siapa boleh melakukan apa. Dicek di server; UI hanya menyembunyikan tombol.
 *
 * Katalog (produk & kategori) bersifat global untuk semua cabang, jadi hanya Pemilik
 * yang mengubahnya. Admin mengatur hal yang khusus cabangnya: stok, stok minimum,
 * harga khusus cabang, dan akun kasir. (Keputusan pemilik, 25 Nov 2026.)
 */
export const PERMISSIONS = {
  "pos:use": ["CASHIER", "ADMIN", "OWNER"],
  "dashboard:view": ["ADMIN", "OWNER"],
  "catalog:view": ["ADMIN", "OWNER"],
  "catalog:manage": ["OWNER"],
  "stock:manage": ["ADMIN", "OWNER"],
  "user:manage": ["ADMIN", "OWNER"],
  "sale:void": ["ADMIN", "OWNER"],
  "report:view": ["ADMIN", "OWNER"],
  "transfer:manage": ["ADMIN", "OWNER"],
  "branch:manage": ["OWNER"],
  "report:all-branches": ["OWNER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

type Scoped = { role: Role; branchId: string | null };

export class ScopeError extends Error {}

/**
 * Cabang mana yang boleh disentuh user.
 * - OWNER: cabang yang diminta, atau `null` (= semua cabang) bila tidak diminta.
 * - ADMIN/CASHIER: selalu cabangnya sendiri; meminta cabang lain ditolak.
 */
export function resolveBranchScope(user: Scoped, requestedBranchId?: string | null): string | null {
  if (user.role === "OWNER") return requestedBranchId || null;
  if (!user.branchId) throw new ScopeError("Akun ini belum ditempatkan di cabang mana pun.");
  if (requestedBranchId && requestedBranchId !== user.branchId) {
    throw new ScopeError("Anda hanya bisa mengakses data cabang sendiri.");
  }
  return user.branchId;
}

/** Role yang boleh dibuat/diubah oleh role tertentu. Pemilik tidak bisa dibuat dari aplikasi. */
export function manageableRoles(actor: Role): Role[] {
  if (actor === "OWNER") return ["ADMIN", "CASHIER"];
  if (actor === "ADMIN") return ["CASHIER"];
  return [];
}

/** Apakah `actor` boleh mengelola akun `target`. */
export function canManageUser(
  actor: { id: string; role: Role; branchId: string | null },
  target: { id: string; role: Role; branchId: string | null },
): boolean {
  if (actor.id === target.id) return false; // akun sendiri tidak dikelola dari halaman ini
  if (!manageableRoles(actor.role).includes(target.role)) return false;
  if (actor.role === "ADMIN") return target.branchId === actor.branchId;
  return true;
}

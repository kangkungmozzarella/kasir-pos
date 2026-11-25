// Didefinisikan terpisah dari client Prisma supaya bisa dipakai di proxy.ts dan
// komponen klien tanpa ikut membundel Prisma.
export const ROLES = ["OWNER", "ADMIN", "CASHIER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Pemilik",
  ADMIN: "Admin cabang",
  CASHIER: "Kasir",
};

/** Halaman awal setelah login, per role. */
export function homePathFor(role: Role): string {
  return role === "CASHIER" ? "/pos" : "/dashboard";
}

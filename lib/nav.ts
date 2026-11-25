import { can, type Permission } from "./permissions";
import type { Role } from "./roles";

export type NavItem = { href: string; label: string };

// Hanya halaman yang sudah ada. Tambahkan di sini saat halamannya dibangun.
const NAV: (NavItem & { permission: Permission })[] = [
  { href: "/dashboard", label: "Dashboard", permission: "dashboard:view" },
  { href: "/pos", label: "Kasir", permission: "pos:use" },
];

export function navFor(role: Role): NavItem[] {
  return NAV.filter((item) => can(role, item.permission)).map(({ href, label }) => ({ href, label }));
}

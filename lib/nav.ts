import { can, type Permission } from "./permissions";
import type { Role } from "./roles";

export type NavItem = { href: string; label: string };

// Hanya halaman yang sudah ada. Tambahkan di sini saat halamannya dibangun.
const NAV: (NavItem & { permission: Permission })[] = [
  { href: "/dashboard", label: "Dashboard", permission: "dashboard:view" },
  { href: "/pos", label: "Kasir", permission: "pos:use" },
  { href: "/sales", label: "Penjualan", permission: "report:view" },
  { href: "/shifts", label: "Shift", permission: "report:view" },
  { href: "/products", label: "Produk", permission: "catalog:view" },
  { href: "/categories", label: "Kategori", permission: "catalog:manage" },
  { href: "/stock", label: "Stok", permission: "stock:manage" },
  { href: "/transfers", label: "Transfer", permission: "transfer:manage" },
  { href: "/users", label: "Pengguna", permission: "user:manage" },
  { href: "/branches", label: "Cabang", permission: "branch:manage" },
];

export function navFor(role: Role): NavItem[] {
  return NAV.filter((item) => can(role, item.permission)).map(({ href, label }) => ({ href, label }));
}

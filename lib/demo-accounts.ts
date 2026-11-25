import type { Role } from "./roles";

/** Akun yang dibuat prisma/seed.ts. Ditampilkan di halaman login untuk pengunjung demo. */
export const DEMO_PASSWORD = "demo12345";

export const DEMO_ACCOUNTS: { email: string; role: Role; branch: string | null }[] = [
  { email: "pemilik@demo.test", role: "OWNER", branch: null },
  { email: "admin.mdn01@demo.test", role: "ADMIN", branch: "Medan Kota" },
  { email: "kasir1.mdn01@demo.test", role: "CASHIER", branch: "Medan Kota" },
  { email: "admin.mdn02@demo.test", role: "ADMIN", branch: "Medan Baru" },
  { email: "kasir1.mdn02@demo.test", role: "CASHIER", branch: "Medan Baru" },
];

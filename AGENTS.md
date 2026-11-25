<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Proyek ini

- Spesifikasi lengkap dan rencana fase ada di `HANDOFF.md` (hanya lokal, sengaja tidak di-commit). Kerjakan berurutan dan berhenti untuk konfirmasi di akhir tiap fase.
- Arah desain: `DESIGN.md`. Semua UI disaring dengan aturan antislop (tanpa em dash, kontras WCAG AA, target sentuh 44px, state kosong/memuat/error).
- Next.js 16 dengan Cache Components: pembacaan session harus di dalam `<Suspense>`. Pola auth ada di `lib/auth.ts` (halaman pakai `requireUser`, aksi/API pakai `assertUser`).
- Prisma 7: client di-generate ke `generated/prisma` (`pnpm prisma generate`); koneksi diatur di `prisma.config.ts`.
- Query per jam/hari harus memakai zona WIB: `("createdAt" at time zone 'UTC') at time zone 'Asia/Jakarta'`.
- Hak akses: katalog (produk & kategori) hanya Pemilik; Admin mengatur stok, harga cabang, dan kasir di cabangnya (keputusan pemilik). Aturan ada di `lib/permissions.ts`.
- Server action: validasi Zod di `lib/validation.ts`, cek hak akses dengan `assertUser`, bungkus error dengan `actionError` dari `lib/actions.ts`. Jangan kirim objek Prisma utuh ke client component (bisa membocorkan hash PIN/kata sandi).
- Perubahan stok selalu lewat `applyStockDelta` / `setStockCount` di `lib/stock.ts` di dalam `db.$transaction`.
- Komponen tanpa "use client" harus mengimpor ikon dari `@phosphor-icons/react/dist/ssr`.
- Pesan commit tanpa baris `Co-Authored-By`.

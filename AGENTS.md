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
- Checkout lewat `checkoutCash` di `lib/checkout.ts`; jangan menghitung harga di klien untuk disimpan. Layar kasir hanya pratinjau.
- Dialog di layar kasir harus mengembalikan fokus ke kolom cari (`finalFocus`), supaya scanner barcode tetap bekerja.
- Halaman yang di-stream (Suspense) tetap berstatus HTTP 200 walau memanggil `notFound()`; uji isinya, bukan status kodenya.
- Stok dipesan (berkurang) saat transaksi dibuat, termasuk yang masih menunggu QRIS/kartu; dikembalikan lewat `VOID_RETURN` bila dibatalkan atau kedaluwarsa. Ini menggantikan aturan nomor 6 di HANDOFF (keputusan pemilik, fase 4).
- Pembayaran non-tunai lewat `lib/sale-flow.ts` (QRIS, kartu, pelunasan tunai, batal, webhook). Semua mutasi mengunci baris Sale (`FOR UPDATE`); panggilan ke provider dilakukan di luar transaksi database.
- Polling status dari klien lewat route handler `GET /api/sales/[id]/status`, bukan server action (server action diproses berurutan per klien).
- Integration test (`pnpm test:integration`) memakai database `kasir_pos_test`. `prisma migrate reset` diblokir untuk agent AI; setup test memakai `migrate deploy` + seed dan menolak URL yang bukan database lokal berakhiran `_test`.
- PIN dipakai untuk ganti kasir di perangkat yang sudah login, bukan di halaman login (keputusan pemilik, fase 6). Logika di `lib/pin.ts`: 5 kali salah mengunci 5 menit, baris user dikunci `FOR UPDATE` saat memeriksa.
- Transfer stok lewat `lib/transfer.ts` (DRAFT -> SENT -> RECEIVED). Stok asal berkurang saat dikirim, tujuan bertambah saat diterima.
- Tidak ada antrean transaksi offline dan `experimental.useOffline` sengaja tidak dipakai: checkout tidak idempoten. Service worker (`public/sw.js`) hanya menyimpan aset statis dan `/offline`.
- Data demo ada di `lib/demo-seed.ts` (dipakai `pnpm db:seed` dan `GET /api/cron/reset-demo`). Reset terjadwal 03.00 WIB hanya aktif dengan `DEMO_RESET_ENABLED=true` + `CRON_SECRET` (keputusan pemilik). Deploy ke Vercel + Neon ditunda (keputusan pemilik).
- Route handler yang memeriksa env sebelum membaca request harus memanggil `await connection()`; tanpa itu Cache Components me-render-nya saat build.
- `prisma migrate dev` menolak berjalan non-interaktif bila ada peringatan (mis. unique constraint baru). Buat SQL dengan `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, simpan sebagai folder migrasi baru, lalu `prisma migrate deploy`.
- Tutup shift dan void ada di `lib/shift.ts` dan `lib/void.ts`. Tutup shift mengunci baris Shift (`FOR UPDATE`), `createSale` memegang `FOR SHARE` pada shift yang sama. Void: refund ke provider dulu (di luar transaksi DB), lalu catat dengan baris Sale terkunci.
- Angka laporan (dashboard, rekap shift) dihitung dengan agregasi SQL di `lib/dashboard.ts` / `lib/shift.ts`, bukan menjumlah di JavaScript.
- Form saringan GET yang memakai `defaultValue` diberi `key` sesuai nilai saringannya; navigasi sisi klien memakai ulang elemen sehingga `defaultValue` lama tetap tampil.
- E2E: Next 16 menyimpan halaman sebelumnya tersembunyi di DOM (Activity). Batasi locator ke region halaman saat teks yang sama bisa ada di halaman sebelumnya.
- Seed sengaja membuat Air Mineral 600 ml habis di MDN01 (dipakai test e2e). Test integration mengisi stok sendiri lewat `PURCHASE`, jangan bergantung pada stok acak seed.
- Pesan commit tanpa baris `Co-Authored-By`.

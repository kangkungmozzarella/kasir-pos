# Kasir

Aplikasi kasir (point of sale) multi-cabang untuk toko kelontong dan minimarket. Proyek portofolio.

> **Catatan:** semua toko, produk, akun, dan transaksi di aplikasi ini fiktif. Pembayaran QRIS dan kartu (EDC) adalah simulasi; tidak ada integrasi bank dan tidak ada uang yang berpindah.

## Status

| Fase | Isi | Status |
|---|---|---|
| 1. Fondasi | Next.js, Prisma 7 + PostgreSQL, login dan role, data contoh | Selesai |
| 2. Master data | Produk, kategori, stok per cabang, pengguna | Selesai |
| 3. Kasir + tunai + struk | Layar kasir, shift, pembayaran tunai, struk 58/80mm | Selesai |
| 4. Pembayaran simulasi | QRIS dan kartu tiruan, webhook HMAC, split payment | Belum |
| 5. Shift dan laporan | Tutup shift, void, dashboard dan grafik | Belum |
| 6. Multi-cabang dan rilis | Transfer stok, printer ESC/POS, PWA, deploy | Belum |

## Stack

- **Next.js 16** (App Router, Cache Components) + TypeScript
- **PostgreSQL** + **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **iron-session** untuk session cookie terenkripsi, **bcrypt** untuk kata sandi
- **Tailwind CSS 4** + **shadcn/ui** (Base UI), ikon **Phosphor**
- **Zod** untuk validasi input
- **Vitest** (logika bisnis) dan **Playwright** (alur di browser)

## Menjalankan di komputer sendiri

Butuh Node.js 22+, pnpm 10+, dan Docker.

```bash
pnpm install
cp .env.example .env          # lalu isi AUTH_SECRET dan MOCK_WEBHOOK_SECRET (openssl rand -base64 32)
pnpm db:up                    # PostgreSQL di Docker, port 5433
pnpm db:migrate               # buat tabel
pnpm db:seed                  # data contoh: 2 cabang, 54 produk, 30 hari transaksi
pnpm dev                      # http://localhost:3000
```

Perintah lain:

| Perintah | Fungsi |
|---|---|
| `pnpm test` | Unit test (perhitungan harga, validasi, hak akses, format, barcode) |
| `pnpm test:e2e` | Test browser dengan Playwright (butuh database yang sudah di-seed) |
| `pnpm typecheck` | Pemeriksaan TypeScript |
| `pnpm db:reset` | Hapus database, migrasi ulang, dan seed ulang |
| `pnpm studio` | Prisma Studio untuk melihat isi database |

## Akun demo

Kata sandi semua akun: `demo12345`

| Role | Email | Cabang |
|---|---|---|
| Pemilik | `pemilik@demo.test` | Semua cabang |
| Admin cabang | `admin.mdn01@demo.test` | Medan Kota (MDN01) |
| Admin cabang | `admin.mdn02@demo.test` | Medan Baru (MDN02) |
| Kasir | `kasir1.mdn01@demo.test`, `kasir2.mdn01@demo.test` | Medan Kota |
| Kasir | `kasir1.mdn02@demo.test`, `kasir2.mdn02@demo.test` | Medan Baru |

Kasir juga punya PIN demo (`1111` untuk kasir 1, `2222` untuk kasir 2). PIN sudah bisa diatur di halaman Pengguna, tapi masuk/ganti kasir dengan PIN belum dibuat.

## Keputusan teknis

- **Uang selalu integer Rupiah.** Tidak ada float untuk nominal. Rumus total ada di satu modul murni, [`lib/pricing.ts`](lib/pricing.ts), dan dipakai oleh checkout maupun seed.
- **Server menghitung ulang semua angka.** Klien hanya mengirim produk, jumlah, dan diskon.
- **Hak akses per role.** Katalog (produk & kategori) berlaku untuk semua cabang, jadi hanya Pemilik yang mengubahnya. Admin mengatur stok, stok minimum, harga khusus cabang, dan akun kasir di cabangnya sendiri. Kasir hanya memakai layar kasir.
- **Otorisasi di server.** [`proxy.ts`](proxy.ts) hanya mengarahkan pengunjung dengan cepat; hak akses yang sebenarnya dicek ulang ke database di [`lib/auth.ts`](lib/auth.ts) pada setiap halaman dan aksi. Admin dan kasir dibatasi ke cabangnya sendiri lewat [`lib/permissions.ts`](lib/permissions.ts).
- **Checkout atomik.** [`lib/checkout.ts`](lib/checkout.ts) membuat transaksi, item, pembayaran, nomor invoice, dan pengurangan stok dalam satu transaksi database. Bila stok habis di tengah jalan, semuanya batal.
- **Harga berubah di tengah transaksi tidak tertagih diam-diam.** Klien mengirim total yang dilihat kasir; bila berbeda dengan hitungan server (mis. admin baru saja mengubah harga), transaksi ditolak dan total baru ditampilkan.
- **Snapshot di transaksi.** Nama produk, harga, modal, dan tarif pajak disimpan di transaksi, jadi struk lama tetap benar walau produk atau tarif diubah.
- **Nomor invoice** berformat `MDN01-20261125-0001`, urut per cabang per hari. Tabel `InvoiceCounter` dinaikkan dengan `INSERT ... ON CONFLICT ... RETURNING` di dalam transaksi checkout; uji 15 checkout serentak menghasilkan 15 nomor unik tanpa lompatan.
- **Satu shift terbuka per kasir**, dijaga dengan advisory lock PostgreSQL supaya klik ganda tidak membuka dua shift.
- **Audit stok.** Setiap perubahan stok (barang masuk, penjualan, stok opname) dicatat di `StockMovement`; jumlah semua pergerakan selalu sama dengan stok di `BranchStock`.
- **Stok tidak bisa minus, termasuk saat ramai.** Pengurangan stok di [`lib/stock.ts`](lib/stock.ts) memeriksa sisa stok di dalam satu perintah `UPDATE`, sehingga dua kasir yang menjual barang terakhir bersamaan tidak bisa sama-sama berhasil. Stok opname mengunci baris (`SELECT ... FOR UPDATE`) supaya selisih yang dicatat tepat.
- **Akun dinonaktifkan langsung keluar.** Session dicek ulang ke database setiap request, jadi akun yang dinonaktifkan kehilangan akses tanpa menunggu cookie kedaluwarsa.
- **Barcode contoh** memakai awalan GS1 `20` (khusus pemakaian internal toko) dengan digit cek EAN-13 yang valid, sehingga tidak bertabrakan dengan produk asli.

## Layar kasir

- Kolom cari selalu fokus. Scanner barcode USB (yang mengetik kode lalu Enter) langsung menambahkan barang.
- Shortcut: `F2` cari, `F4` bayar, `+` / `-` ubah jumlah barang terakhir, `Esc` dua kali batalkan transaksi.
- Pembayaran tunai dengan tombol Uang pas dan saran nominal (50.000, 100.000, atau pembulatan ke atas).
- Struk 58 mm atau 80 mm (disimpan per perangkat), dicetak lewat dialog cetak browser, jadi bisa diuji tanpa printer dengan "Simpan sebagai PDF".
- Cetak ulang struk dari riwayat transaksi shift.

Arah desain dan alasan setiap pilihan visual ada di [`DESIGN.md`](DESIGN.md).

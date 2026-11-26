import type { Metadata } from "next";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = { title: "Tidak ada koneksi" };

/**
 * Ditampilkan service worker saat halaman dibuka tanpa koneksi. Statis (tanpa data akun),
 * jadi aman disimpan di cache perangkat.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div aria-hidden className="awning shrink-0" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <Wordmark />
        <h1 className="mt-8 text-2xl font-bold tracking-tight">Tidak ada koneksi internet</h1>
        <p className="mt-2 text-muted-foreground">
          Kasir perlu terhubung ke server untuk mencatat transaksi dan mengurangi stok, supaya tidak ada barang yang terjual dua kali di
          kasir lain.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
          <li>Periksa Wi-Fi atau data seluler perangkat ini.</li>
          <li>Transaksi yang belum selesai tidak hilang: buka lagi layar kasir setelah online.</li>
          <li>Selama offline, catat penjualan di kertas lalu masukkan setelah koneksi kembali.</li>
        </ul>
        {/* Tautan biasa (bukan Link): memuat ulang halaman penuh lewat jaringan. */}
        <a
          href="/pos"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Coba buka layar kasir lagi
        </a>
      </main>
    </div>
  );
}

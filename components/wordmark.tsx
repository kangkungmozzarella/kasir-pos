import Link from "next/link";

/** Nama aplikasi sebagai teks. Belum ada logo resmi; jangan diganti gambar tanpa persetujuan pemilik. */
export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="rounded-md text-xl font-extrabold tracking-tight text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      Kasir
    </Link>
  );
}

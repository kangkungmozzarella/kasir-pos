import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-16">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-muted-foreground">
        Alamatnya mungkin salah ketik, datanya sudah dihapus, atau akun Anda tidak punya akses ke data ini.
      </p>
      <Link href="/" className={`${buttonVariants()} mt-6 self-start`}>
        Kembali ke beranda
      </Link>
    </main>
  );
}

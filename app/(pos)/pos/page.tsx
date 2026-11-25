import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/roles";

export const metadata: Metadata = { title: "Kasir" };

export default function PosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat...</p>}>
      <PosPlaceholder />
    </Suspense>
  );
}

// TODO(fase 3): ganti dengan layar kasir (buka shift, keranjang, pembayaran tunai, struk).
async function PosPlaceholder() {
  const user = await requireUser(PERMISSIONS["pos:use"]);
  return (
    <div className="max-w-xl space-y-3">
      <p className="text-sm text-muted-foreground">
        {ROLE_LABEL[user.role]} · {user.branch?.name ?? "Semua cabang"}
      </p>
      <h1 className="text-2xl font-bold tracking-tight">Layar kasir belum tersedia</h1>
      <p className="text-muted-foreground">
        Halaman ini sedang dibangun. Di fase 3 kasir bisa membuka shift, memindai barcode, menerima pembayaran
        tunai, dan mencetak struk dari sini.
      </p>
    </div>
  );
}

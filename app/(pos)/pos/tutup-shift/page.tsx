import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoadingText } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { getOpenShift, getShiftRecap } from "@/lib/shift";
import { CloseShiftForm } from "./close-shift-form";

export const metadata: Metadata = { title: "Tutup shift" };

export default function CloseShiftPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 sm:py-10">
      <Suspense fallback={<LoadingText>Memuat shift...</LoadingText>}>
        <CloseShiftContent />
      </Suspense>
    </div>
  );
}

async function CloseShiftContent() {
  const user = await requireUser(PERMISSIONS["pos:use"]);
  const open = await getOpenShift(user.id);
  if (!open) redirect("/pos");
  const recap = (await getShiftRecap(user, open.id))!;
  const pending = recap.pending[0];

  return (
    <>
      <Link
        href="/pos"
        className="-ml-1 mb-2 inline-flex min-h-11 items-center rounded-md px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Kembali ke kasir
      </Link>
      <p className="text-sm text-muted-foreground">{recap.branch.name}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Tutup shift</h1>
      <p className="mt-1 text-muted-foreground">
        Dibuka {formatDateTime(recap.openedAt)} · {formatNumber(recap.salesCount)} transaksi selesai
        {recap.voided.length > 0 && `, ${formatNumber(recap.voided.length)} dibatalkan`}.
      </p>

      {pending ? (
        <div role="alert" className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <p className="font-semibold text-destructive">Transaksi {pending.invoiceNo} masih menunggu pembayaran</p>
          <p className="mt-1 text-sm">
            Selesaikan atau batalkan dulu di layar kasir. Bila pembeli sudah membayar sebagian, minta admin membatalkannya.
          </p>
          <Link href="/pos" className={buttonVariants({ variant: "outline", className: "mt-3" })}>
            Buka layar kasir
          </Link>
        </div>
      ) : (
        <CloseShiftForm />
      )}
    </>
  );
}

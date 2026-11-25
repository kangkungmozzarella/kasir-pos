import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSimulatorPayment } from "@/lib/sale-flow";
import { SimulatorPanel } from "./simulator-panel";

export const metadata: Metadata = { title: "Simulator QRIS", robots: { index: false } };

/** Halaman publik yang dibuka saat QR di layar kasir dipindai dengan kamera HP. */
export default function SimulatorPage({ params }: PageProps<"/simulator/pay/[ref]">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div aria-hidden className="awning" />
      <main className="mx-auto w-full max-w-sm flex-1 px-4 py-6">
        <p className="text-sm font-semibold">Simulator QRIS</p>
        <p role="note" className="mt-2 rounded-lg border bg-muted px-3 py-2 text-sm">
          <strong>DEMO: bukan QRIS asli.</strong> Halaman ini meniru aplikasi bank pembeli. Tidak ada uang yang berpindah.
        </p>
        <div className="mt-4">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat tagihan...</p>}>
            <Bill params={params} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function Bill({ params }: { params: PageProps<"/simulator/pay/[ref]">["params"] }) {
  await connection(); // status pembayaran selalu dibaca saat request
  const { ref } = await params;
  const payment = await getSimulatorPayment(ref);
  if (!payment) notFound();
  return (
    <SimulatorPanel
      providerRef={ref}
      amount={payment.amount}
      status={payment.status}
      expiresAt={payment.expiresAt?.toISOString() ?? null}
      storeName={payment.sale.branch.name}
      invoiceNo={payment.sale.invoiceNo}
    />
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useCountdown } from "@/components/use-countdown";
import { formatRupiah } from "@/lib/format";
import { simulatePayment } from "./actions";

type Props = {
  providerRef: string;
  amount: number;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
  expiresAt: string | null;
  storeName: string;
  invoiceNo: string;
};

export function SimulatorPanel({ providerRef, amount, status, expiresAt, storeName, invoiceNo }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const countdown = useCountdown(expiresAt);
  const expired = status === "EXPIRED" || (status === "PENDING" && countdown.done);

  function decide(decision: "PAID" | "FAILED") {
    setError(undefined);
    start(async () => {
      const res = await simulatePayment(providerRef, decision);
      if (res.error) setError(res.error);
    });
  }

  return (
    <section aria-labelledby="tagihan" className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{storeName}</p>
      <h1 id="tagihan" className="sr-only">
        Tagihan {invoiceNo}
      </h1>
      <p className="money mt-1 text-4xl font-extrabold tracking-tight">{formatRupiah(amount)}</p>
      <p className="money mt-1 text-sm text-muted-foreground">{invoiceNo}</p>

      <div aria-live="polite" className="mt-5">
        {status === "PAID" ? (
          <p className="rounded-lg bg-success/10 px-4 py-3 font-semibold text-success">
            Pembayaran berhasil. Layar kasir akan lanjut otomatis.
          </p>
        ) : status === "REFUNDED" ? (
          <p className="rounded-lg bg-muted px-4 py-3 font-semibold">Transaksi dibatalkan toko. Dana sudah dikembalikan.</p>
        ) : status === "FAILED" ? (
          <p className="rounded-lg bg-destructive/10 px-4 py-3 font-semibold text-destructive">Pembayaran ditolak.</p>
        ) : expired ? (
          <p className="rounded-lg bg-muted px-4 py-3 font-semibold">QR sudah kedaluwarsa. Minta kasir membuat QR baru.</p>
        ) : (
          <>
            <p className="money text-sm text-muted-foreground">Berlaku {countdown.label} lagi</p>
            <div className="mt-3 grid gap-2">
              <Button variant="highlight" size="lg" className="h-14 text-base" disabled={pending} onClick={() => decide("PAID")}>
                {pending ? "Memproses..." : `Bayar ${formatRupiah(amount)}`}
              </Button>
              <Button variant="outline" size="lg" disabled={pending} onClick={() => decide("FAILED")}>
                Tolak
              </Button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

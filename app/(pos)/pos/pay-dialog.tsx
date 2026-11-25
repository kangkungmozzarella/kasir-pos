"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { quickAmounts } from "@/lib/cash";
import { formatNumber, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseRupiah } from "@/lib/validation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  pending: boolean;
  error: string | undefined;
  onPay: (tendered: number) => void;
  /** Ke mana fokus kembali setelah dialog tertutup (kolom cari, supaya scanner siap). */
  returnFocus: React.RefObject<HTMLElement | null>;
};

export function PayDialog({ open, onOpenChange, total, pending, error, onPay, returnFocus }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="gap-0 p-0 sm:max-w-md" finalFocus={returnFocus}>
        {/* Dipasang ulang setiap dibuka supaya input kembali kosong. */}
        {open && <PayForm total={total} pending={pending} error={error} onPay={onPay} />}
      </DialogContent>
    </Dialog>
  );
}

function PayForm({ total, pending, error, onPay }: Omit<Props, "open" | "onOpenChange" | "returnFocus">) {
  const [text, setText] = useState("");
  const tendered = text.trim() === "" ? null : parseRupiah(text);
  const enough = tendered !== null && tendered >= total;
  const change = enough ? tendered - total : null;
  const invalid = text.trim() !== "" && tendered === null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (enough && !pending) onPay(tendered);
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="border-b p-5">
        <DialogTitle className="text-base">Pembayaran tunai</DialogTitle>
        <DialogDescription className="sr-only">Masukkan uang yang diterima dari pembeli.</DialogDescription>
        <p className="mt-3 text-sm text-muted-foreground">Total belanja</p>
        <p className="money text-4xl font-extrabold tracking-tight">{formatRupiah(total)}</p>
      </div>

      <div className="space-y-3 p-5">
        <label htmlFor="tendered" className="text-sm font-medium">
          Uang diterima
        </label>
        <Input
          id="tendered"
          inputMode="numeric"
          autoFocus
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={formatNumber(total)}
          aria-invalid={invalid || undefined}
          aria-describedby="tendered-status"
          className="money h-14 text-2xl font-bold"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button type="button" variant="outline" onClick={() => setText(String(total))}>
            Uang pas
          </Button>
          {quickAmounts(total).map((amount) => (
            <Button key={amount} type="button" variant="outline" className="money" onClick={() => setText(String(amount))}>
              {formatNumber(amount)}
            </Button>
          ))}
        </div>

        <div id="tendered-status" aria-live="polite" className="min-h-14 rounded-lg bg-muted px-4 py-3">
          {invalid ? (
            <p className="text-sm text-destructive">Masukkan nominal tanpa desimal, mis. 100.000.</p>
          ) : tendered === null ? (
            <p className="text-sm text-muted-foreground">Ketik nominal atau pilih tombol di atas.</p>
          ) : !enough ? (
            <p className="text-sm font-medium text-destructive">Kurang {formatRupiah(total - tendered)}</p>
          ) : (
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted-foreground">Kembalian</span>
              <span className={cn("money text-2xl font-extrabold", change === 0 && "text-muted-foreground")}>{formatRupiah(change!)}</span>
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" variant="highlight" size="lg" className="h-14 w-full text-base" disabled={!enough || pending}>
          {pending ? "Menyimpan transaksi..." : "Selesaikan transaksi"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Pembayaran QRIS dan kartu menyusul di fase berikutnya.</p>
      </div>
    </form>
  );
}

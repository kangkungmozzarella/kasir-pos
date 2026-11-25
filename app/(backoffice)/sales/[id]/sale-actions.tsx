"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { PrinterIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatRupiah } from "@/lib/format";
import { printReceipt } from "@/lib/print-receipt";
import { voidSaleAction } from "../actions";

type Props = {
  saleId: string;
  invoiceNo: string;
  canVoid: boolean;
  /** Alasan tidak bisa di-void (null = boleh). */
  blocker: string | null;
  cashToReturn: number;
  nonCashToReturn: number;
  hasReceipt: boolean;
};

export function SaleActions({ saleId, invoiceNo, canVoid, blocker, cashToReturn, nonCashToReturn, hasReceipt }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const reasonId = useId();

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const res = await voidSaleAction(saleId, reason);
      if (!res.ok) return setError(res.error);
      setOpen(false);
      const { cashRefund, providerRefund } = res.result;
      toast.success(`Transaksi ${invoiceNo} dibatalkan. Stok dikembalikan.`, {
        description: [
          cashRefund > 0 && `Kembalikan uang tunai ${formatRupiah(cashRefund)} ke pembeli.`,
          providerRefund > 0 && `${formatRupiah(providerRefund)} dikembalikan lewat QRIS/kartu.`,
        ]
          .filter(Boolean)
          .join(" "),
        duration: 10_000,
      });
    });
  }

  return (
    <div className="mt-2 border-t pt-6">
      <div className="flex flex-wrap gap-2">
        {hasReceipt && (
          <>
            <Button variant="outline" className="gap-2" onClick={() => printReceipt(saleId)}>
              <PrinterIcon className="size-5" aria-hidden />
              Cetak ulang struk
            </Button>
            <Link href={`/receipt/${saleId}`} className={buttonVariants({ variant: "ghost" })}>
              Lihat struk
            </Link>
          </>
        )}
        {canVoid && !blocker && (
          <Button variant="destructive" className="sm:ml-auto" onClick={() => setOpen(true)}>
            Batalkan transaksi
          </Button>
        )}
      </div>
      {canVoid && blocker && (
        <p className="mt-3 text-sm text-muted-foreground">Tidak bisa dibatalkan: {blocker}</p>
      )}

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batalkan transaksi {invoiceNo}?</DialogTitle>
            <DialogDescription>Pembatalan tidak bisa diurungkan. Nomor invoice tetap tercatat sebagai dibatalkan.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Stok semua barang di transaksi ini dikembalikan.</li>
            {cashToReturn > 0 && (
              <li>
                Kembalikan uang tunai <span className="money font-semibold">{formatRupiah(cashToReturn)}</span> ke pembeli.
              </li>
            )}
            {nonCashToReturn > 0 && (
              <li>
                <span className="money font-semibold">{formatRupiah(nonCashToReturn)}</span> dikembalikan ke pembeli lewat QRIS/kartu (simulasi).
              </li>
            )}
          </ul>
          <div className="grid gap-1.5">
            <label htmlFor={reasonId} className="text-sm font-medium">
              Alasan pembatalan
            </label>
            <Textarea
              id={reasonId}
              rows={3}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mis. kasir salah memasukkan jumlah barang"
              aria-invalid={!!error || undefined}
              aria-describedby={`${reasonId}-hint`}
            />
            <p id={`${reasonId}-hint`} className={error ? "text-sm text-destructive" : "text-xs text-muted-foreground"} role={error ? "alert" : undefined}>
              {error ?? "Wajib diisi. Alasan tercatat untuk audit."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Jangan batalkan
            </Button>
            <Button variant="destructive" onClick={submit} disabled={pending}>
              {pending ? "Membatalkan..." : "Batalkan transaksi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

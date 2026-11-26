"use client";

import { useRef } from "react";
import Link from "next/link";
import { PrinterIcon } from "@phosphor-icons/react";
import { ReceiptWidthToggle } from "@/components/receipt/receipt-width-toggle";
import { useReceiptWidth } from "@/components/receipt/use-receipt-width";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatRupiah } from "@/lib/format";
import { printReceipt } from "@/lib/print-receipt";

export type DoneSale = { saleId: string; invoiceNo: string; total: number; change: number };

export function DoneDialog({
  sale,
  onNext,
  returnFocus,
}: {
  sale: DoneSale | null;
  onNext: () => void;
  returnFocus: React.RefObject<HTMLElement | null>;
}) {
  const [width, setWidth] = useReceiptWidth();
  const nextRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onNext()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false} initialFocus={nextRef} finalFocus={returnFocus}>
        {sale && (
          <>
            <div>
              <DialogTitle className="text-base">Transaksi selesai</DialogTitle>
              <DialogDescription>
                {sale.invoiceNo} · total {formatRupiah(sale.total)}
              </DialogDescription>
            </div>
            <div className="rounded-lg bg-muted px-4 py-4">
              <p className="text-sm text-muted-foreground">Kembalian</p>
              <p className="money text-4xl font-extrabold tracking-tight">{formatRupiah(sale.change)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={() => printReceipt(sale.saleId)}>
                <PrinterIcon className="size-5" aria-hidden />
                Cetak struk
              </Button>
              <ReceiptWidthToggle value={width} onChange={setWidth} />
              <Link
                href={`/receipt/${sale.saleId}`}
                target="_blank"
                className="ml-auto rounded text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Lihat struk
              </Link>
            </div>
            <Button ref={nextRef} size="lg" onClick={onNext} className="h-14 text-base">
              Transaksi baru
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

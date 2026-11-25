"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { printReceipt } from "@/lib/print-receipt";
import type { PosShift, RecentSale } from "./types";

export function HistoryDialog({
  open,
  onOpenChange,
  sales,
  shift,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sales: RecentSale[];
  shift: PosShift;
  returnFocus: React.RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" finalFocus={returnFocus}>
        <div>
          <DialogTitle className="text-base">Transaksi shift ini</DialogTitle>
          <DialogDescription>
            Shift dibuka {formatDateTime(shift.openedAt)} · {shift.saleCount} transaksi
            {shift.saleCount > sales.length ? ` · ${sales.length} terakhir ditampilkan` : ""}
          </DialogDescription>
        </div>
        {sales.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Belum ada transaksi di shift ini.
          </p>
        ) : (
          <ul className="-mx-4 divide-y border-y">
            {sales.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/receipt/${s.id}`}
                    target="_blank"
                    className="money block truncate text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {s.invoiceNo}
                  </Link>
                  <p className="money text-xs text-muted-foreground">
                    {formatDateTime(s.createdAt)} · {s.itemCount} jenis barang
                  </p>
                </div>
                <p className="money text-sm font-semibold">{formatRupiah(s.total)}</p>
                <Button variant="outline" onClick={() => printReceipt(s.id)} aria-label={`Cetak ulang struk ${s.invoiceNo}`}>
                  Cetak ulang
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

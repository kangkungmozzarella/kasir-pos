"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PrinterIcon } from "@phosphor-icons/react";
import { Receipt, type ReceiptData } from "@/components/receipt/receipt";
import { ReceiptWidthToggle } from "@/components/receipt/receipt-width-toggle";
import { useReceiptWidth } from "@/components/receipt/use-receipt-width";
import { Button, buttonVariants } from "@/components/ui/button";

export function ReceiptView({ data, embed, backHref }: { data: ReceiptData; embed: boolean; backHref: string }) {
  const [width, setWidth] = useReceiptWidth();

  return (
    <>
      {/* Ukuran kertas untuk dialog cetak browser, mengikuti pilihan lebar. */}
      <style>{`@page { size: ${width}mm auto; margin: 0 }`}</style>

      {!embed && (
        <div className="print:hidden mx-auto flex max-w-md flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href={backHref} className={buttonVariants({ variant: "ghost" })}>
            Kembali
          </Link>
          <div className="flex items-center gap-2">
            <ReceiptWidthToggle value={width} onChange={setWidth} />
            <Button onClick={() => window.print()} className="gap-2">
              <PrinterIcon className="size-5" aria-hidden />
              Cetak
            </Button>
          </div>
        </div>
      )}

      <div className={embed ? "" : "flex justify-center px-4 pb-10 print:p-0"}>
        <div className={embed ? "p-[2mm]" : "rounded-md border bg-white p-[3mm] shadow-sm print:border-0 print:p-[2mm] print:shadow-none"}>
          <Receipt data={data} width={width} />
        </div>
      </div>
      {embed && <PrintOnReady />}
    </>
  );
}

/** Mode embed (iframe dari layar kasir): langsung buka dialog cetak setelah tampil. */
function PrintOnReady() {
  useEffect(() => {
    const id = window.setTimeout(() => window.print(), 50);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}

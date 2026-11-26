"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { PrinterIcon, UsbIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Receipt, type ReceiptData } from "@/components/receipt/receipt";
import { ReceiptWidthToggle } from "@/components/receipt/receipt-width-toggle";
import { useReceiptWidth } from "@/components/receipt/use-receipt-width";
import { Button, buttonVariants } from "@/components/ui/button";
import { receiptToEscPos } from "@/lib/escpos";
import { isSerialSupported, printViaSerial, SerialPrintError } from "@/lib/web-serial";

const noopSubscribe = () => () => {};

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
          <EscPosTools data={data} width={width} />
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

/**
 * Cetak langsung ke printer thermal USB (ESC/POS lewat Web Serial) dan pratinjau teksnya.
 * Tombol USB hanya muncul di browser yang mendukung Web Serial; pratinjau selalu ada
 * supaya hasilnya bisa diperiksa tanpa printer.
 */
function EscPosTools({ data, width }: { data: ReceiptData; width: "58" | "80" }) {
  const supported = useSyncExternalStore(noopSubscribe, isSerialSupported, () => false);
  const [printing, setPrinting] = useState(false);
  const escpos = useMemo(() => receiptToEscPos(data, width === "58" ? 32 : 48), [data, width]);

  async function printUsb() {
    setPrinting(true);
    try {
      await printViaSerial(escpos.bytes);
      toast.success("Struk dikirim ke printer.");
    } catch (err) {
      toast.error(err instanceof SerialPrintError ? err.message : "Gagal mengirim ke printer.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="w-full">
      {supported && (
        <Button variant="outline" className="mb-2 w-full gap-2 sm:w-auto" onClick={printUsb} disabled={printing}>
          <UsbIcon className="size-5" aria-hidden />
          {printing ? "Mengirim ke printer..." : "Cetak ke printer USB"}
        </Button>
      )}
      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-md font-medium text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Pratinjau printer thermal (ESC/POS, {width === "58" ? 32 : 48} kolom)
        </summary>
        <pre aria-label="Pratinjau ESC/POS" className="mt-2 overflow-x-auto rounded-md border bg-white p-3 font-mono text-[12px] leading-snug text-black">
          {escpos.text}
        </pre>
        <p className="mt-1 text-xs text-muted-foreground">{escpos.bytes.length} byte perintah ESC/POS.</p>
      </details>
    </div>
  );
}

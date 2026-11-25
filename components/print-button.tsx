"use client";

import { PrinterIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function PrintButton({ children = "Cetak" }: { children?: React.ReactNode }) {
  return (
    <Button variant="outline" className="gap-2 print:hidden" onClick={() => window.print()}>
      <PrinterIcon className="size-5" aria-hidden />
      {children}
    </Button>
  );
}

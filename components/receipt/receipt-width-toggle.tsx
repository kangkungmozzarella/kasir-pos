"use client";

import { cn } from "@/lib/utils";
import type { ReceiptWidth } from "./receipt";

export function ReceiptWidthToggle({ value, onChange }: { value: ReceiptWidth; onChange: (w: ReceiptWidth) => void }) {
  return (
    <div role="radiogroup" aria-label="Lebar kertas struk" className="inline-flex rounded-lg border bg-card p-0.5">
      {(["58", "80"] as const).map((w) => (
        <button
          key={w}
          type="button"
          role="radio"
          aria-checked={value === w}
          onClick={() => onChange(w)}
          className={cn(
            "h-10 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {w} mm
        </button>
      ))}
    </div>
  );
}

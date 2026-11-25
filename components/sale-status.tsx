import type { SaleStatus } from "@/generated/prisma/enums";
import { formatRupiah } from "@/lib/format";
import { SALE_STATUS_LABEL } from "@/lib/sale-labels";
import type { CashDifference } from "@/lib/shift-math";
import { cn } from "@/lib/utils";

/** Status transaksi sebagai teks berwarna; arti tidak bergantung pada warna saja. */
export function SaleStatusBadge({ status, className }: { status: SaleStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        status === "COMPLETED" && "bg-success/10 text-success",
        status === "VOIDED" && "bg-destructive/10 text-destructive",
        status === "PENDING_PAYMENT" && "bg-secondary text-secondary-foreground ring-1 ring-border",
        className,
      )}
    >
      {SALE_STATUS_LABEL[status]}
    </span>
  );
}

/** "Pas", "Lebih Rp 2.000", "Kurang Rp 5.000". */
export function differenceText(d: CashDifference): string {
  if (d.kind === "pas") return "Pas";
  return `${d.kind === "lebih" ? "Lebih" : "Kurang"} ${formatRupiah(Math.abs(d.amount))}`;
}

export function CashDifferenceText({ difference, className }: { difference: CashDifference; className?: string }) {
  return (
    <span className={cn("money font-semibold", difference.kind === "kurang" && "text-destructive", difference.kind === "pas" && "text-success", className)}>
      {differenceText(difference)}
    </span>
  );
}

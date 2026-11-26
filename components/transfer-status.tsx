import type { TransferStatus } from "@/generated/prisma/enums";
import { TRANSFER_STATUS_LABEL } from "@/lib/transfer-labels";
import { cn } from "@/lib/utils";

export function TransferStatusBadge({ status, className }: { status: TransferStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        status === "RECEIVED" && "bg-success/10 text-success",
        status === "CANCELLED" && "bg-muted text-muted-foreground",
        status === "SENT" && "bg-primary text-primary-foreground",
        status === "DRAFT" && "bg-secondary text-secondary-foreground ring-1 ring-border",
        className,
      )}
    >
      {TRANSFER_STATUS_LABEL[status]}
    </span>
  );
}

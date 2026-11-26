import type { TransferStatus } from "@/generated/prisma/enums";

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  DRAFT: "Draf",
  SENT: "Dalam perjalanan",
  RECEIVED: "Diterima",
  CANCELLED: "Dibatalkan",
};

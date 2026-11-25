import type { StockMovementType } from "@/generated/prisma/enums";

export const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  PURCHASE: "Barang masuk",
  SALE: "Terjual",
  VOID_RETURN: "Batal transaksi",
  ADJUSTMENT: "Stok opname",
  TRANSFER_OUT: "Kirim ke cabang lain",
  TRANSFER_IN: "Terima dari cabang lain",
};

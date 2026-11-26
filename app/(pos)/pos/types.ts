export type PosProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  /** Harga efektif di cabang ini (harga khusus cabang bila ada). */
  price: number;
  stock: number;
  categoryId: string | null;
};

export type PosCategory = { id: string; name: string };

export type PosShift = {
  id: string;
  openedAt: Date;
  branchName: string;
  taxRate: number;
  saleCount: number;
};

export type RecentSale = { id: string; invoiceNo: string; createdAt: Date; total: number; itemCount: number };

export type CheckoutResponse =
  | { ok: true; saleId: string; invoiceNo: string; total: number; change: number }
  | { ok: false; error: string };

export type SwitchCandidate = { id: string; name: string; role: "CASHIER" | "ADMIN" | "OWNER"; locked: boolean };

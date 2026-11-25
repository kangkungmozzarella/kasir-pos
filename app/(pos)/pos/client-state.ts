import type { SaleState } from "@/lib/sale-flow";

/** Bentuk SaleState yang aman dikirim sebagai JSON (tanggal jadi string ISO). */
export type ClientPayment = Omit<SaleState["payments"][number], "expiresAt"> & { expiresAt: string | null };
export type ClientSaleState = Omit<SaleState, "payments" | "active"> & {
  payments: ClientPayment[];
  active: ClientPayment | null;
};

export function toClientState(state: SaleState): ClientSaleState {
  const conv = (p: SaleState["payments"][number]): ClientPayment => ({ ...p, expiresAt: p.expiresAt?.toISOString() ?? null });
  return { ...state, payments: state.payments.map(conv), active: state.active ? conv(state.active) : null };
}

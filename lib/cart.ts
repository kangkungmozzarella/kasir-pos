/**
 * State keranjang di layar kasir. Murni (tanpa React) supaya mudah diuji.
 * Angka yang tampil hanya pratinjau; server menghitung ulang saat checkout.
 */

export type CartLine = { productId: string; qty: number; discount: number };

export type CartState = {
  lines: CartLine[];
  transactionDiscount: number;
  /** Baris yang terakhir disentuh; target tombol + dan -. */
  selectedId: string | null;
};

export type CartAction =
  | { type: "add"; productId: string; max: number }
  | { type: "setQty"; productId: string; qty: number; max: number }
  | { type: "step"; productId: string; delta: 1 | -1; max: number }
  | { type: "remove"; productId: string }
  | { type: "setDiscount"; productId: string; discount: number; unitPrice: number }
  | { type: "setTransactionDiscount"; amount: number }
  | { type: "select"; productId: string }
  | { type: "clear" };

export const emptyCart: CartState = { lines: [], transactionDiscount: 0, selectedId: null };

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add": {
      if (action.max <= 0) return state;
      const existing = state.lines.find((l) => l.productId === action.productId);
      const lines = existing
        ? state.lines.map((l) => (l.productId === action.productId ? { ...l, qty: Math.min(l.qty + 1, action.max) } : l))
        : [...state.lines, { productId: action.productId, qty: 1, discount: 0 }];
      return { ...state, lines, selectedId: action.productId };
    }
    case "setQty": {
      if (!Number.isInteger(action.qty)) return state;
      if (action.qty <= 0) return cartReducer(state, { type: "remove", productId: action.productId });
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.productId === action.productId ? { ...l, qty: clamp(action.qty, 1, Math.max(action.max, 1)) } : l,
        ),
        selectedId: action.productId,
      };
    }
    case "step": {
      const line = state.lines.find((l) => l.productId === action.productId);
      if (!line) return state;
      return cartReducer(state, { type: "setQty", productId: action.productId, qty: line.qty + action.delta, max: action.max });
    }
    case "remove": {
      const lines = state.lines.filter((l) => l.productId !== action.productId);
      const selectedId = state.selectedId === action.productId ? (lines.at(-1)?.productId ?? null) : state.selectedId;
      return { ...state, lines, selectedId };
    }
    case "setDiscount":
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.productId === action.productId
            ? { ...l, discount: clamp(Math.trunc(action.discount) || 0, 0, action.unitPrice * l.qty) }
            : l,
        ),
      };
    case "setTransactionDiscount":
      return { ...state, transactionDiscount: Math.max(0, Math.trunc(action.amount) || 0) };
    case "select":
      return { ...state, selectedId: action.productId };
    case "clear":
      return emptyCart;
  }
}

/** Diskon baris bisa jadi terlalu besar setelah qty dikurangi; rapikan sebelum dihitung. */
export function normalizeDiscounts(lines: CartLine[], priceOf: (id: string) => number): CartLine[] {
  return lines.map((l) => ({ ...l, discount: Math.min(l.discount, priceOf(l.productId) * l.qty) }));
}

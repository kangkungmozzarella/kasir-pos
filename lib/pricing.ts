/**
 * Perhitungan harga murni (tanpa I/O). Dipakai server saat checkout dan oleh seed,
 * sehingga angka di database selalu dihitung dengan rumus yang sama.
 *
 * Semua nominal adalah integer Rupiah. Harga belum termasuk pajak.
 */

export type LineInput = {
  unitPrice: number;
  qty: number;
  /** Potongan untuk seluruh baris (bukan per unit). */
  discount?: number;
};

export type LineResult = {
  unitPrice: number;
  qty: number;
  discount: number;
  lineTotal: number;
};

export type Totals = {
  lines: LineResult[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
};

export class PricingError extends Error {}

function assertInt(value: number, label: string, { min = 0 }: { min?: number } = {}) {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new PricingError(`${label} harus bilangan bulat ≥ ${min}, dapat ${value}`);
  }
}

export function computeLine({ unitPrice, qty, discount = 0 }: LineInput): LineResult {
  assertInt(unitPrice, "Harga satuan");
  assertInt(qty, "Jumlah", { min: 1 });
  assertInt(discount, "Diskon baris");
  const gross = unitPrice * qty;
  if (discount > gross) {
    throw new PricingError(`Diskon baris (${discount}) melebihi harga baris (${gross})`);
  }
  return { unitPrice, qty, discount, lineTotal: gross - discount };
}

/** round(amount × rate / 100) ke rupiah terdekat, setengah dibulatkan ke atas. Tanpa float. */
export function percentOf(amount: number, ratePercent: number): number {
  assertInt(amount, "Dasar pajak");
  assertInt(ratePercent, "Tarif pajak");
  return Math.floor((amount * ratePercent + 50) / 100);
}

export function computeTotals(
  lineInputs: LineInput[],
  { taxRate, transactionDiscount = 0 }: { taxRate: number; transactionDiscount?: number },
): Totals {
  if (lineInputs.length === 0) throw new PricingError("Keranjang kosong");
  assertInt(transactionDiscount, "Diskon transaksi");

  const lines = lineInputs.map(computeLine);
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  if (transactionDiscount > subtotal) {
    throw new PricingError(`Diskon transaksi (${transactionDiscount}) melebihi subtotal (${subtotal})`);
  }

  const taxTotal = percentOf(subtotal - transactionDiscount, taxRate);
  return {
    lines,
    subtotal,
    discountTotal: transactionDiscount,
    taxTotal,
    total: subtotal - transactionDiscount + taxTotal,
  };
}

/** Harga efektif di cabang: harga khusus cabang bila ada, selain itu harga produk. */
export function effectivePrice(productPrice: number, priceOverride: number | null | undefined): number {
  return priceOverride ?? productPrice;
}

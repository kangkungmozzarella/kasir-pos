import { describe, expect, it } from "vitest";
import { computeLine, computeTotals, effectivePrice, percentOf, PricingError } from "./pricing";

describe("computeLine", () => {
  it("mengalikan harga dan jumlah lalu mengurangi diskon baris", () => {
    expect(computeLine({ unitPrice: 3500, qty: 4, discount: 1000 })).toEqual({
      unitPrice: 3500,
      qty: 4,
      discount: 1000,
      lineTotal: 13000,
    });
  });

  it("menolak diskon yang melebihi harga baris", () => {
    expect(() => computeLine({ unitPrice: 3500, qty: 1, discount: 3501 })).toThrow(PricingError);
  });

  it("menolak jumlah nol, negatif, dan pecahan", () => {
    expect(() => computeLine({ unitPrice: 1000, qty: 0 })).toThrow(PricingError);
    expect(() => computeLine({ unitPrice: 1000, qty: -1 })).toThrow(PricingError);
    expect(() => computeLine({ unitPrice: 1000, qty: 1.5 })).toThrow(PricingError);
  });

  it("menolak harga pecahan (uang harus integer rupiah)", () => {
    expect(() => computeLine({ unitPrice: 999.5, qty: 1 })).toThrow(PricingError);
  });
});

describe("percentOf", () => {
  it("membulatkan ke rupiah terdekat", () => {
    expect(percentOf(10000, 11)).toBe(1100);
    expect(percentOf(12345, 11)).toBe(1358); // 1357,95
    expect(percentOf(150, 11)).toBe(17); // 16,5 dibulatkan ke atas
    expect(percentOf(140, 11)).toBe(15); // 15,4
  });

  it("tarif nol menghasilkan nol", () => {
    expect(percentOf(98765, 0)).toBe(0);
  });
});

describe("computeTotals", () => {
  it("menghitung subtotal, diskon transaksi, pajak, dan total", () => {
    const t = computeTotals(
      [
        { unitPrice: 78000, qty: 1 },
        { unitPrice: 3500, qty: 5, discount: 500 },
      ],
      { taxRate: 11, transactionDiscount: 5000 },
    );
    expect(t.subtotal).toBe(95000);
    expect(t.discountTotal).toBe(5000);
    expect(t.taxTotal).toBe(9900); // 11% dari 90.000
    expect(t.total).toBe(99900);
  });

  it("pajak dihitung setelah diskon transaksi", () => {
    const t = computeTotals([{ unitPrice: 10000, qty: 1 }], { taxRate: 10, transactionDiscount: 10000 });
    expect(t.taxTotal).toBe(0);
    expect(t.total).toBe(0);
  });

  it("menolak keranjang kosong", () => {
    expect(() => computeTotals([], { taxRate: 11 })).toThrow(PricingError);
  });

  it("menolak diskon transaksi yang melebihi subtotal", () => {
    expect(() => computeTotals([{ unitPrice: 1000, qty: 1 }], { taxRate: 11, transactionDiscount: 1001 })).toThrow(
      PricingError,
    );
  });

  it("semua hasil tetap integer", () => {
    const t = computeTotals(
      [
        { unitPrice: 3333, qty: 3 },
        { unitPrice: 777, qty: 7, discount: 13 },
      ],
      { taxRate: 11, transactionDiscount: 7 },
    );
    for (const v of [t.subtotal, t.discountTotal, t.taxTotal, t.total]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe("effectivePrice", () => {
  it("memakai harga cabang bila ada", () => {
    expect(effectivePrice(10000, 10500)).toBe(10500);
  });
  it("kembali ke harga produk bila harga cabang kosong", () => {
    expect(effectivePrice(10000, null)).toBe(10000);
    expect(effectivePrice(10000, undefined)).toBe(10000);
  });
  it("harga cabang 0 tetap dihormati (bukan dianggap kosong)", () => {
    expect(effectivePrice(10000, 0)).toBe(0);
  });
});

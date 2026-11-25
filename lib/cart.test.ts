import { describe, expect, it } from "vitest";
import { cartReducer, emptyCart, normalizeDiscounts, type CartState } from "./cart";
import { quickAmounts } from "./cash";
import { formatInvoiceNo } from "./invoice";

const run = (...actions: Parameters<typeof cartReducer>[1][]) => actions.reduce<CartState>(cartReducer, emptyCart);

describe("cartReducer", () => {
  it("menambah produk yang sama menaikkan jumlah, bukan baris baru", () => {
    const s = run({ type: "add", productId: "a", max: 10 }, { type: "add", productId: "a", max: 10 });
    expect(s.lines).toEqual([{ productId: "a", qty: 2, discount: 0 }]);
    expect(s.selectedId).toBe("a");
  });

  it("tidak melebihi stok yang tersedia", () => {
    const s = run({ type: "add", productId: "a", max: 1 }, { type: "add", productId: "a", max: 1 });
    expect(s.lines[0].qty).toBe(1);
  });

  it("produk dengan stok habis tidak masuk keranjang", () => {
    expect(run({ type: "add", productId: "a", max: 0 }).lines).toEqual([]);
  });

  it("mengurangi ke nol menghapus baris dan memindahkan pilihan", () => {
    const s = run(
      { type: "add", productId: "a", max: 5 },
      { type: "add", productId: "b", max: 5 },
      { type: "step", productId: "b", delta: -1, max: 5 },
    );
    expect(s.lines.map((l) => l.productId)).toEqual(["a"]);
    expect(s.selectedId).toBe("a");
  });

  it("diskon baris dibatasi antara 0 dan harga baris", () => {
    let s = run({ type: "add", productId: "a", max: 5 }, { type: "setQty", productId: "a", qty: 2, max: 5 });
    s = cartReducer(s, { type: "setDiscount", productId: "a", discount: 99999, unitPrice: 3500 });
    expect(s.lines[0].discount).toBe(7000);
    s = cartReducer(s, { type: "setDiscount", productId: "a", discount: -5, unitPrice: 3500 });
    expect(s.lines[0].discount).toBe(0);
  });

  it("jumlah pecahan diabaikan", () => {
    const s = run({ type: "add", productId: "a", max: 5 }, { type: "setQty", productId: "a", qty: 1.5, max: 5 });
    expect(s.lines[0].qty).toBe(1);
  });

  it("clear mengosongkan semuanya", () => {
    const s = run({ type: "add", productId: "a", max: 5 }, { type: "setTransactionDiscount", amount: 1000 }, { type: "clear" });
    expect(s).toEqual(emptyCart);
  });
});

describe("normalizeDiscounts", () => {
  it("memangkas diskon yang melebihi harga baris setelah qty turun", () => {
    const lines = [{ productId: "a", qty: 1, discount: 5000 }];
    expect(normalizeDiscounts(lines, () => 3500)[0].discount).toBe(3500);
  });
});

describe("formatInvoiceNo", () => {
  it("memakai nol di depan sampai 4 digit", () => {
    expect(formatInvoiceNo("MDN01", "20261125", 7)).toBe("MDN01-20261125-0007");
    expect(formatInvoiceNo("MDN01", "20261125", 12345)).toBe("MDN01-20261125-12345");
  });
  it("menolak input tidak valid", () => {
    expect(() => formatInvoiceNo("MDN01", "2026-11-25", 1)).toThrow();
    expect(() => formatInvoiceNo("MDN01", "20261125", 0)).toThrow();
  });
});

describe("quickAmounts", () => {
  it("menawarkan 50.000 dan 100.000 untuk belanja kecil", () => {
    expect(quickAmounts(44_955)).toEqual([50_000, 100_000]);
  });
  it("menawarkan pembulatan ke atas untuk belanja besar", () => {
    expect(quickAmounts(158_180)).toEqual([160_000, 200_000]);
    expect(quickAmounts(12_300)).toEqual([20_000, 50_000, 100_000]);
  });
  it("tidak menawarkan nominal yang sama dengan total (itu tombol Uang pas)", () => {
    expect(quickAmounts(50_000)).toEqual([100_000]);
  });
});

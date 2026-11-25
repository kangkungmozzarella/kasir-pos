import { describe, expect, it } from "vitest";
import { parseRupiah, productSchema, stockOpnameSchema, userCreateSchema } from "./validation";

describe("parseRupiah", () => {
  it.each([
    ["12500", 12500],
    ["12.500", 12500],
    ["Rp 12.500", 12500],
    ["rp12.500", 12500],
    ["1.250.000", 1250000],
    ["0", 0],
  ])("%s -> %d", (input, expected) => {
    expect(parseRupiah(input)).toBe(expected);
  });

  it.each(["12,5", "12.50", "abc", "", "-500", "1.2345", "12 500x"])("menolak %s", (input) => {
    expect(parseRupiah(input)).toBeNull();
  });
});

const validProduct = {
  name: "Gula Pasir 1 kg",
  sku: "SKU-0100",
  barcode: "",
  unit: "pcs",
  price: "18.500",
  cost: "16800",
  categoryId: "",
  isActive: "on",
};

describe("productSchema", () => {
  it("mengubah input form menjadi data siap simpan", () => {
    expect(productSchema.parse(validProduct)).toEqual({
      name: "Gula Pasir 1 kg",
      sku: "SKU-0100",
      barcode: null,
      unit: "pcs",
      price: 18500,
      cost: 16800,
      categoryId: null,
      isActive: true,
    });
  });

  it("checkbox yang tidak dicentang berarti nonaktif", () => {
    expect(productSchema.parse({ ...validProduct, isActive: undefined }).isActive).toBe(false);
  });

  it("menolak barcode EAN-13 dengan digit cek salah", () => {
    expect(productSchema.safeParse({ ...validProduct, barcode: "2000000000011" }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, barcode: "2000000000015" }).success).toBe(true);
  });

  it("menolak harga pecahan", () => {
    const r = productSchema.safeParse({ ...validProduct, price: "18.500,50" });
    expect(r.success).toBe(false);
  });
});

describe("stockOpnameSchema", () => {
  it("wajib ada alasan", () => {
    expect(stockOpnameSchema.safeParse({ counted: "10", note: "  " }).success).toBe(false);
  });
  it("menolak stok negatif", () => {
    expect(stockOpnameSchema.safeParse({ counted: "-1", note: "hitung ulang" }).success).toBe(false);
  });
});

describe("userCreateSchema", () => {
  const base = { name: "Kasir Baru", email: " Kasir@Demo.TEST ", role: "CASHIER", branchId: "b1", password: "rahasia123", pin: "" };
  it("menormalkan email dan PIN kosong", () => {
    const r = userCreateSchema.parse(base);
    expect(r.email).toBe("kasir@demo.test");
    expect(r.pin).toBeNull();
  });
  it("tidak bisa membuat akun Pemilik", () => {
    expect(userCreateSchema.safeParse({ ...base, role: "OWNER" }).success).toBe(false);
  });
  it("PIN harus 4 sampai 6 digit", () => {
    expect(userCreateSchema.safeParse({ ...base, pin: "12" }).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...base, pin: "1234" }).success).toBe(true);
  });
});

describe("rupiah kosong", () => {
  it("memberi pesan 'wajib diisi', bukan 'format salah'", () => {
    const r = productSchema.safeParse({ ...validProduct, price: "  " });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Harga jual wajib diisi.");
  });
});

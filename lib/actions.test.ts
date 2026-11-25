import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ AuthError: class extends Error {} }));
vi.mock("./stock", () => ({ StockError: class extends Error {} }));

const { uniqueTarget } = await import("./actions");

describe("uniqueTarget", () => {
  it("membaca kolom dari nama index (format driver adapter Prisma 7)", () => {
    expect(uniqueTarget({ meta: { driverAdapterError: { cause: { constraint: { index: "Product_sku_key" } } } } })).toBe("sku");
    expect(uniqueTarget({ meta: { driverAdapterError: { cause: { constraint: { index: "User_email_key" } } } } })).toBe("email");
  });
  it("mendukung format daftar kolom", () => {
    expect(uniqueTarget({ meta: { driverAdapterError: { cause: { constraint: { fields: ['"barcode"'] } } } } })).toBe("barcode");
    expect(uniqueTarget({ meta: { target: ["name"] } })).toBe("name");
  });
  it("tidak menebak bila metadata tidak dikenal", () => {
    expect(uniqueTarget({ meta: {} })).toBeUndefined();
    expect(uniqueTarget({})).toBeUndefined();
  });
});

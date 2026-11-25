import { describe, expect, it } from "vitest";
import { can, canManageUser, manageableRoles, resolveBranchScope, ScopeError } from "./permissions";

const owner = { id: "o", role: "OWNER" as const, branchId: null };
const adminA = { id: "a1", role: "ADMIN" as const, branchId: "A" };
const adminB = { id: "a2", role: "ADMIN" as const, branchId: "B" };
const cashierA = { id: "c1", role: "CASHIER" as const, branchId: "A" };
const cashierB = { id: "c2", role: "CASHIER" as const, branchId: "B" };

describe("katalog hanya oleh Pemilik", () => {
  it("Admin bisa melihat tapi tidak mengubah katalog", () => {
    expect(can("ADMIN", "catalog:view")).toBe(true);
    expect(can("ADMIN", "catalog:manage")).toBe(false);
    expect(can("OWNER", "catalog:manage")).toBe(true);
  });
  it("Kasir tidak bisa membuka katalog, stok, atau pengguna", () => {
    expect(can("CASHIER", "catalog:view")).toBe(false);
    expect(can("CASHIER", "stock:manage")).toBe(false);
    expect(can("CASHIER", "user:manage")).toBe(false);
  });
});

describe("resolveBranchScope", () => {
  it("Pemilik bebas memilih, atau semua cabang", () => {
    expect(resolveBranchScope(owner, "B")).toBe("B");
    expect(resolveBranchScope(owner)).toBeNull();
    expect(resolveBranchScope(owner, "")).toBeNull();
  });
  it("Admin selalu cabangnya sendiri", () => {
    expect(resolveBranchScope(adminA)).toBe("A");
    expect(resolveBranchScope(adminA, "A")).toBe("A");
  });
  it("Admin yang meminta cabang lain ditolak", () => {
    expect(() => resolveBranchScope(adminA, "B")).toThrow(ScopeError);
  });
});

describe("manageableRoles", () => {
  it("tidak ada yang bisa membuat Pemilik", () => {
    expect(manageableRoles("OWNER")).not.toContain("OWNER");
    expect(manageableRoles("ADMIN")).toEqual(["CASHIER"]);
    expect(manageableRoles("CASHIER")).toEqual([]);
  });
});

describe("canManageUser", () => {
  it("Admin mengelola kasir di cabangnya saja", () => {
    expect(canManageUser(adminA, cashierA)).toBe(true);
    expect(canManageUser(adminA, cashierB)).toBe(false);
    expect(canManageUser(adminA, adminB)).toBe(false);
  });
  it("Pemilik mengelola admin dan kasir di cabang mana pun", () => {
    expect(canManageUser(owner, adminB)).toBe(true);
    expect(canManageUser(owner, cashierA)).toBe(true);
  });
  it("tidak ada yang mengelola akunnya sendiri dari halaman pengguna", () => {
    expect(canManageUser(adminA, adminA)).toBe(false);
    expect(canManageUser(owner, owner)).toBe(false);
  });
  it("Kasir tidak mengelola siapa pun", () => {
    expect(canManageUser(cashierA, cashierA)).toBe(false);
    expect(canManageUser({ ...cashierA, id: "x" }, cashierA)).toBe(false);
  });
});

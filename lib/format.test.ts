import { describe, expect, it } from "vitest";
import { formatRupiah, jakartaDateKey, jakartaDayStart } from "./format";

describe("jakartaDayStart", () => {
  it("mengembalikan 00.00 WIB (17.00 UTC hari sebelumnya)", () => {
    const now = new Date("2026-11-25T03:00:00Z"); // 10.00 WIB
    expect(jakartaDayStart(0, now).toISOString()).toBe("2026-11-24T17:00:00.000Z");
    expect(jakartaDayStart(30, now).toISOString()).toBe("2026-10-25T17:00:00.000Z");
  });

  it("dini hari WIB masih dihitung tanggal Jakarta", () => {
    const now = new Date("2026-11-24T18:00:00Z"); // 25 Nov 01.00 WIB
    expect(jakartaDayStart(0, now).toISOString()).toBe("2026-11-24T17:00:00.000Z");
  });
});

describe("formatRupiah", () => {
  it("memakai pemisah ribuan titik dan tanpa desimal", () => {
    expect(formatRupiah(12500).replace(/\s/g, " ")).toBe("Rp 12.500");
    expect(formatRupiah(0).replace(/\s/g, " ")).toBe("Rp 0");
  });

  it("menolak nominal pecahan", () => {
    expect(() => formatRupiah(12.5)).toThrow();
  });
});

describe("jakartaDateKey", () => {
  it("memakai tanggal Jakarta, bukan UTC", () => {
    // 24 Nov 2026 18:30 UTC = 25 Nov 2026 01:30 WIB
    expect(jakartaDateKey(new Date("2026-11-24T18:30:00Z"))).toBe("20261125");
    expect(jakartaDateKey(new Date("2026-11-24T16:59:00Z"))).toBe("20261124");
  });
});

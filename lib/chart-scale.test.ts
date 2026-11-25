import { describe, expect, it } from "vitest";
import { formatCompact, niceTicks } from "./chart-scale";

describe("skala grafik", () => {
  it("langkah bulat yang mencakup nilai maksimum", () => {
    expect(niceTicks(930_000)).toEqual([0, 250_000, 500_000, 750_000, 1_000_000]);
    expect(niceTicks(4_100_000)).toEqual([0, 2_000_000, 4_000_000, 6_000_000]);
    expect(niceTicks(100)).toEqual([0, 25, 50, 75, 100]);
  });

  it("tanpa data: hanya garis nol", () => {
    expect(niceTicks(0)).toEqual([0]);
  });

  it("label ringkas berbahasa Indonesia", () => {
    expect(formatCompact(500_000).replace(/\s/g, " ")).toBe("500 rb");
    expect(formatCompact(1_250_000).replace(/\s/g, " ")).toBe("1,3 jt");
    expect(formatCompact(0)).toBe("0");
  });
});

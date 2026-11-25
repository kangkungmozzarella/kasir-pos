import { describe, expect, it } from "vitest";
import { cashDifference, expectedCash } from "./shift-math";

describe("kas laci", () => {
  it("kas diharapkan = modal awal + tunai bersih", () => {
    expect(expectedCash(500_000, 1_234_500)).toBe(1_734_500);
    expect(expectedCash(0, 0)).toBe(0);
  });

  it("selisih: pas, lebih, kurang", () => {
    expect(cashDifference(100_000, 100_000)).toEqual({ amount: 0, kind: "pas" });
    expect(cashDifference(102_000, 100_000)).toEqual({ amount: 2_000, kind: "lebih" });
    expect(cashDifference(95_500, 100_000)).toEqual({ amount: -4_500, kind: "kurang" });
  });
});

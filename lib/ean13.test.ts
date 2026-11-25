import { describe, expect, it } from "vitest";
import { ean13CheckDigit, isValidEan13, makeEan13 } from "./ean13";

describe("EAN-13", () => {
  it("menghitung digit cek yang benar", () => {
    // Contoh standar GS1: 400638133393 -> 1
    expect(ean13CheckDigit("400638133393")).toBe(1);
    expect(makeEan13("400638133393")).toBe("4006381333931");
  });

  it("memvalidasi kode lengkap", () => {
    expect(isValidEan13("4006381333931")).toBe(true);
    expect(isValidEan13("4006381333932")).toBe(false);
    expect(isValidEan13("123")).toBe(false);
    expect(isValidEan13("abcdefghijklm")).toBe(false);
  });

  it("menolak input selain 12 digit", () => {
    expect(() => ean13CheckDigit("12345")).toThrow();
  });
});

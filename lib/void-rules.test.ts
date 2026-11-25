import { describe, expect, it } from "vitest";
import { voidBlocker } from "./void-rules";

// 25 Nov 2026 10.00 WIB
const now = new Date("2026-11-25T03:00:00Z");

describe("aturan void", () => {
  it("shift masih terbuka: boleh, walau transaksinya kemarin", () => {
    expect(voidBlocker({ status: "COMPLETED", shiftStatus: "OPEN", createdAt: new Date("2026-11-24T15:00:00Z") }, now)).toBeNull();
  });

  it("shift tertutup tapi transaksi hari ini (WIB): boleh", () => {
    // 00.30 WIB tanggal 25, masih 24 Nov menurut UTC
    expect(voidBlocker({ status: "COMPLETED", shiftStatus: "CLOSED", createdAt: new Date("2026-11-24T17:30:00Z") }, now)).toBeNull();
  });

  it("shift tertutup dan transaksi kemarin (WIB): ditolak", () => {
    // 23.30 WIB tanggal 24
    expect(voidBlocker({ status: "COMPLETED", shiftStatus: "CLOSED", createdAt: new Date("2026-11-24T16:30:00Z") }, now)).toMatch(
      /hari sebelumnya/,
    );
  });

  it("transaksi yang sudah dibatalkan tidak bisa di-void lagi", () => {
    expect(voidBlocker({ status: "VOIDED", shiftStatus: "OPEN", createdAt: now }, now)).toMatch(/sudah dibatalkan/);
  });
});

import { describe, expect, it } from "vitest";
import { afterFailure, lockRemaining, PIN_LOCK_MS } from "./pin-rules";

const now = new Date("2026-11-26T03:00:00Z");

describe("aturan PIN", () => {
  it("sisa percobaan berkurang; percobaan kelima mengunci 5 menit", () => {
    let s = { failedCount: 0, lockedUntil: null as Date | null };
    for (const left of [4, 3, 2, 1]) {
      const r = afterFailure(s, now);
      expect(r).toMatchObject({ remaining: left, locked: false });
      s = r;
    }
    const last = afterFailure(s, now);
    expect(last.locked).toBe(true);
    expect(last.lockedUntil!.getTime() - now.getTime()).toBe(PIN_LOCK_MS);
    expect(lockRemaining(last, now)).toBe(PIN_LOCK_MS);
  });

  it("setelah kunci lewat, hitungan mulai dari awal", () => {
    const expired = { failedCount: 0, lockedUntil: new Date(now.getTime() - 1) };
    expect(lockRemaining(expired, now)).toBe(0);
    expect(afterFailure(expired, now)).toMatchObject({ failedCount: 1, remaining: 4, lockedUntil: null });
  });
});

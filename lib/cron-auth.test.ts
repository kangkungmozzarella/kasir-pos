import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "./cron-auth";

const secret = "rahasia-cron-yang-cukup-panjang";

describe("otorisasi cron", () => {
  it("hanya Bearer dengan rahasia yang tepat", () => {
    expect(isAuthorizedCron(`Bearer ${secret}`, secret)).toBe(true);
    expect(isAuthorizedCron(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isAuthorizedCron(secret, secret)).toBe(false);
    expect(isAuthorizedCron(null, secret)).toBe(false);
  });

  it("rahasia belum diatur atau terlalu pendek selalu ditolak", () => {
    expect(isAuthorizedCron("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer pendek", "pendek")).toBe(false);
  });
});

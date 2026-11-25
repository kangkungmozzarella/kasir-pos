import { describe, expect, it } from "vitest";
import { isDeclinedAmount, MockProvider } from "./mock";
import { WebhookError } from "./provider";
import { sign, SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from "./signature";

const SECRET = "rahasia-uji-yang-cukup-panjang";
const now = 1_790_000_000;

describe("tanda tangan webhook", () => {
  const body = JSON.stringify({ providerRef: "MOCK-QR-1", status: "PAID" });

  it("menerima tanda tangan yang benar", () => {
    expect(verify(SECRET, { signature: sign(SECRET, now, body), timestamp: String(now), body }, now)).toEqual({ ok: true });
  });

  it("menolak body yang diubah setelah ditandatangani", () => {
    const sig = sign(SECRET, now, body);
    const tampered = body.replace("PAID", "FAILED");
    expect(verify(SECRET, { signature: sig, timestamp: String(now), body: tampered }, now)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("menolak secret yang salah", () => {
    expect(verify(SECRET, { signature: sign("secret-lain-yang-panjang", now, body), timestamp: String(now), body }, now).ok).toBe(false);
  });

  it("menolak webhook lama (replay) dan header yang hilang", () => {
    const old = now - 10 * 60;
    expect(verify(SECRET, { signature: sign(SECRET, old, body), timestamp: String(old), body }, now)).toEqual({ ok: false, reason: "stale" });
    expect(verify(SECRET, { signature: null, timestamp: String(now), body }, now)).toEqual({ ok: false, reason: "missing" });
    expect(verify(SECRET, { signature: "zz", timestamp: String(now), body }, now)).toEqual({ ok: false, reason: "mismatch" });
  });
});

describe("MockProvider", () => {
  const provider = new MockProvider({ secret: SECRET, appUrl: "https://kasir.test/", terminalDelay: () => 0 });

  it("QRIS berisi URL simulator dan kedaluwarsa 5 menit", async () => {
    const before = Date.now();
    const qr = await provider.createQris({ paymentId: "p1", amount: 10_000 });
    expect(qr.qrString).toBe(`https://kasir.test/simulator/pay/${qr.providerRef}`);
    expect(qr.expiresAt.getTime() - before).toBeGreaterThanOrEqual(5 * 60 * 1000 - 5);
  });

  it("kartu dengan nominal berakhiran 13 ditolak, lainnya disetujui", async () => {
    expect(isDeclinedAmount(10_013)).toBe(true);
    expect(isDeclinedAmount(10_113)).toBe(true);
    expect(isDeclinedAmount(10_130)).toBe(false);
    const declined = await provider.chargeCard({ paymentId: "p", amount: 25_013 });
    expect(declined.status).toBe("FAILED");
    const ok = await provider.chargeCard({ paymentId: "p", amount: 25_000 });
    expect(ok.status).toBe("PAID");
    expect(ok.cardLast4).toMatch(/^\d{4}$/);
    expect(ok.approvalCode).toMatch(/^\d{6}$/);
  });

  it("verifyWebhook menolak request tanpa tanda tangan yang sah", async () => {
    const body = JSON.stringify({ providerRef: "MOCK-QR-1", status: "PAID" });
    const bad = new Request("https://kasir.test/api/mock-provider/webhook", { method: "POST", body });
    await expect(provider.verifyWebhook(bad)).rejects.toBeInstanceOf(WebhookError);

    const ts = Math.floor(Date.now() / 1000);
    const good = new Request("https://kasir.test/api/mock-provider/webhook", {
      method: "POST",
      body,
      headers: { [SIGNATURE_HEADER]: sign(SECRET, ts, body), [TIMESTAMP_HEADER]: String(ts) },
    });
    await expect(provider.verifyWebhook(good)).resolves.toEqual({ providerRef: "MOCK-QR-1", status: "PAID" });
  });
});

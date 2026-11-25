import "server-only";
import { MockProvider } from "./mock";
import type { PaymentProvider } from "./provider";

export function webhookSecret(): string {
  const secret = process.env.MOCK_WEBHOOK_SECRET;
  if (!secret || secret.length < 16) throw new Error("MOCK_WEBHOOK_SECRET belum diatur atau terlalu pendek.");
  return secret;
}

/**
 * Provider aktif. `appUrl` dipakai untuk isi QR (URL simulator). Saat ini hanya "mock";
 * provider sungguhan cukup ditambahkan sebagai cabang baru di sini.
 */
export function getPaymentProvider(appUrl: string): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? "mock";
  switch (name) {
    case "mock":
      return new MockProvider({
        secret: webhookSecret(),
        appUrl,
        terminalDelay: process.env.MOCK_TERMINAL_DELAY_MS ? () => Number(process.env.MOCK_TERMINAL_DELAY_MS) : undefined,
      });
    default:
      throw new Error(`Payment provider "${name}" belum didukung.`);
  }
}

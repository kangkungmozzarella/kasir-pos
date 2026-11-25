import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import type { PaymentProvider } from "./provider";
import { WebhookError } from "./provider";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from "./signature";

export const QRIS_TTL_MS = 5 * 60 * 1000;

/** Aturan uji ala sandbox: nominal kartu yang berakhiran 13 selalu ditolak. */
export function isDeclinedAmount(amount: number): boolean {
  return amount % 100 === 13;
}

const webhookBody = z.object({
  providerRef: z.string().min(1),
  status: z.enum(["PAID", "FAILED", "EXPIRED"]),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Provider simulasi. Perilakunya meniru gateway sungguhan (QR dengan masa berlaku,
 * webhook bertanda tangan, kartu yang bisa ditolak), tapi tidak ada uang yang berpindah.
 */
export class MockProvider implements PaymentProvider {
  name = "mock";

  constructor(
    private readonly opts: {
      secret: string;
      /** Origin aplikasi; QR berisi URL halaman simulator supaya bisa dipindai kamera HP. */
      appUrl: string;
      /** Jeda terminal EDC (ms). Bisa di-nol-kan untuk test. */
      terminalDelay?: () => number;
    },
  ) {}

  async createQris({ amount }: { paymentId: string; amount: number }) {
    if (amount <= 0) throw new Error("Nominal QRIS harus lebih dari 0");
    const providerRef = `MOCK-QR-${randomUUID()}`;
    return {
      providerRef,
      qrString: `${this.opts.appUrl.replace(/\/$/, "")}/simulator/pay/${providerRef}`,
      expiresAt: new Date(Date.now() + QRIS_TTL_MS),
    };
  }

  async chargeCard({ amount }: { paymentId: string; amount: number }) {
    await sleep(this.opts.terminalDelay?.() ?? randomInt(2000, 4001)); // "Menunggu terminal..."
    const providerRef = `MOCK-CARD-${randomUUID()}`;
    if (isDeclinedAmount(amount)) {
      return { status: "FAILED" as const, providerRef, message: "Kartu ditolak oleh bank penerbit." };
    }
    return {
      status: "PAID" as const,
      providerRef,
      cardLast4: String(randomInt(0, 10_000)).padStart(4, "0"),
      approvalCode: String(randomInt(0, 1_000_000)).padStart(6, "0"),
    };
  }

  async verifyWebhook(req: Request) {
    const body = await req.text();
    const result = verify(this.opts.secret, {
      signature: req.headers.get(SIGNATURE_HEADER),
      timestamp: req.headers.get(TIMESTAMP_HEADER),
      body,
    });
    if (!result.ok) throw new WebhookError(`Tanda tangan webhook tidak sah (${result.reason}).`, 401);

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new WebhookError("Body webhook bukan JSON.", 400);
    }
    const parsed = webhookBody.safeParse(json);
    if (!parsed.success) throw new WebhookError("Isi webhook tidak lengkap.", 400);
    return parsed.data;
  }
}

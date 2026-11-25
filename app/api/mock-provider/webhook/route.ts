import { getPaymentProvider } from "@/lib/payments";
import { WebhookError } from "@/lib/payments/provider";
import { applyWebhook } from "@/lib/sale-flow";

/**
 * Webhook dari payment gateway (saat ini provider simulasi). Tanda tangan HMAC
 * diverifikasi dulu; penerapannya idempoten, jadi gateway boleh mengirim ulang.
 */
export async function POST(request: Request) {
  const provider = getPaymentProvider(new URL(request.url).origin);
  try {
    const event = await provider.verifyWebhook(request);
    const outcome = await applyWebhook(event);
    return Response.json({ received: true, outcome });
  } catch (err) {
    if (err instanceof WebhookError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

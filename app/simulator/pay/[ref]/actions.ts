"use server";

import { refresh } from "next/cache";
import { requestOrigin } from "@/lib/origin";
import { webhookSecret } from "@/lib/payments";
import { sign, SIGNATURE_HEADER, TIMESTAMP_HEADER } from "@/lib/payments/signature";
import { getSimulatorPayment } from "@/lib/sale-flow";

/**
 * Meniru sisi payment gateway: setelah "pembeli" menekan Bayar/Tolak, gateway mengirim
 * webhook bertanda tangan HMAC ke aplikasi kasir. Secret hanya ada di server, jadi
 * tanda tangan dibuat di sini, bukan di browser.
 */
export async function simulatePayment(providerRef: string, decision: "PAID" | "FAILED"): Promise<{ error?: string }> {
  const payment = await getSimulatorPayment(providerRef);
  if (!payment) return { error: "Tagihan tidak ditemukan." };
  if (payment.status === "EXPIRED") return { error: "QR sudah kedaluwarsa. Minta kasir membuat QR baru." };
  if (payment.status !== "PENDING") return { error: "Tagihan ini sudah diproses." };

  const body = JSON.stringify({ providerRef, status: decision });
  const timestamp = Math.floor(Date.now() / 1000);
  const res = await fetch(`${await requestOrigin()}/api/mock-provider/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [SIGNATURE_HEADER]: sign(webhookSecret(), timestamp, body),
      [TIMESTAMP_HEADER]: String(timestamp),
    },
    body,
  });
  refresh();
  if (!res.ok) return { error: "Gateway simulasi gagal mengirim notifikasi. Coba lagi." };
  return {};
}

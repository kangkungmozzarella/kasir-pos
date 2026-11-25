/**
 * Abstraksi payment gateway. Kode kasir hanya mengenal interface ini, jadi mengganti
 * provider simulasi ("mock") dengan Midtrans/Xendit cukup menambah implementasi baru
 * dan mengubah PAYMENT_PROVIDER, tanpa menyentuh layar kasir atau logika transaksi.
 */
export type WebhookStatus = "PAID" | "FAILED" | "EXPIRED";

export interface PaymentProvider {
  /** Nama yang disimpan di kolom Payment.provider. */
  name: string;

  createQris(input: { paymentId: string; amount: number }): Promise<{
    providerRef: string;
    /** Isi QR yang ditampilkan ke pembeli. */
    qrString: string;
    expiresAt: Date;
  }>;

  chargeCard(input: { paymentId: string; amount: number }): Promise<{
    status: "PAID" | "FAILED";
    providerRef: string;
    cardLast4?: string;
    approvalCode?: string;
    /** Alasan penolakan untuk ditampilkan ke kasir. */
    message?: string;
  }>;

  /**
   * Kembalikan dana pembayaran yang sudah PAID (dipakai saat transaksi di-void).
   * Harus idempoten per providerRef: dipanggil dua kali tetap satu pengembalian.
   */
  refund(input: { providerRef: string; amount: number }): Promise<{ refundRef: string }>;

  /** Validasi webhook masuk. Melempar WebhookError bila tanda tangan tidak sah. */
  verifyWebhook(req: Request): Promise<{ providerRef: string; status: WebhookStatus }>;
}

export class WebhookError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401,
  ) {
    super(message);
  }
}

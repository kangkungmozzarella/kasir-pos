"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { CreditCardIcon, MoneyIcon, QrCodeIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCountdown } from "@/components/use-countdown";
import { quickAmounts } from "@/lib/cash";
import { formatNumber, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseRupiah } from "@/lib/validation";
import {
  cancelQrisAction,
  cancelSaleAction,
  cardAction,
  cashRemainingAction,
  checkoutAction,
  qrisAction,
  startSaleAction,
} from "./actions";
import type { ClientPayment, ClientSaleState } from "./client-state";
import type { DoneSale } from "./done-dialog";

type Method = "CASH" | "QRIS" | "CARD";
type CartInput = { items: { productId: string; qty: number; discount: number }[]; transactionDiscount: number; expectedTotal: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: React.RefObject<HTMLElement | null>;
  cart: CartInput | null;
  /** Transaksi yang sudah dibuat dan menunggu pembayaran (QRIS/kartu/kombinasi). */
  sale: ClientSaleState | null;
  onSale: (sale: ClientSaleState | null) => void;
  onDone: (done: DoneSale) => void;
  onCancelled: (invoiceNo: string) => void;
};

const METHOD_LABEL: Record<Method, string> = { CASH: "Tunai", QRIS: "QRIS", CARD: "Kartu" };
const METHOD_ICON = { CASH: MoneyIcon, QRIS: QrCodeIcon, CARD: CreditCardIcon };

export function PaymentDialog(props: Props) {
  const { open, onOpenChange, returnFocus } = props;
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="gap-0 p-0 sm:max-w-md" finalFocus={returnFocus}>
        {open && <PaymentBody {...props} onBusy={setBusy} />}
      </DialogContent>
    </Dialog>
  );
}

function PaymentBody({ cart, sale, onSale, onDone, onCancelled, onBusy }: Props & { onBusy: (b: boolean) => void }) {
  const [method, setMethod] = useState<Method>("CASH");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, start] = useTransition();
  const [cardWaiting, setCardWaiting] = useState(false);

  useEffect(() => onBusy(cardWaiting), [cardWaiting, onBusy]);

  const total = sale?.total ?? cart?.expectedTotal ?? 0;
  const due = sale ? sale.remaining : total;
  const active = sale?.active ?? null;

  /** Pastikan transaksi sudah dibuat (stok dipesan) sebelum pembayaran non-tunai. */
  async function ensureSale(): Promise<ClientSaleState | null> {
    if (sale) return sale;
    if (!cart) return null;
    const res = await startSaleAction(cart);
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    onSale(res.state);
    return res.state;
  }

  function finish(state: ClientSaleState, change: number) {
    onSale(null);
    onDone({ saleId: state.saleId, invoiceNo: state.invoiceNo, total: state.total, change });
  }

  function run(task: () => Promise<void>) {
    setError(undefined);
    setNotice(undefined);
    start(task);
  }

  function payCash(tendered: number) {
    run(async () => {
      if (!sale) {
        if (!cart) return;
        const res = await checkoutAction({ ...cart, tendered });
        if (res.ok) onDone(res);
        else setError(res.error);
        return;
      }
      const res = await cashRemainingAction(sale.saleId, tendered);
      if (!res.ok) return setError(res.error);
      finish(res.state, res.change ?? 0);
    });
  }

  function payQris(amount: number) {
    run(async () => {
      const s = await ensureSale();
      if (!s) return;
      const res = await qrisAction(s.saleId, amount);
      if (res.ok) onSale(res.state);
      else setError(res.error);
    });
  }

  function payCard(amount: number) {
    run(async () => {
      const s = await ensureSale();
      if (!s) return;
      setCardWaiting(true);
      const res = await cardAction(s.saleId, amount);
      setCardWaiting(false);
      if (!res.ok) return setError(res.error);
      if (res.state.status === "COMPLETED") return finish(res.state, 0);
      onSale(res.state);
      if (res.declined) setError(`${res.declined} Pilih metode lain atau coba kartu lain.`);
      else setNotice(`Kartu disetujui ${formatRupiah(amount)}. Sisa ${formatRupiah(res.state.remaining)}.`);
    });
  }

  function cancelQr() {
    if (!sale) return;
    run(async () => {
      const res = await cancelQrisAction(sale.saleId);
      if (res.ok) onSale(res.state);
      else setError(res.error);
    });
  }

  function cancelSale() {
    if (!sale) return;
    run(async () => {
      const res = await cancelSaleAction(sale.saleId);
      if (res.ok) onCancelled(res.invoiceNo);
      else setError(res.error);
    });
  }

  return (
    <div>
      <div className="border-b p-5">
        <DialogTitle className="text-base">{sale ? `Pembayaran ${sale.invoiceNo}` : "Pembayaran"}</DialogTitle>
        <DialogDescription className="sr-only">Pilih metode pembayaran dan masukkan nominal.</DialogDescription>
        <p className="mt-3 text-sm text-muted-foreground">{sale && sale.paid > 0 ? "Sisa tagihan" : "Total belanja"}</p>
        <p className="money text-4xl font-extrabold tracking-tight">{formatRupiah(sale ? sale.total - sale.paid : total)}</p>
        {sale && sale.paid > 0 && <PaidList payments={sale.payments} total={sale.total} />}
      </div>

      <div className="space-y-3 p-5">
        {active?.method === "QRIS" ? (
          <QrisWaiting payment={active} pending={pending} onCancel={cancelQr} />
        ) : cardWaiting ? (
          <div role="status" className="rounded-lg bg-muted px-4 py-8 text-center">
            <CreditCardIcon className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mt-2 font-semibold">Menunggu terminal...</p>
            <p className="text-sm text-muted-foreground">Masukkan atau tempelkan kartu pada mesin EDC.</p>
          </div>
        ) : (
          <>
            <div role="radiogroup" aria-label="Metode pembayaran" className="grid grid-cols-3 gap-2">
              {(["CASH", "QRIS", "CARD"] as const).map((m) => {
                const Icon = METHOD_ICON[m];
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={method === m}
                    onClick={() => {
                      setMethod(m);
                      setError(undefined);
                    }}
                    className={cn(
                      "flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg border text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      method === m ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {METHOD_LABEL[m]}
                  </button>
                );
              })}
            </div>
            {method === "CASH" ? (
              <CashForm key={`cash-${due}`} due={due} pending={pending} onPay={payCash} />
            ) : (
              <AmountForm
                key={`${method}-${due}`}
                method={method}
                due={due}
                pending={pending}
                onSubmit={method === "QRIS" ? payQris : payCard}
              />
            )}
          </>
        )}

        {notice && (
          <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {sale && sale.paid === 0 && !active && !cardWaiting && (
          <Button variant="ghost" className="w-full text-destructive" disabled={pending} onClick={cancelSale}>
            Batalkan transaksi dan kembalikan stok
          </Button>
        )}
      </div>
    </div>
  );
}

function PaidList({ payments, total }: { payments: ClientPayment[]; total: number }) {
  const paid = payments.filter((p) => p.status === "PAID");
  return (
    <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
      <li className="money">Total {formatRupiah(total)}</li>
      {paid.map((p) => (
        <li key={p.id} className="money">
          Sudah dibayar {METHOD_LABEL[p.method]} {formatRupiah(p.amount)}
          {p.cardLast4 && ` (**** ${p.cardLast4})`}
        </li>
      ))}
    </ul>
  );
}

function CashForm({ due, pending, onPay }: { due: number; pending: boolean; onPay: (tendered: number) => void }) {
  const [text, setText] = useState("");
  const tendered = text.trim() === "" ? null : parseRupiah(text);
  const enough = tendered !== null && tendered >= due;
  const invalid = text.trim() !== "" && tendered === null;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (enough && !pending) onPay(tendered);
      }}
      className="space-y-3"
    >
      <label htmlFor="tendered" className="text-sm font-medium">
        Uang diterima
      </label>
      <Input
        id="tendered"
        inputMode="numeric"
        autoFocus
        autoComplete="off"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={formatNumber(due)}
        aria-invalid={invalid || undefined}
        aria-describedby="tendered-status"
        className="money h-14 text-2xl font-bold"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button type="button" variant="outline" onClick={() => setText(String(due))}>
          Uang pas
        </Button>
        {quickAmounts(due).map((amount) => (
          <Button key={amount} type="button" variant="outline" className="money" onClick={() => setText(String(amount))}>
            {formatNumber(amount)}
          </Button>
        ))}
      </div>
      <div id="tendered-status" aria-live="polite" className="min-h-14 rounded-lg bg-muted px-4 py-3">
        {invalid ? (
          <p className="text-sm text-destructive">Masukkan nominal tanpa desimal, mis. 100.000.</p>
        ) : tendered === null ? (
          <p className="text-sm text-muted-foreground">Ketik nominal atau pilih tombol di atas.</p>
        ) : !enough ? (
          <p className="text-sm font-medium text-destructive">Kurang {formatRupiah(due - tendered)}</p>
        ) : (
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-foreground">Kembalian</span>
            <span className="money text-2xl font-extrabold">{formatRupiah(tendered - due)}</span>
          </p>
        )}
      </div>
      <Button type="submit" variant="highlight" size="lg" className="h-14 w-full text-base" disabled={!enough || pending}>
        {pending ? "Menyimpan transaksi..." : "Selesaikan transaksi"}
      </Button>
    </form>
  );
}

/** Nominal QRIS/kartu. Default = sisa tagihan; dikurangi untuk bayar sebagian (kombinasi). */
function AmountForm({
  method,
  due,
  pending,
  onSubmit,
}: {
  method: "QRIS" | "CARD";
  due: number;
  pending: boolean;
  onSubmit: (amount: number) => void;
}) {
  const [text, setText] = useState(String(due));
  const amount = parseRupiah(text);
  const valid = amount !== null && amount >= 1 && amount <= due;
  const id = `amount-${method}`;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !pending) onSubmit(amount);
      }}
      className="space-y-3"
    >
      <label htmlFor={id} className="text-sm font-medium">
        Nominal {METHOD_LABEL[method]}
      </label>
      <Input
        id={id}
        inputMode="numeric"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-invalid={!valid || undefined}
        aria-describedby={`${id}-hint`}
        className="money h-14 text-2xl font-bold"
      />
      <p id={`${id}-hint`} className={cn("text-sm", valid ? "text-muted-foreground" : "text-destructive")}>
        {!valid
          ? `Masukkan nominal antara Rp 1 dan ${formatRupiah(due)}.`
          : amount < due
            ? `Bayar sebagian. Sisa ${formatRupiah(due - amount)} bisa dibayar tunai, QRIS, atau kartu.`
            : method === "CARD"
              ? "Simulasi: nominal yang berakhiran 13 akan ditolak."
              : "QR berlaku 5 menit."}
      </p>
      <Button type="submit" variant="highlight" size="lg" className="h-14 w-full text-base" disabled={!valid || pending}>
        {pending ? "Memproses..." : method === "QRIS" ? "Tampilkan QR" : "Kirim ke terminal"}
      </Button>
    </form>
  );
}

function QrisWaiting({ payment, pending, onCancel }: { payment: ClientPayment; pending: boolean; onCancel: () => void }) {
  const [src, setSrc] = useState<string>();
  const countdown = useCountdown(payment.expiresAt);

  useEffect(() => {
    if (!payment.qrString) return;
    let alive = true;
    QRCode.toDataURL(payment.qrString, { margin: 1, width: 480, errorCorrectionLevel: "M" }).then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [payment.qrString]);

  return (
    <div className="text-center">
      <p className="text-sm font-semibold">Pindai dengan kamera HP</p>
      <div className="mx-auto mt-2 w-56 rounded-lg border bg-white p-2">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL hasil generate di browser
          <img src={src} alt={`Kode QR pembayaran ${formatRupiah(payment.amount)}`} className="aspect-square w-full" />
        ) : (
          <div className="aspect-square w-full animate-pulse bg-muted" />
        )}
      </div>
      <p className="mt-2 text-xs font-semibold">DEMO: bukan QRIS asli</p>
      <p className="money mt-1 text-lg font-bold">{formatRupiah(payment.amount)}</p>
      <p role="status" className="money text-sm text-muted-foreground">
        {countdown.done ? "QR kedaluwarsa" : `Menunggu pembayaran · ${countdown.label}`}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={pending} onClick={onCancel}>
          Batalkan QR
        </Button>
        {payment.qrString && (
          <a
            href={payment.qrString}
            target="_blank"
            rel="noopener"
            className="inline-flex h-11 items-center justify-center rounded-lg border px-3 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Buka simulator
          </a>
        )}
      </div>
    </div>
  );
}

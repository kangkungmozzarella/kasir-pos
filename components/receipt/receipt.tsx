import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ReceiptWidth = "58" | "80";

export type ReceiptData = {
  store: { name: string; address: string | null; phone: string | null; footer: string | null };
  invoiceNo: string;
  createdAt: Date;
  cashierName: string;
  status: "PENDING_PAYMENT" | "COMPLETED" | "VOIDED";
  items: { name: string; qty: number; unitPrice: number; discount: number; lineTotal: number }[];
  subtotal: number;
  discountTotal: number;
  taxRate: number;
  taxTotal: number;
  total: number;
  payments: {
    method: "CASH" | "QRIS" | "CARD";
    amount: number;
    tendered: number | null;
    change: number | null;
    providerRef: string | null;
    cardLast4: string | null;
    approvalCode: string | null;
  }[];
};

const PAYMENT_LABEL = { CASH: "Tunai", QRIS: "QRIS", CARD: "Kartu" } as const;

function Row({ left, right, strong }: { left: React.ReactNode; right: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-2", strong && "font-bold")}>
      <span className="min-w-0">{left}</span>
      <span className="shrink-0 text-right">{right}</span>
    </div>
  );
}

const Rule = () => <div aria-hidden className="my-1.5 border-t border-dashed border-current" />;

/**
 * Struk belanja. Hitam-putih dan monospace, meniru hasil printer thermal.
 * Lebar fisik mengikuti kertas: 58 mm (area cetak ±48 mm) atau 80 mm (±72 mm).
 */
export function Receipt({ data, width }: { data: ReceiptData; width: ReceiptWidth }) {
  const n = formatNumber;
  return (
    <article
      aria-label={`Struk ${data.invoiceNo}`}
      className={cn(
        "receipt bg-white font-mono leading-snug text-black",
        width === "58" ? "w-[48mm] text-[10.5px]" : "w-[72mm] text-[12px]",
      )}
    >
      <header className="text-center">
        <p className="font-bold">{data.store.name}</p>
        {data.store.address && <p>{data.store.address}</p>}
        {data.store.phone && <p>Telp {data.store.phone}</p>}
      </header>
      <Rule />
      <Row left="No" right={data.invoiceNo} />
      <Row left="Waktu" right={formatDateTime(data.createdAt)} />
      <Row left="Kasir" right={data.cashierName} />
      {data.status === "VOIDED" && <p className="my-1 text-center font-bold">*** DIBATALKAN ***</p>}
      <Rule />
      <ul>
        {data.items.map((item, i) => (
          <li key={i} className="mb-1">
            <p>{item.name}</p>
            <Row left={`${n(item.qty)} x ${n(item.unitPrice)}`} right={n(item.qty * item.unitPrice)} />
            {item.discount > 0 && <Row left="  Diskon" right={`-${n(item.discount)}`} />}
          </li>
        ))}
      </ul>
      <Rule />
      <Row left="Subtotal" right={n(data.subtotal)} />
      {data.discountTotal > 0 && <Row left="Diskon" right={`-${n(data.discountTotal)}`} />}
      {data.taxRate > 0 && <Row left={`PPN ${data.taxRate}%`} right={n(data.taxTotal)} />}
      <Row left="TOTAL" right={`Rp ${n(data.total)}`} strong />
      <Rule />
      {data.payments.map((p, i) => (
        <div key={i}>
          <Row left={PAYMENT_LABEL[p.method]} right={n(p.method === "CASH" && p.tendered != null ? p.tendered : p.amount)} />
          {p.method === "CASH" && p.change != null && <Row left="Kembalian" right={n(p.change)} />}
          {p.method === "QRIS" && p.providerRef && <Row left="Ref" right={p.providerRef.slice(-12)} />}
          {p.method === "CARD" && (
            <>
              {p.cardLast4 && <Row left="Kartu" right={`**** ${p.cardLast4}`} />}
              {p.approvalCode && <Row left="Approval" right={p.approvalCode} />}
            </>
          )}
        </div>
      ))}
      <Rule />
      {data.store.footer && <p className="text-center">{data.store.footer}</p>}
      {data.payments.some((p) => p.method !== "CASH") && (
        <p className="mt-1 text-center">Pembayaran non-tunai: simulasi demo</p>
      )}
    </article>
  );
}

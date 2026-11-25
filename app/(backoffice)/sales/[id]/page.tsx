import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SaleStatusBadge } from "@/components/sale-status";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber, formatRupiah } from "@/lib/format";
import { can, PERMISSIONS } from "@/lib/permissions";
import { METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/sale-labels";
import { voidBlocker } from "@/lib/void-rules";
import { SaleActions } from "./sale-actions";

export const metadata: Metadata = { title: "Detail transaksi" };

export default function SaleDetailPage({ params }: PageProps<"/sales/[id]">) {
  return (
    <Suspense fallback={<LoadingText>Memuat transaksi...</LoadingText>}>
      <SaleDetail params={params} />
    </Suspense>
  );
}

async function SaleDetail({ params }: { params: PageProps<"/sales/[id]">["params"] }) {
  const user = await requireUser(PERMISSIONS["report:view"]);
  const { id } = await params;
  const sale = await db.sale.findUnique({
    where: { id },
    select: {
      id: true,
      invoiceNo: true,
      status: true,
      branchId: true,
      subtotal: true,
      discountTotal: true,
      taxRate: true,
      taxTotal: true,
      total: true,
      createdAt: true,
      completedAt: true,
      voidReason: true,
      voidedAt: true,
      voidedBy: { select: { name: true } },
      branch: { select: { name: true } },
      cashier: { select: { name: true } },
      shift: { select: { id: true, status: true } },
      items: {
        orderBy: { id: "asc" },
        select: { id: true, productName: true, quantity: true, unitPrice: true, discount: true, lineTotal: true },
      },
      payments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          method: true,
          status: true,
          amount: true,
          tendered: true,
          change: true,
          providerRef: true,
          cardLast4: true,
          approvalCode: true,
          paidAt: true,
          refundedAt: true,
        },
      },
    },
  });
  // Admin cabang lain mendapat 404, bukan 403: keberadaan transaksinya pun tidak dibocorkan.
  if (!sale || (user.role === "ADMIN" && sale.branchId !== user.branchId)) notFound();

  const blocker = voidBlocker({ status: sale.status, createdAt: sale.createdAt, shiftStatus: sale.shift.status });
  const received = sale.payments.filter((p) => p.status === "PAID");
  const cashToReturn = received.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0);
  const nonCashToReturn = received.filter((p) => p.method !== "CASH").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={sale.invoiceNo}
        description={
          <>
            {sale.branch.name} · {formatDateTime(sale.createdAt)} · dilayani {sale.cashier.name}
          </>
        }
        back={{ href: "/sales", label: "Riwayat penjualan" }}
        actions={<SaleStatusBadge status={sale.status} className="px-3 py-1 text-sm" />}
      />

      {sale.status === "VOIDED" && (
        <section aria-label="Info pembatalan" className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">Transaksi dibatalkan</p>
          <p className="mt-1">Alasan: {sale.voidReason}</p>
          <p className="mt-0.5 text-muted-foreground">
            {sale.voidedBy ? `Oleh ${sale.voidedBy.name}` : "Dibatalkan"}
            {sale.voidedAt && `, ${formatDateTime(sale.voidedAt)}`}. Stok sudah dikembalikan.
          </p>
        </section>
      )}

      <section aria-labelledby="items-title" className="overflow-hidden rounded-xl border bg-card">
        <h2 id="items-title" className="sr-only">
          Barang
        </h2>
        <table className="w-full text-sm">
          <caption className="sr-only">Barang yang dibeli</caption>
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Barang</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Jumlah</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sale.items.map((i) => (
              <tr key={i.id}>
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  {i.productName}
                  <span className="money block text-muted-foreground">
                    @ {formatRupiah(i.unitPrice)}
                    {i.discount > 0 && ` · diskon ${formatRupiah(i.discount)}`}
                  </span>
                </th>
                <td className="money px-4 py-3 text-right">{formatNumber(i.quantity)}</td>
                <td className="money px-4 py-3 text-right">{formatRupiah(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 border-t px-4 py-3 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="money text-right">{formatRupiah(sale.subtotal)}</dd>
          {sale.discountTotal > 0 && (
            <>
              <dt className="text-muted-foreground">Diskon transaksi</dt>
              <dd className="money text-right">-{formatRupiah(sale.discountTotal)}</dd>
            </>
          )}
          {sale.taxRate > 0 && (
            <>
              <dt className="text-muted-foreground">PPN {sale.taxRate}%</dt>
              <dd className="money text-right">{formatRupiah(sale.taxTotal)}</dd>
            </>
          )}
          <dt className="font-semibold">Total</dt>
          <dd className="money text-right text-lg font-bold">{formatRupiah(sale.total)}</dd>
        </dl>
      </section>

      <section aria-labelledby="pay-title" className="mt-6">
        <h2 id="pay-title" className="font-semibold">
          Pembayaran
        </h2>
        {sale.payments.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Belum ada pembayaran.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-xl border bg-card">
            {sale.payments.map((p) => (
              <li key={p.id} className="px-4 py-3 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-medium">
                    {METHOD_LABEL[p.method]}
                    <span className="ml-2 font-normal text-muted-foreground">{PAYMENT_STATUS_LABEL[p.status]}</span>
                  </p>
                  <p className={`money font-semibold ${p.status === "PAID" ? "" : "text-muted-foreground"}`}>{formatRupiah(p.amount)}</p>
                </div>
                <p className="money mt-0.5 text-muted-foreground">
                  {[
                    p.tendered !== null && `Diterima ${formatRupiah(p.tendered)}`,
                    p.change !== null && p.change > 0 && `kembali ${formatRupiah(p.change)}`,
                    p.cardLast4 && `**** ${p.cardLast4}`,
                    p.approvalCode && `approval ${p.approvalCode}`,
                    p.method === "QRIS" && p.providerRef && `ref ${p.providerRef.slice(0, 20)}...`,
                    p.refundedAt && `dikembalikan ${formatDateTime(p.refundedAt)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
        {sale.payments.some((p) => p.method !== "CASH") && (
          <p className="mt-2 text-xs text-muted-foreground">Pembayaran non-tunai di aplikasi demo ini adalah simulasi.</p>
        )}
      </section>

      <p className="mt-6 text-sm">
        <Link href={`/shifts/${sale.shift.id}`} className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
          Rekap shift transaksi ini
        </Link>
      </p>

      <SaleActions
        saleId={sale.id}
        invoiceNo={sale.invoiceNo}
        canVoid={can(user.role, "sale:void") && sale.status !== "VOIDED"}
        blocker={blocker}
        cashToReturn={cashToReturn}
        nonCashToReturn={nonCashToReturn}
        hasReceipt={sale.status !== "PENDING_PAYMENT"}
      />
    </div>
  );
}

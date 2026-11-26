import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TransferStatusBadge } from "@/components/transfer-status";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { canSeeTransfer } from "@/lib/transfer";
import { TransferSteps } from "./transfer-steps";

export const metadata: Metadata = { title: "Detail transfer" };

export default function TransferDetailPage({ params }: PageProps<"/transfers/[id]">) {
  return (
    <Suspense fallback={<LoadingText>Memuat transfer...</LoadingText>}>
      <TransferDetail params={params} />
    </Suspense>
  );
}

async function TransferDetail({ params }: { params: PageProps<"/transfers/[id]">["params"] }) {
  const user = await requireUser(PERMISSIONS["transfer:manage"]);
  const { id } = await params;
  const t = await db.stockTransfer.findUnique({
    where: { id },
    select: {
      id: true,
      transferNo: true,
      status: true,
      note: true,
      fromBranchId: true,
      toBranchId: true,
      createdAt: true,
      sentAt: true,
      receivedAt: true,
      cancelledAt: true,
      fromBranch: { select: { name: true } },
      toBranch: { select: { name: true } },
      createdBy: { select: { name: true } },
      sentBy: { select: { name: true } },
      receivedBy: { select: { name: true } },
      items: {
        orderBy: { product: { name: "asc" } },
        select: { id: true, productId: true, quantity: true, product: { select: { name: true, sku: true, unit: true } } },
      },
    },
  });
  if (!t || !canSeeTransfer(user, t)) notFound();

  // Stok asal saat ini, untuk peringatan sebelum draf dikirim.
  const originStock =
    t.status === "DRAFT"
      ? new Map(
          (
            await db.branchStock.findMany({
              where: { branchId: t.fromBranchId, productId: { in: t.items.map((i) => i.productId) } },
              select: { productId: true, quantity: true },
            })
          ).map((s) => [s.productId, s.quantity]),
        )
      : null;
  const short = originStock ? t.items.filter((i) => (originStock.get(i.productId) ?? 0) < i.quantity) : [];

  const isOwner = user.role === "OWNER";
  const actsForOrigin = isOwner || user.branchId === t.fromBranchId;
  const actsForDestination = isOwner || user.branchId === t.toBranchId;
  const units = t.items.reduce((s, i) => s + i.quantity, 0);
  const steps = [
    ...(t.status === "DRAFT" && actsForOrigin ? (["send", "cancel"] as const) : []),
    ...(t.status === "SENT" && actsForDestination ? (["receive"] as const) : []),
  ];

  const timeline = [
    { label: "Dibuat", at: t.createdAt, by: t.createdBy.name },
    t.sentAt && { label: "Dikirim", at: t.sentAt, by: t.sentBy?.name },
    t.receivedAt && { label: "Diterima", at: t.receivedAt, by: t.receivedBy?.name },
    t.cancelledAt && { label: "Dibatalkan", at: t.cancelledAt, by: undefined },
  ].filter(Boolean) as { label: string; at: Date; by?: string }[];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t.transferNo}
        description={
          <>
            {t.fromBranch.name} ke {t.toBranch.name}
          </>
        }
        back={{ href: "/transfers", label: "Semua transfer" }}
        actions={<TransferStatusBadge status={t.status} className="px-3 py-1 text-sm" />}
      />

      {t.status === "SENT" && !actsForDestination && (
        <p role="status" className="mb-6 rounded-xl border bg-card p-4 text-sm">
          Barang dalam perjalanan. Stok {t.toBranch.name} bertambah setelah admin di sana menekan Terima barang.
        </p>
      )}
      {short.length > 0 && (
        <p role="alert" className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Stok {t.fromBranch.name} tidak cukup untuk {short.map((i) => i.product.name).join(", ")}. Ubah jumlahnya sebelum mengirim.
        </p>
      )}

      <section aria-labelledby="items-title" className="overflow-hidden rounded-xl border bg-card">
        <h2 id="items-title" className="sr-only">
          Barang
        </h2>
        <table className="w-full text-sm">
          <caption className="sr-only">Barang yang ditransfer</caption>
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Produk</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Jumlah</th>
              {originStock && <th scope="col" className="hidden px-4 py-3 text-right font-medium sm:table-cell">Stok asal sekarang</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {t.items.map((i) => {
              const stock = originStock?.get(i.productId) ?? 0;
              return (
                <tr key={i.id}>
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    {i.product.name}
                    <span className="block text-muted-foreground">{i.product.sku}</span>
                  </th>
                  <td className="money px-4 py-3 text-right">
                    {formatNumber(i.quantity)} {i.product.unit}
                  </td>
                  {originStock && (
                    <td className={`money hidden px-4 py-3 text-right sm:table-cell ${stock < i.quantity ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                      {formatNumber(stock)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t">
            <tr>
              <th scope="row" className="px-4 py-3 text-left font-semibold">
                {formatNumber(t.items.length)} produk
              </th>
              <td className="money px-4 py-3 text-right font-semibold">{formatNumber(units)} barang</td>
              {originStock && <td className="hidden sm:table-cell" />}
            </tr>
          </tfoot>
        </table>
      </section>
      {t.note && <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-sm">Catatan: {t.note}</p>}

      <section aria-labelledby="time-title" className="mt-6">
        <h2 id="time-title" className="font-semibold">
          Riwayat
        </h2>
        <ol className="mt-2 space-y-1.5 text-sm">
          {timeline.map((e) => (
            <li key={e.label} className="flex flex-wrap gap-x-2">
              <span className="w-24 font-medium">{e.label}</span>
              <span className="text-muted-foreground">
                {formatDateTime(e.at)}
                {e.by && ` oleh ${e.by}`}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-6 border-t pt-6">
        <TransferSteps
          transferId={t.id}
          steps={[...steps]}
          editHref={t.status === "DRAFT" && actsForOrigin ? `/transfers/${t.id}/ubah` : undefined}
          descriptions={{
            send: `Stok ${t.fromBranch.name} langsung berkurang ${formatNumber(units)} barang. Barang dianggap dalam perjalanan sampai ${t.toBranch.name} menerimanya.`,
            receive: `Stok ${t.toBranch.name} bertambah ${formatNumber(units)} barang dari ${formatNumber(t.items.length)} produk. Pastikan jumlah barang yang datang sudah dicek.`,
            cancel: "Draf ditandai dibatalkan. Stok tidak berubah.",
          }}
        />
      </div>
    </div>
  );
}

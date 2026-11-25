import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { CashDifferenceText } from "@/components/sale-status";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { formatDateTime, formatNumber, formatRupiah } from "@/lib/format";
import { can } from "@/lib/permissions";
import { METHOD_LABEL } from "@/lib/sale-labels";
import { getShiftRecap } from "@/lib/shift";

export const metadata: Metadata = { title: "Rekap shift" };

export default function ShiftRecapPage(props: PageProps<"/shifts/[id]">) {
  return (
    <Suspense fallback={<LoadingText>Memuat rekap shift...</LoadingText>}>
      <ShiftRecap {...props} />
    </Suspense>
  );
}

async function ShiftRecap({ params, searchParams }: PageProps<"/shifts/[id]">) {
  const user = await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const recap = await getShiftRecap(user, id);
  if (!recap) notFound();

  const isManager = can(user.role, "report:view");
  const justClosed = sp.ditutup === "1" && recap.status === "CLOSED";
  const nonCash = recap.methods.QRIS.amount + recap.methods.CARD.amount;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Shift ${recap.cashier.name}`}
        description={
          <>
            {recap.branch.name} · {formatDateTime(recap.openedAt)} sampai{" "}
            {recap.closedAt ? formatDateTime(recap.closedAt) : "sekarang (masih buka)"}
          </>
        }
        back={isManager ? { href: "/shifts", label: "Semua shift" } : undefined}
        actions={<PrintButton>Cetak rekap</PrintButton>}
      />

      {justClosed && (
        <div role="status" className="mb-6 rounded-xl border bg-card p-4 print:hidden">
          <p className="font-semibold">Shift sudah ditutup.</p>
          <p className="mt-1 text-sm text-muted-foreground">Serahkan uang di laci beserta rekap ini ke admin atau pemilik toko.</p>
          {user.role === "CASHIER" && (
            <Link href="/pos" className={buttonVariants({ className: "mt-3" })}>
              Kembali ke kasir
            </Link>
          )}
        </div>
      )}

      <section aria-labelledby="kas-title" className="rounded-xl border bg-card p-5">
        <h2 id="kas-title" className="font-semibold">
          Kas di laci
        </h2>
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Modal awal</dt>
          <dd className="money text-right">{formatRupiah(recap.openingCash)}</dd>
          <dt className="text-muted-foreground">Tunai masuk (setelah kembalian)</dt>
          <dd className="money text-right">{formatRupiah(recap.methods.CASH.amount)}</dd>
          <dt className="border-t pt-2 font-medium">Kas yang diharapkan</dt>
          <dd className="money border-t pt-2 text-right font-semibold">{formatRupiah(recap.expected)}</dd>
          {recap.countedCash !== null && (
            <>
              <dt className="font-medium">Uang yang dihitung kasir</dt>
              <dd className="money text-right font-semibold">{formatRupiah(recap.countedCash)}</dd>
            </>
          )}
        </dl>
        {recap.difference ? (
          <div className="mt-4 flex items-baseline justify-between gap-4 border-t pt-4">
            <p className="font-medium">Selisih</p>
            <CashDifferenceText difference={recap.difference} className="text-2xl" />
          </div>
        ) : (
          <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
            Shift masih buka. Kas yang diharapkan bisa bertambah sampai shift ditutup.
          </p>
        )}
        {recap.note && <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-sm">Catatan kasir: {recap.note}</p>}
      </section>

      <section aria-labelledby="jual-title" className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="jual-title" className="font-semibold">
            Penjualan
          </h2>
          {isManager && (
            <Link href={`/sales?shift=${recap.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline print:hidden">
              Lihat transaksinya
            </Link>
          )}
        </div>
        <div className="mt-2 overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Penjualan per metode pembayaran</caption>
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Metode</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Pembayaran</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(["CASH", "QRIS", "CARD"] as const).map((m) => (
                <tr key={m}>
                  <th scope="row" className="px-4 py-3 text-left font-normal">{METHOD_LABEL[m]}</th>
                  <td className="money px-4 py-3 text-right">{formatNumber(recap.methods[m].count)}</td>
                  <td className="money px-4 py-3 text-right">{formatRupiah(recap.methods[m].amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t">
              <tr>
                <th scope="row" className="px-4 py-3 text-left font-semibold">
                  {formatNumber(recap.salesCount)} transaksi selesai
                </th>
                <td />
                <td className="money px-4 py-3 text-right font-semibold">{formatRupiah(recap.revenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {nonCash > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">QRIS dan kartu masuk ke rekening toko, tidak ke laci.</p>
        )}
      </section>

      {recap.pending.length > 0 && (
        <section aria-labelledby="pending-title" className="mt-6">
          <h2 id="pending-title" className="font-semibold">
            Menunggu pembayaran
          </h2>
          <ul className="mt-2 divide-y rounded-xl border bg-card">
            {recap.pending.map((s) => (
              <li key={s.id} className="flex justify-between gap-4 px-4 py-3 text-sm">
                <span className="money">{s.invoiceNo}</span>
                <span className="money">{formatRupiah(s.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="void-title" className="mt-6">
        <h2 id="void-title" className="font-semibold">
          Dibatalkan
        </h2>
        {recap.voided.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Tidak ada transaksi yang dibatalkan di shift ini.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-xl border bg-card">
            {recap.voided.map((s) => {
              const afterClose = recap.closedAt && s.voidedAt && s.voidedAt > recap.closedAt;
              return (
                <li key={s.id} className="px-4 py-3 text-sm">
                  <div className="flex justify-between gap-4">
                    {isManager ? (
                      <Link href={`/sales/${s.id}`} className="money font-medium text-primary underline-offset-4 hover:underline">
                        {s.invoiceNo}
                      </Link>
                    ) : (
                      <span className="money font-medium">{s.invoiceNo}</span>
                    )}
                    <span className="money">{formatRupiah(s.total)}</span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {s.voidReason}
                    {s.voidedBy && ` · oleh ${s.voidedBy.name}`}
                    {s.voidedAt && `, ${formatDateTime(s.voidedAt)}`}
                  </p>
                  {afterClose && (
                    <p className="mt-0.5 font-medium">Dibatalkan setelah shift ditutup, tidak mengubah kas yang diharapkan di atas.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

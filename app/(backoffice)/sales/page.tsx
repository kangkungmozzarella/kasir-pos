import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { BranchPicker } from "@/components/branch-picker";
import { EmptyState, LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SaleStatusBadge } from "@/components/sale-status";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber, formatRupiah } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { METHOD_LABEL, methodSummary, SALE_STATUS_LABEL } from "@/lib/sale-labels";
import { salesFilter } from "@/lib/sales-filter";

export const metadata: Metadata = { title: "Penjualan" };

const PAGE_SIZE = 30;

export default function SalesPage({ searchParams }: PageProps<"/sales">) {
  return (
    <Suspense fallback={<LoadingText>Memuat riwayat penjualan...</LoadingText>}>
      <SalesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SalesContent({ searchParams }: { searchParams: PageProps<"/sales">["searchParams"] }) {
  const user = await requireUser(PERMISSIONS["report:view"]);
  const sp = await searchParams;
  const { where, params, branchId, branches, values } = await salesFilter(user, sp);
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);

  const [total, sales, completed, cashiers] = await Promise.all([
    db.sale.count({ where }),
    db.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        invoiceNo: true,
        status: true,
        total: true,
        createdAt: true,
        cashier: { select: { name: true } },
        branch: { select: { code: true } },
        payments: { select: { method: true, status: true } },
      },
    }),
    db.sale.aggregate({ where: { AND: [where, { status: "COMPLETED" }] }, _sum: { total: true }, _count: { _all: true } }),
    db.user.findMany({
      where: { ...(branchId && { branchId }), sales: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const isOwner = user.role === "OWNER";
  const query = (extra: Record<string, string>) => new URLSearchParams({ ...params, ...extra }).toString();
  const hrefFor = (p: number) => `/sales?${query({ page: String(p) })}`;
  const branchName = branchId ? branches.find((b) => b.id === branchId)?.name : "Semua cabang";

  return (
    <>
      <PageHeader
        title="Penjualan"
        description={branchName}
        actions={
          <>
            {isOwner && branches.length > 1 && (
              <BranchPicker
                branches={branches}
                value={branchId ?? ""}
                action="/sales"
                allLabel="Semua cabang"
                keep={Object.fromEntries(Object.entries(params).filter(([k]) => k !== "branch" && k !== "cashier"))}
              />
            )}
            <a href={`/api/sales/export?${query({})}`} className={buttonVariants({ variant: "outline", className: "gap-2" })}>
              <DownloadSimpleIcon className="size-5" aria-hidden />
              Unduh CSV
            </a>
          </>
        }
      />

      <form method="get" role="search" aria-label="Saring penjualan" className="mb-4 grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 lg:grid-cols-4">
        {params.branch && <input type="hidden" name="branch" value={params.branch} />}
        {values.shift && <input type="hidden" name="shift" value={values.shift} />}
        <FilterField label="Dari tanggal" htmlFor="from">
          <Input id="from" name="from" type="date" defaultValue={values.from} />
        </FilterField>
        <FilterField label="Sampai tanggal" htmlFor="to">
          <Input id="to" name="to" type="date" defaultValue={values.to} />
        </FilterField>
        <FilterField label="Kasir" htmlFor="cashier">
          <NativeSelect id="cashier" name="cashier" defaultValue={values.cashier} className="w-full">
            <NativeSelectOption value="">Semua kasir</NativeSelectOption>
            {cashiers.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FilterField>
        <FilterField label="Metode bayar" htmlFor="method">
          <NativeSelect id="method" name="method" defaultValue={values.method} className="w-full">
            <NativeSelectOption value="">Semua metode</NativeSelectOption>
            {(["CASH", "QRIS", "CARD"] as const).map((m) => (
              <NativeSelectOption key={m} value={m}>
                {METHOD_LABEL[m]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FilterField>
        <FilterField label="Status" htmlFor="status">
          <NativeSelect id="status" name="status" defaultValue={values.status} className="w-full">
            <NativeSelectOption value="">Semua status</NativeSelectOption>
            {(["COMPLETED", "VOIDED", "PENDING_PAYMENT"] as const).map((s) => (
              <NativeSelectOption key={s} value={s}>
                {SALE_STATUS_LABEL[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FilterField>
        <FilterField label="No. invoice" htmlFor="q" className="col-span-2 sm:col-span-1">
          <Input id="q" name="q" type="search" defaultValue={values.q} placeholder="MDN01-20261125-0012" />
        </FilterField>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-1 lg:col-span-2">
          <button type="submit" className={buttonVariants()}>
            Terapkan
          </button>
          <Link href="/sales" className={buttonVariants({ variant: "ghost" })}>
            Atur ulang
          </Link>
        </div>
      </form>

      {values.shift && (
        <p className="mb-4 text-sm">
          Menampilkan transaksi dari satu shift.{" "}
          <Link href={`/shifts/${values.shift}`} className="font-medium text-primary underline-offset-4 hover:underline">
            Lihat rekap shift
          </Link>
        </p>
      )}

      {sales.length === 0 ? (
        <EmptyState title="Tidak ada transaksi yang cocok">Ubah rentang tanggal atau saringan lain, lalu tekan Terapkan.</EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
            {formatNumber(total)} transaksi. Yang selesai: {formatNumber(completed._count._all)} dengan total{" "}
            <span className="money font-semibold text-foreground">{formatRupiah(completed._sum.total ?? 0)}</span>.
          </p>

          <ul className="divide-y rounded-xl border bg-card md:hidden">
            {sales.map((s) => (
              <li key={s.id}>
                <Link href={`/sales/${s.id}`} className="block px-4 py-3 outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50">
                  <div className="flex items-start justify-between gap-3">
                    <p className="money text-sm font-semibold">{s.invoiceNo}</p>
                    <p className="money font-semibold">{formatRupiah(s.total)}</p>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span>
                      {formatDateTime(s.createdAt)} · {s.cashier.name}
                    </span>
                    <SaleStatusBadge status={s.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Riwayat penjualan</caption>
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">No. invoice</th>
                  <th scope="col" className="px-4 py-3 font-medium">Waktu</th>
                  <th scope="col" className="px-4 py-3 font-medium">Kasir</th>
                  <th scope="col" className="px-4 py-3 font-medium">Metode</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-accent/60">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <Link href={`/sales/${s.id}`} className="money rounded font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                        {s.invoiceNo}
                      </Link>
                    </th>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      {s.cashier.name}
                      {!branchId && <span className="ml-1.5 text-muted-foreground">{s.branch.code}</span>}
                    </td>
                    <td className="px-4 py-3">{methodSummary(s.payments)}</td>
                    <td className={`money px-4 py-3 text-right ${s.status === "VOIDED" ? "text-muted-foreground line-through" : ""}`}>
                      {formatRupiah(s.total)}
                    </td>
                    <td className="px-4 py-3">
                      <SaleStatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} hrefFor={hrefFor} />
        </>
      )}
    </>
  );
}

function FilterField({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`grid min-w-0 content-start gap-1.5 ${className ?? ""}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

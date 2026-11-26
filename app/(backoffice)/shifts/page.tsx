import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { BranchPicker } from "@/components/branch-picker";
import { EmptyState, LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { CashDifferenceText } from "@/components/sale-status";
import { NativeSelectOption } from "@/components/ui/native-select";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { resolveBranchFilter } from "@/lib/branch-scope";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber, formatRupiah } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { cashDifference } from "@/lib/shift-math";

export const metadata: Metadata = { title: "Shift" };

const PAGE_SIZE = 25;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default function ShiftsPage({ searchParams }: PageProps<"/shifts">) {
  return (
    <Suspense fallback={<LoadingText>Memuat daftar shift...</LoadingText>}>
      <ShiftsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ShiftsContent({ searchParams }: { searchParams: PageProps<"/shifts">["searchParams"] }) {
  const user = await requireUser(PERMISSIONS["report:view"]);
  const sp = await searchParams;
  const { branchId, branches } = await resolveBranchFilter(user, one(sp.branch) || undefined);
  const filter = ["open", "diff"].includes(one(sp.filter)) ? one(sp.filter) : "all";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const where: Prisma.ShiftWhereInput = {
    ...(branchId && { branchId }),
    ...(filter === "open" && { status: "OPEN" }),
    ...(filter === "diff" && {
      status: "CLOSED",
      OR: [{ countedCash: { lt: db.shift.fields.expectedCash } }, { countedCash: { gt: db.shift.fields.expectedCash } }],
    }),
  };

  const [total, shifts, openCount] = await Promise.all([
    db.shift.count({ where }),
    db.shift.findMany({
      where,
      orderBy: { openedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        status: true,
        openingCash: true,
        expectedCash: true,
        countedCash: true,
        openedAt: true,
        closedAt: true,
        cashier: { select: { name: true } },
        branch: { select: { code: true } },
      },
    }),
    db.shift.count({ where: { ...(branchId && { branchId }), status: "OPEN" } }),
  ]);
  // Jumlah transaksi per shift di halaman ini: satu query groupBy, bukan satu per baris.
  const counts = await db.sale.groupBy({
    by: ["shiftId"],
    where: { shiftId: { in: shifts.map((s) => s.id) }, status: "COMPLETED" },
    _count: { _all: true },
  });
  const countOf = (id: string) => counts.find((c) => c.shiftId === id)?._count._all ?? 0;

  const isOwner = user.role === "OWNER";
  const keep = { ...(branchId && isOwner && { branch: branchId }) };
  const hrefFor = (p: number) => `/shifts?${new URLSearchParams({ ...keep, filter, page: String(p) })}`;
  const branchName = branchId ? branches.find((b) => b.id === branchId)?.name : "Semua cabang";

  return (
    <>
      <PageHeader
        title="Shift"
        description={`${branchName}: ${openCount > 0 ? `${formatNumber(openCount)} shift sedang buka.` : "tidak ada shift yang sedang buka."}`}
        actions={
          isOwner &&
          branches.length > 1 && (
            <BranchPicker branches={branches} value={branchId ?? ""} action="/shifts" allLabel="Semua cabang" keep={{ filter }} />
          )
        }
      />

      <form key={`${branchId}:${filter}`} method="get" className="mb-4 flex items-center gap-2">
        {keep.branch && <input type="hidden" name="branch" value={keep.branch} />}
        <label htmlFor="filter" className="text-sm font-medium">
          Tampilkan
        </label>
        <AutoSubmitSelect id="filter" name="filter" defaultValue={filter} className="w-full sm:w-56">
          <NativeSelectOption value="all">Semua shift</NativeSelectOption>
          <NativeSelectOption value="open">Sedang buka</NativeSelectOption>
          <NativeSelectOption value="diff">Ditutup dengan selisih</NativeSelectOption>
        </AutoSubmitSelect>
      </form>

      {shifts.length === 0 ? (
        <EmptyState title={filter === "diff" ? "Tidak ada shift dengan selisih kas" : filter === "open" ? "Tidak ada shift yang sedang buka" : "Belum ada shift"}>
          {filter === "all" ? "Shift muncul setelah kasir membukanya dari layar kasir." : "Coba tampilkan semua shift."}
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-card md:hidden">
            {shifts.map((s) => (
              <li key={s.id}>
                <Link href={`/shifts/${s.id}`} className="block px-4 py-3 outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50">
                  <div className="flex justify-between gap-3">
                    <p className="font-semibold">
                      {s.cashier.name}
                      {!branchId && <span className="ml-2 font-normal text-muted-foreground">{s.branch.code}</span>}
                    </p>
                    <ShiftResult shift={s} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(s.openedAt)} · {formatNumber(countOf(s.id))} transaksi
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Daftar shift kasir</caption>
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Kasir</th>
                  <th scope="col" className="px-4 py-3 font-medium">Dibuka</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Transaksi</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Kas diharapkan</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Dihitung</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shifts.map((s) => (
                  <tr key={s.id} className="hover:bg-accent/60">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <Link href={`/shifts/${s.id}`} className="rounded font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                        {s.cashier.name}
                      </Link>
                      {!branchId && <span className="ml-2 text-muted-foreground">{s.branch.code}</span>}
                    </th>
                    <td className="px-4 py-3">
                      {formatDateTime(s.openedAt)}
                      <span className="block text-xs text-muted-foreground">
                        {s.closedAt ? `ditutup ${formatDateTime(s.closedAt)}` : "masih buka"}
                      </span>
                    </td>
                    <td className="money px-4 py-3 text-right">{formatNumber(countOf(s.id))}</td>
                    <td className="money px-4 py-3 text-right">{s.expectedCash === null ? "-" : formatRupiah(s.expectedCash)}</td>
                    <td className="money px-4 py-3 text-right">{s.countedCash === null ? "-" : formatRupiah(s.countedCash)}</td>
                    <td className="px-4 py-3 text-right">
                      <ShiftResult shift={s} />
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

function ShiftResult({ shift }: { shift: { status: string; expectedCash: number | null; countedCash: number | null } }) {
  if (shift.status === "OPEN" || shift.expectedCash === null || shift.countedCash === null) {
    return <span className="text-sm font-medium">Masih buka</span>;
  }
  return <CashDifferenceText difference={cashDifference(shift.countedCash, shift.expectedCash)} className="text-sm" />;
}

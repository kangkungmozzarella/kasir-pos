import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { EmptyState, LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { TransferStatusBadge } from "@/components/transfer-status";
import { buttonVariants } from "@/components/ui/button";
import { NativeSelectOption } from "@/components/ui/native-select";
import type { Prisma, TransferStatus } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { TRANSFER_STATUS_LABEL } from "@/lib/transfer-labels";

export const metadata: Metadata = { title: "Transfer stok" };

const PAGE_SIZE = 25;
const STATUSES = ["DRAFT", "SENT", "RECEIVED", "CANCELLED"] as const;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export default function TransfersPage({ searchParams }: PageProps<"/transfers">) {
  return (
    <Suspense fallback={<LoadingText>Memuat transfer...</LoadingText>}>
      <TransfersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TransfersContent({ searchParams }: { searchParams: PageProps<"/transfers">["searchParams"] }) {
  const user = await requireUser(PERMISSIONS["transfer:manage"]);
  const sp = await searchParams;
  const isOwner = user.role === "OWNER";
  const own = user.branchId ?? "";
  const dir = !isOwner && ["in", "out"].includes(one(sp.dir)) ? one(sp.dir) : "all";
  const status = (STATUSES as readonly string[]).includes(one(sp.status)) ? (one(sp.status) as TransferStatus) : "";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  // Admin melihat transfer yang keluar dari atau masuk ke cabangnya saja.
  const scope: Prisma.StockTransferWhereInput = isOwner
    ? {}
    : dir === "in"
      ? { toBranchId: own }
      : dir === "out"
        ? { fromBranchId: own }
        : { OR: [{ fromBranchId: own }, { toBranchId: own }] };
  const where: Prisma.StockTransferWhereInput = { ...scope, ...(status && { status }) };

  const [total, transfers, incoming] = await Promise.all([
    db.stockTransfer.count({ where }),
    db.stockTransfer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        transferNo: true,
        status: true,
        createdAt: true,
        fromBranch: { select: { code: true, name: true } },
        toBranch: { select: { code: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    db.stockTransfer.count({ where: { status: "SENT", ...(isOwner ? {} : { toBranchId: own }) } }),
  ]);

  const hrefFor = (p: number) => `/transfers?${new URLSearchParams({ dir, ...(status && { status }), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Transfer stok"
        description={
          incoming > 0
            ? `${formatNumber(incoming)} kiriman dalam perjalanan${isOwner ? "" : " ke cabang Anda"}, menunggu diterima.`
            : "Kirim stok antar-cabang. Stok asal berkurang saat dikirim, stok tujuan bertambah saat diterima."
        }
        actions={
          <Link href="/transfers/new" className={buttonVariants()}>
            Transfer baru
          </Link>
        }
      />

      <form key={`${dir}:${status}`} method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
        {!isOwner && (
          <>
            <label htmlFor="dir" className="sr-only">
              Arah
            </label>
            <AutoSubmitSelect id="dir" name="dir" defaultValue={dir} className="w-full sm:w-56">
              <NativeSelectOption value="all">Masuk dan keluar</NativeSelectOption>
              <NativeSelectOption value="in">Masuk ke cabang saya</NativeSelectOption>
              <NativeSelectOption value="out">Keluar dari cabang saya</NativeSelectOption>
            </AutoSubmitSelect>
          </>
        )}
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <AutoSubmitSelect id="status" name="status" defaultValue={status} className="w-full sm:w-52">
          <NativeSelectOption value="">Semua status</NativeSelectOption>
          {STATUSES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {TRANSFER_STATUS_LABEL[s]}
            </NativeSelectOption>
          ))}
        </AutoSubmitSelect>
      </form>

      {transfers.length === 0 ? (
        <EmptyState title={status || dir !== "all" ? "Tidak ada transfer yang cocok" : "Belum ada transfer"}>
          {status || dir !== "all" ? "Coba ubah saringan." : "Buat transfer saat satu cabang kelebihan stok dan cabang lain kekurangan."}
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-card">
            {transfers.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/transfers/${t.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <div className="min-w-0">
                      <p className="money text-sm font-semibold">{t.transferNo}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.fromBranch.name} ke {t.toBranch.name} · {formatNumber(t._count.items)} produk · {formatDateTime(t.createdAt)}
                      </p>
                    </div>
                    <TransferStatusBadge status={t.status} />
                  </Link>
                </li>
            ))}
          </ul>
          <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} hrefFor={hrefFor} />
        </>
      )}
    </>
  );
}

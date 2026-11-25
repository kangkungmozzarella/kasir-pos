import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { BranchPicker } from "@/components/branch-picker";
import { EmptyState, LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelectOption } from "@/components/ui/native-select";
import { requireUser } from "@/lib/auth";
import { resolveSingleBranch } from "@/lib/branch-scope";
import { db } from "@/lib/db";
import { formatNumber, formatRupiah } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Stok" };

const PAGE_SIZE = 30;

export default function StockPage({ searchParams }: PageProps<"/stock">) {
  return (
    <Suspense fallback={<LoadingText>Memuat stok...</LoadingText>}>
      <StockContent searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

async function StockContent({ searchParams }: { searchParams: PageProps<"/stock">["searchParams"] }) {
  const user = await requireUser(PERMISSIONS["stock:manage"]);
  const sp = await searchParams;
  const { branch, branches } = await resolveSingleBranch(user, one(sp.branch) || undefined);
  if (!branch) {
    return <EmptyState title="Belum ada cabang aktif">Stok dikelola per cabang. Tambahkan cabang terlebih dahulu.</EmptyState>;
  }

  const q = one(sp.q);
  const filter = one(sp.filter) || "all";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const where: Prisma.BranchStockWhereInput = {
    branchId: branch.id,
    product: {
      isActive: true,
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { barcode: { startsWith: q } },
        ],
      }),
    },
    ...(filter === "low" && { quantity: { lt: db.branchStock.fields.minStock } }),
    ...(filter === "empty" && { quantity: 0 }),
  };

  const [total, rows, lowCount] = await Promise.all([
    db.branchStock.count({ where }),
    db.branchStock.findMany({
      where,
      orderBy: [{ product: { name: "asc" } }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        quantity: true,
        minStock: true,
        priceOverride: true,
        product: { select: { id: true, name: true, sku: true, unit: true, price: true } },
      },
    }),
    db.branchStock.count({
      where: { branchId: branch.id, product: { isActive: true }, quantity: { lt: db.branchStock.fields.minStock } },
    }),
  ]);

  const base = { ...(user.role === "OWNER" && { branch: branch.id }) };
  const hrefFor = (p: number) =>
    `/stock?${new URLSearchParams({ ...base, ...(q && { q }), filter, page: String(p) })}`;
  const isOwner = user.role === "OWNER";

  return (
    <>
      <PageHeader
        title="Stok"
        description={
          lowCount > 0
            ? `${branch.name}: ${lowCount} produk di bawah stok minimum.`
            : `${branch.name}: semua produk di atas stok minimum.`
        }
        actions={isOwner && branches.length > 1 && <BranchPicker branches={branches} value={branch.id} action="/stock" />}
      />

      <form method="get" role="search" className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        {isOwner && <input type="hidden" name="branch" value={branch.id} />}
        <div className="relative sm:w-72">
          <label htmlFor="q" className="sr-only">
            Cari produk
          </label>
          <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="q" name="q" type="search" defaultValue={q} placeholder="Nama, SKU, atau barcode" className="pl-9" />
        </div>
        <label htmlFor="filter" className="sr-only">
          Tampilkan
        </label>
        <AutoSubmitSelect id="filter" name="filter" defaultValue={filter} className="w-full sm:w-52">
          <NativeSelectOption value="all">Semua produk aktif</NativeSelectOption>
          <NativeSelectOption value="low">Di bawah minimum</NativeSelectOption>
          <NativeSelectOption value="empty">Stok habis</NativeSelectOption>
        </AutoSubmitSelect>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Cari
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={filter === "low" ? "Tidak ada produk di bawah minimum" : filter === "empty" ? "Tidak ada stok yang habis" : "Tidak ada produk yang cocok"}>
          {q ? "Coba kata kunci lain." : filter !== "all" ? "Stok cabang ini aman." : "Belum ada produk aktif di katalog."}
        </EmptyState>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">Stok produk di {branch.name}</caption>
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Produk</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Stok</th>
                  <th scope="col" className="hidden px-4 py-3 text-right font-medium sm:table-cell">Minimum</th>
                  <th scope="col" className="hidden px-4 py-3 text-right font-medium md:table-cell">Harga di cabang</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const low = r.quantity < r.minStock;
                  const href = `/stock/${r.product.id}${isOwner ? `?branch=${branch.id}` : ""}`;
                  return (
                    <tr key={r.product.id} className="hover:bg-accent/60">
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <Link href={href} className="rounded font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                          {r.product.name}
                        </Link>
                        <span className="block text-muted-foreground">{r.product.sku}</span>
                      </th>
                      <td className="money px-4 py-3 text-right">
                        <span className={low ? "font-semibold text-destructive" : ""}>
                          {formatNumber(r.quantity)}
                        </span>{" "}
                        <span className="text-muted-foreground">{r.product.unit}</span>
                        {low && <span className="block text-xs font-medium text-destructive">{r.quantity === 0 ? "habis" : "menipis"}</span>}
                      </td>
                      <td className="money hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">{formatNumber(r.minStock)}</td>
                      <td className="money hidden px-4 py-3 text-right md:table-cell">
                        {formatRupiah(r.priceOverride ?? r.product.price)}
                        {r.priceOverride != null && <span className="block text-xs text-muted-foreground">khusus cabang</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} hrefFor={hrefFor} />
        </>
      )}
    </>
  );
}

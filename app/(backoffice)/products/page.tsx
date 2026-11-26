import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { EmptyState, LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelectOption } from "@/components/ui/native-select";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNumber, formatRupiah } from "@/lib/format";
import { can, PERMISSIONS, resolveBranchScope } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Produk" };

const PAGE_SIZE = 25;

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <Suspense fallback={<LoadingText>Memuat produk...</LoadingText>}>
      <ProductsContent searchParams={searchParams} />
    </Suspense>
  );
}

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

async function ProductsContent({ searchParams }: { searchParams: PageProps<"/products">["searchParams"] }) {
  const user = await requireUser(PERMISSIONS["catalog:view"]);
  const canManage = can(user.role, "catalog:manage");
  const branchId = resolveBranchScope(user);

  const sp = await searchParams;
  const q = one(sp.q);
  const category = one(sp.category);
  const status = one(sp.status) || "active";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const where: Prisma.ProductWhereInput = {
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: { startsWith: q } },
      ],
    }),
    ...(category === "none" ? { categoryId: null } : category ? { categoryId: category } : {}),
    ...(status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {}),
  };

  const [categories, total, products] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        unit: true,
        price: true,
        cost: true,
        isActive: true,
        category: { select: { name: true } },
        stocks: {
          where: branchId ? { branchId } : {},
          select: { quantity: true, minStock: true, priceOverride: true },
        },
      },
    }),
  ]);
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const hrefFor = (p: number) => {
    const params = new URLSearchParams({ ...(q && { q }), ...(category && { category }), status, page: String(p) });
    return `/products?${params}`;
  };
  const filtered = q || category || status !== "active";

  return (
    <>
      <PageHeader
        title="Produk"
        description={
          canManage
            ? "Katalog berlaku untuk semua cabang."
            : "Katalog diatur Pemilik. Pilih produk untuk mengatur stok dan harga di cabang Anda."
        }
        actions={
          canManage && (
            <Link href="/products/new" className={buttonVariants()}>
              Tambah produk
            </Link>
          )
        }
      />

      <form key={`${q}:${category}:${status}`} method="get" role="search" className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative sm:w-72">
          <label htmlFor="q" className="sr-only">
            Cari produk
          </label>
          <MagnifyingGlassIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Nama, SKU, atau barcode"
            className="pl-9"
            type="search"
          />
        </div>
        <label htmlFor="category" className="sr-only">
          Kategori
        </label>
        <AutoSubmitSelect id="category" name="category" defaultValue={category} className="w-full sm:w-48">
          <NativeSelectOption value="">Semua kategori</NativeSelectOption>
          {categories.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value="none">Tanpa kategori</NativeSelectOption>
        </AutoSubmitSelect>
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <AutoSubmitSelect id="status" name="status" defaultValue={status} className="w-full sm:w-40">
          <NativeSelectOption value="active">Aktif</NativeSelectOption>
          <NativeSelectOption value="inactive">Nonaktif</NativeSelectOption>
          <NativeSelectOption value="all">Semua status</NativeSelectOption>
        </AutoSubmitSelect>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Cari
        </button>
        {filtered && (
          <Link href="/products" className={buttonVariants({ variant: "ghost" })}>
            Hapus filter
          </Link>
        )}
      </form>

      {products.length === 0 ? (
        filtered ? (
          <EmptyState title="Tidak ada produk yang cocok">
            Coba kata kunci lain, atau{" "}
            <Link href="/products" className="underline underline-offset-4">
              tampilkan semua produk
            </Link>
            .
          </EmptyState>
        ) : (
          <EmptyState title="Katalog masih kosong">
            {canManage
              ? "Tambahkan produk pertama lewat tombol Tambah produk."
              : "Minta Pemilik menambahkan produk ke katalog."}
          </EmptyState>
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            {/* Judul kolom sekali di atas, bukan diulang di setiap baris. */}
            <div
              aria-hidden
              className="hidden grid-cols-[minmax(0,1fr)_10rem_10rem_5rem] gap-x-4 border-b px-4 py-3 text-sm text-muted-foreground sm:grid"
            >
              <span>Produk</span>
              <span className="text-right">Harga jual</span>
              <span className="text-right">{branchId ? "Stok cabang" : "Stok semua cabang"}</span>
              <span />
            </div>
            <ul className="divide-y">
              {products.map((p) => {
                const stock = p.stocks.reduce((s, x) => s + x.quantity, 0);
                const low = p.stocks.some((x) => x.quantity < x.minStock);
                const branchPrice = branchId ? p.stocks[0]?.priceOverride : null;
                const href = canManage ? `/products/${p.id}` : `/stock/${p.id}`;
                return (
                  <li key={p.id}>
                    <Link
                      href={href}
                      className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3 outline-none hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_5rem]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {p.name}
                          {!p.isActive && (
                            <Badge variant="outline" className="ml-2 align-middle">
                              Nonaktif
                            </Badge>
                          )}
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {p.sku}
                          {p.category ? ` · ${p.category.name}` : " · Tanpa kategori"}
                        </span>
                      </span>
                      <span className="money text-right sm:order-none">
                        <span className="font-semibold">{formatRupiah(branchPrice ?? p.price)}</span>
                        <span className="block text-sm text-muted-foreground">
                          {branchPrice != null ? "harga cabang" : `modal ${formatRupiah(p.cost)}`}
                        </span>
                      </span>
                      <span className="money col-span-2 text-sm sm:col-span-1 sm:text-right">
                        <span className={low ? "font-semibold text-destructive" : ""}>
                          {formatNumber(stock)} {p.unit}
                        </span>
                        {/* Di HP judul kolom tersembunyi, jadi keterangannya ditulis di baris. */}
                        <span className="text-muted-foreground sm:hidden">
                          {" "}
                          {branchId ? "di cabang" : "di semua cabang"}
                        </span>
                        {low && <span className="text-destructive sm:block"> {stock === 0 ? "habis" : "menipis"}</span>}
                      </span>
                      <span className="hidden self-center text-right text-sm font-medium text-primary sm:block">
                        {canManage ? "Ubah" : "Atur stok"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <Pagination page={page} pageCount={pageCount} total={total} hrefFor={hrefFor} />
        </>
      )}
    </>
  );
}

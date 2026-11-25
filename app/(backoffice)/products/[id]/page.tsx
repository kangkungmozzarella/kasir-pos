import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNumber, formatRupiah } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { updateProduct } from "../actions";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Ubah produk" };

export default function EditProductPage({ params }: PageProps<"/products/[id]">) {
  return (
    <Suspense fallback={<LoadingText>Memuat produk...</LoadingText>}>
      <EditProduct params={params} />
    </Suspense>
  );
}

async function EditProduct({ params }: { params: PageProps<"/products/[id]">["params"] }) {
  await requireUser(PERMISSIONS["catalog:manage"]);
  const { id } = await params;
  const [product, categories] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        stocks: {
          include: { branch: { select: { name: true, code: true } } },
          orderBy: { branch: { code: "asc" } },
        },
      },
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!product) notFound();

  return (
    <>
      <PageHeader title={product.name} description={product.sku} back={{ href: "/products", label: "Produk" }} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ProductForm
          action={updateProduct.bind(null, product.id)}
          categories={categories}
          product={{
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            unit: product.unit,
            price: product.price,
            cost: product.cost,
            categoryId: product.categoryId,
            isActive: product.isActive,
          }}
          submitLabel="Simpan perubahan"
        />
        <section aria-labelledby="per-cabang" className="self-start">
          <h2 id="per-cabang" className="text-sm font-semibold">
            Di setiap cabang
          </h2>
          <ul className="mt-2 divide-y rounded-xl border bg-card">
            {product.stocks.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/stock/${product.id}?branch=${s.branchId}`}
                  className="block px-4 py-3 outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="block font-medium">{s.branch.name}</span>
                  <span className={`money block text-sm ${s.quantity < s.minStock ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                    Stok {formatNumber(s.quantity)} {product.unit} · minimum {formatNumber(s.minStock)}
                  </span>
                  <span className="money block text-sm text-muted-foreground">
                    {s.priceOverride != null ? `Harga cabang ${formatRupiah(s.priceOverride)}` : "Harga standar"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

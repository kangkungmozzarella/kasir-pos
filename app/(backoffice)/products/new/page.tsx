import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { createProduct } from "../actions";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Tambah produk" };

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="Tambah produk" back={{ href: "/products", label: "Produk" }} />
      <Suspense fallback={<LoadingText>Menyiapkan formulir...</LoadingText>}>
        <NewProductForm />
      </Suspense>
    </>
  );
}

async function NewProductForm() {
  await requireUser(PERMISSIONS["catalog:manage"]);
  const [categories, lastSku] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findFirst({ where: { sku: { startsWith: "SKU-" } }, orderBy: { sku: "desc" }, select: { sku: true } }),
  ]);
  // Usulan SKU berikutnya dari pola SKU-0001; tetap bisa diganti.
  const next = Number(lastSku?.sku.slice(4)) + 1 || 1;

  return (
    <ProductForm
      action={createProduct}
      categories={categories}
      defaultSku={`SKU-${String(next).padStart(4, "0")}`}
      submitLabel="Simpan produk"
      redirectTo="/products"
    />
  );
}

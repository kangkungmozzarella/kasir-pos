import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { CategoryRow, CreateCategoryForm } from "./category-forms";

export const metadata: Metadata = { title: "Kategori" };

export default function CategoriesPage() {
  return (
    <>
      <PageHeader title="Kategori" description="Berlaku untuk semua cabang. Kategori yang masih dipakai produk tidak bisa dihapus." />
      <Suspense fallback={<LoadingText>Memuat kategori...</LoadingText>}>
        <CategoriesContent />
      </Suspense>
    </>
  );
}

async function CategoriesContent() {
  await requireUser(PERMISSIONS["catalog:manage"]);
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { products: true } } },
  });

  return (
    <div className="max-w-3xl space-y-4">
      <CreateCategoryForm />
      {categories.length === 0 ? (
        <EmptyState title="Belum ada kategori">
          Tambahkan kategori di atas, mis. &quot;Sembako&quot; atau &quot;Minuman&quot;, supaya produk mudah dicari di layar kasir.
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {categories.map((c) => (
            <CategoryRow key={c.id} id={c.id} name={c.name} productCount={c._count.products} />
          ))}
        </ul>
      )}
    </div>
  );
}

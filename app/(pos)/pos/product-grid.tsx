"use client";

import { cn } from "@/lib/utils";
import { formatNumber, formatRupiah } from "@/lib/format";
import type { PosCategory, PosProduct } from "./types";

type Props = {
  products: PosProduct[];
  categories: PosCategory[];
  category: string;
  onCategory: (id: string) => void;
  available: (p: PosProduct) => number;
  onAdd: (p: PosProduct) => void;
  query: string;
};

export function ProductGrid({ products, categories, category, onCategory, available, onAdd, query }: Props) {
  const used = new Set(products.map((p) => p.categoryId));
  const chips = [{ id: "", name: "Semua" }, ...categories.filter((c) => used.has(c.id))];

  return (
    <>
      <div role="radiogroup" aria-label="Kategori" className="flex shrink-0 gap-2 overflow-x-auto px-4 pb-3 sm:px-6">
        {chips.map((c) => (
          <button
            key={c.id || "all"}
            type="button"
            role="radio"
            aria-checked={category === c.id}
            onClick={() => onCategory(c.id)}
            className={cn(
              "h-11 shrink-0 rounded-lg border px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              category === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 pb-6 sm:px-6 lg:min-h-0 lg:overflow-y-auto">
        {products.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="font-semibold">{query ? `Tidak ada produk yang cocok dengan "${query}"` : "Tidak ada produk di kategori ini"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {query ? "Periksa ejaan, atau pindai barcode-nya." : "Pilih kategori lain atau Semua."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
            {products.map((p) => {
              const left = available(p);
              const out = left <= 0;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={out}
                    onClick={() => onAdd(p)}
                    aria-label={`Tambah ${p.name}, ${formatRupiah(p.price)}${out ? ", stok habis" : ""}`}
                    className="flex h-full min-h-28 w-full flex-col rounded-lg border bg-card p-3 text-left outline-none transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-card"
                  >
                    <span className="line-clamp-2 text-sm leading-snug font-medium">{p.name}</span>
                    <span className="money mt-auto pt-2 font-bold">{formatRupiah(p.price)}</span>
                    <span className={cn("money text-xs", out ? "font-semibold text-destructive" : "text-muted-foreground")}>
                      {out ? "Stok habis" : `Sisa ${formatNumber(left)} ${p.unit}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

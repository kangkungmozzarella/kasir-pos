"use client";

import { useMemo, useState, useTransition } from "react";
import { MagnifyingGlassIcon, TrashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/format";
import { saveTransferAction } from "./actions";

type Branch = { id: string; name: string; code: string };
type Product = { id: string; name: string; sku: string; unit: string; stock: number };

type Props = {
  transferId?: string;
  branches: Branch[];
  origins: Branch[];
  products: Record<string, Product[]>;
  initial?: { fromBranchId: string; toBranchId: string; note: string; items: { productId: string; qty: number }[] };
};

const RESULT_LIMIT = 8;

export function TransferForm({ transferId, branches, origins, products, initial }: Props) {
  const [from, setFrom] = useState(initial?.fromBranchId ?? origins[0]?.id ?? "");
  const destinations = branches.filter((b) => b.id !== from);
  const [to, setTo] = useState(initial?.toBranchId ?? destinations[0]?.id ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [items, setItems] = useState<{ productId: string; qty: string }[]>(
    initial?.items.map((i) => ({ productId: i.productId, qty: String(i.qty) })) ?? [],
  );
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const catalog = useMemo(() => new Map((products[from] ?? []).map((p) => [p.id, p])), [products, from]);
  const chosen = new Set(items.map((i) => i.productId));
  const q = query.trim().toLowerCase();
  const results = q
    ? (products[from] ?? []).filter((p) => !chosen.has(p.id) && (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))).slice(0, RESULT_LIMIT)
    : [];

  function changeOrigin(id: string) {
    setFrom(id);
    setItems([]); // stok dan produk berbeda per cabang
    if (to === id) setTo(branches.find((b) => b.id !== id)?.id ?? "");
  }

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const res = await saveTransferAction(transferId ?? null, {
        fromBranchId: from,
        toBranchId: to,
        note,
        items: items.map((i) => ({ productId: i.productId, qty: Number(i.qty) || 0 })),
      });
      if (!res.ok) setError(res.error);
    });
  }

  if (destinations.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Transfer butuh minimal dua cabang aktif.</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="from" className="text-sm font-medium">
            Dari cabang
          </label>
          {origins.length > 1 && !transferId ? (
            <NativeSelect id="from" value={from} onChange={(e) => changeOrigin(e.target.value)} className="w-full">
              {origins.map((b) => (
                <NativeSelectOption key={b.id} value={b.id}>
                  {b.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : (
            <p id="from" className="flex h-11 items-center rounded-lg border bg-muted/50 px-3 text-sm">
              {branches.find((b) => b.id === from)?.name}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="to" className="text-sm font-medium">
            Ke cabang
          </label>
          <NativeSelect id="to" value={to} onChange={(e) => setTo(e.target.value)} className="w-full">
            {destinations.map((b) => (
              <NativeSelectOption key={b.id} value={b.id}>
                {b.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      <section aria-labelledby="items-title">
        <h2 id="items-title" className="font-semibold">
          Barang yang dikirim
        </h2>
        <div className="relative mt-2">
          <label htmlFor="product-search" className="sr-only">
            Cari produk untuk ditambahkan
          </label>
          <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="product-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau SKU, lalu pilih"
            className="pl-9"
            aria-controls="product-results"
          />
        </div>
        {q && (
          <ul id="product-results" aria-label="Hasil pencarian" className="mt-1 divide-y rounded-lg border bg-card">
            {results.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-muted-foreground">Tidak ada produk yang cocok, atau sudah ada di daftar.</li>
            ) : (
              results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setItems((list) => [...list, { productId: p.id, qty: "1" }]);
                      setQuery("");
                      requestAnimationFrame(() => document.getElementById(`qty-${p.id}`)?.focus());
                    }}
                    className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="money shrink-0 text-muted-foreground">
                      sisa {formatNumber(p.stock)} {p.unit}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}

        {items.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Belum ada barang. Cari produk di atas untuk menambahkan.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-xl border bg-card" aria-label="Daftar barang">
            {items.map((item, idx) => {
              const p = catalog.get(item.productId);
              const qty = Number(item.qty) || 0;
              const over = p && qty > p.stock;
              return (
                <li key={item.productId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`qty-${item.productId}`} className="block text-sm font-medium">
                      <span className="sr-only">Jumlah </span>
                      {p?.name ?? "Produk tidak tersedia di cabang asal"}
                    </label>
                    <p className={over ? "text-xs font-medium text-destructive" : "money text-xs text-muted-foreground"}>
                      {p ? (over ? `Melebihi stok asal (sisa ${formatNumber(p.stock)} ${p.unit})` : `Sisa di asal ${formatNumber(p.stock)} ${p.unit}`) : "Hapus dari daftar."}
                    </p>
                  </div>
                  <Input
                    id={`qty-${item.productId}`}
                    inputMode="numeric"
                    value={item.qty}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setItems((list) => list.map((x, i) => (i === idx ? { ...x, qty: v } : x)));
                    }}
                    aria-invalid={over || undefined}
                    className="money w-24 text-right"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Hapus ${p?.name ?? "produk"}`}
                    onClick={() => setItems((list) => list.filter((_, i) => i !== idx))}
                  >
                    <TrashIcon className="size-5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-1.5">
        <label htmlFor="note" className="text-sm font-medium">
          Catatan (opsional)
        </label>
        <Textarea id="note" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mis. untuk stok akhir pekan" />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Menyimpan..." : transferId ? "Simpan perubahan" : "Simpan sebagai draf"}
        </Button>
        <p className="text-sm text-muted-foreground">Stok belum berubah sampai transfer dikirim.</p>
      </div>
    </div>
  );
}

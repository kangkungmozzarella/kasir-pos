"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CartAction, CartLine } from "@/lib/cart";
import { formatNumber, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseRupiah } from "@/lib/validation";
import type { PosProduct } from "./types";

type Props = {
  lines: CartLine[];
  selectedId: string | null;
  productOf: (id: string) => PosProduct | undefined;
  dispatch: (a: CartAction) => void;
};

export function CartLines({ lines, selectedId, productOf, dispatch }: Props) {
  if (lines.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <p className="font-semibold">Keranjang kosong</p>
        <p className="mt-1 max-w-56 text-sm text-muted-foreground">Pindai barcode atau pilih produk untuk memulai transaksi.</p>
      </div>
    );
  }
  return (
    <ul className="flex-1 divide-y lg:min-h-0 lg:overflow-y-auto" aria-label="Isi keranjang">
      {lines.map((line) => (
        <CartRow
          key={line.productId}
          line={line}
          product={productOf(line.productId)}
          selected={line.productId === selectedId}
          dispatch={dispatch}
        />
      ))}
    </ul>
  );
}

function CartRow({
  line,
  product,
  selected,
  dispatch,
}: {
  line: CartLine;
  product: PosProduct | undefined;
  selected: boolean;
  dispatch: (a: CartAction) => void;
}) {
  const [editingDiscount, setEditingDiscount] = useState(false);
  const id = line.productId;

  if (!product) {
    return (
      <li className="flex items-center gap-3 px-4 py-3">
        <p className="flex-1 text-sm text-destructive">Produk ini sudah tidak dijual. Hapus dari keranjang.</p>
        <Button variant="ghost" size="icon" aria-label="Hapus dari keranjang" onClick={() => dispatch({ type: "remove", productId: id })}>
          <TrashIcon className="size-5" />
        </Button>
      </li>
    );
  }

  const gross = product.price * line.qty;
  const max = product.stock;

  return (
    <li
      className={cn("px-4 py-3", selected && "bg-secondary")}
      aria-current={selected || undefined}
      onFocusCapture={() => !selected && dispatch({ type: "select", productId: id })}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm leading-snug font-medium">{product.name}</p>
          <p className="money text-xs text-muted-foreground">{formatRupiah(product.price)} / {product.unit}</p>
        </div>
        <p className="money shrink-0 text-right font-semibold">
          {formatRupiah(gross - line.discount)}
          {line.discount > 0 && <span className="block text-xs font-normal text-muted-foreground line-through">{formatRupiah(gross)}</span>}
        </p>
      </div>

      <div className="mt-2 flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label={`Kurangi ${product.name}`} onClick={() => dispatch({ type: "step", productId: id, delta: -1, max })}>
          <MinusIcon className="size-4" />
        </Button>
        <label className="sr-only" htmlFor={`qty-${id}`}>
          Jumlah {product.name}
        </label>
        <input
          id={`qty-${id}`}
          inputMode="numeric"
          value={line.qty}
          onChange={(e) => dispatch({ type: "setQty", productId: id, qty: Number(e.target.value.replace(/\D/g, "")) || 0, max })}
          className="money h-11 w-14 rounded-lg border border-input bg-card text-center font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button
          variant="outline"
          size="icon"
          aria-label={`Tambah ${product.name}`}
          disabled={line.qty >= max}
          onClick={() => dispatch({ type: "step", productId: id, delta: 1, max })}
        >
          <PlusIcon className="size-4" />
        </Button>
        <Button variant="ghost" className="ml-auto px-3" onClick={() => setEditingDiscount((v) => !v)} aria-expanded={editingDiscount}>
          Diskon
        </Button>
        <Button variant="ghost" size="icon" aria-label={`Hapus ${product.name}`} onClick={() => dispatch({ type: "remove", productId: id })}>
          <TrashIcon className="size-5" />
        </Button>
      </div>
      {line.qty >= max && <p className="mt-1 text-xs text-muted-foreground">Sudah semua stok ({formatNumber(max)}).</p>}

      {editingDiscount && (
        <AmountInput
          label={`Diskon untuk ${product.name}`}
          hint={`Potongan total untuk baris ini, maksimal ${formatRupiah(gross)}.`}
          value={line.discount}
          onCommit={(v) => {
            dispatch({ type: "setDiscount", productId: id, discount: v, unitPrice: product.price });
            setEditingDiscount(false);
          }}
          onCancel={() => setEditingDiscount(false)}
        />
      )}
    </li>
  );
}

/** Input nominal Rupiah kecil (diskon). Enter menyimpan, Escape membatalkan. */
export function AmountInput({
  label,
  hint,
  value,
  onCommit,
  onCancel,
}: {
  label: string;
  hint: string;
  value: number;
  onCommit: (v: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  const [error, setError] = useState<string>();
  const inputId = `amount-${label.replace(/\W+/g, "-")}`;

  function commit() {
    const n = text.trim() === "" ? 0 : parseRupiah(text);
    if (n === null) return setError("Masukkan nominal tanpa desimal, mis. 2.000.");
    onCommit(n);
  }

  return (
    <div className="mt-2 rounded-lg border bg-card p-3">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div className="mt-1.5 flex gap-2">
        <Input
          id={inputId}
          inputMode="numeric"
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }
          }}
          aria-invalid={!!error || undefined}
          aria-describedby={`${inputId}-hint`}
          className="money"
        />
        <Button onClick={commit}>Simpan</Button>
      </div>
      <p id={`${inputId}-hint`} className={cn("mt-1 text-xs", error ? "text-destructive" : "text-muted-foreground")}>
        {error ?? hint}
      </p>
    </div>
  );
}

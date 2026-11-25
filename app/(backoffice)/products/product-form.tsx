"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { fieldError, FormError, initial, useActionFeedback } from "@/components/form-bits";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { formatRupiah } from "@/lib/format";
import { parseRupiah } from "@/lib/validation";

type Product = {
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  price: number;
  cost: number;
  categoryId: string | null;
  isActive: boolean;
};

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  categories: { id: string; name: string }[];
  product?: Product;
  defaultSku?: string;
  submitLabel: string;
  /** Ke mana setelah sukses (untuk form tambah). Kosong = tetap di halaman. */
  redirectTo?: string;
};

export function ProductForm({ action, categories, product, defaultSku, submitLabel, redirectTo }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialActionState);
  useActionFeedback(state, () => redirectTo && router.push(redirectTo));

  const [price, setPrice] = useState(initial(state, "price", product?.price));
  const [cost, setCost] = useState(initial(state, "cost", product?.cost));

  const f = (key: keyof Product | "price" | "cost") => ({
    id: key,
    name: key,
    "aria-invalid": !!fieldError(state, key) || undefined,
  });

  return (
    <form action={formAction} className="max-w-2xl space-y-6" noValidate>
      <FieldGroup>
        <Field data-invalid={!!fieldError(state, "name") || undefined}>
          <FieldLabel htmlFor="name">Nama produk</FieldLabel>
          <Input {...f("name")} defaultValue={initial(state, "name", product?.name)} placeholder="mis. Gula Pasir 1 kg" />
          <FieldError>{fieldError(state, "name")}</FieldError>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!fieldError(state, "sku") || undefined}>
            <FieldLabel htmlFor="sku">SKU</FieldLabel>
            <Input {...f("sku")} defaultValue={initial(state, "sku", product?.sku ?? defaultSku)} />
            <FieldError>{fieldError(state, "sku")}</FieldError>
          </Field>
          <Field data-invalid={!!fieldError(state, "barcode") || undefined}>
            <FieldLabel htmlFor="barcode">Barcode</FieldLabel>
            <Input
              {...f("barcode")}
              inputMode="numeric"
              defaultValue={initial(state, "barcode", product?.barcode)}
              placeholder="Opsional, bisa dipindai"
            />
            <FieldDescription>Arahkan kursor ke sini lalu pindai dengan scanner.</FieldDescription>
            <FieldError>{fieldError(state, "barcode")}</FieldError>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!fieldError(state, "categoryId") || undefined}>
            <FieldLabel htmlFor="categoryId">Kategori</FieldLabel>
            <NativeSelect {...f("categoryId")} defaultValue={initial(state, "categoryId", product?.categoryId)} className="w-full">
              <NativeSelectOption value="">Tanpa kategori</NativeSelectOption>
              {categories.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError>{fieldError(state, "categoryId")}</FieldError>
          </Field>
          <Field data-invalid={!!fieldError(state, "unit") || undefined}>
            <FieldLabel htmlFor="unit">Satuan</FieldLabel>
            <Input {...f("unit")} defaultValue={initial(state, "unit", product?.unit ?? "pcs")} placeholder="pcs, botol, kg" />
            <FieldError>{fieldError(state, "unit")}</FieldError>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!fieldError(state, "price") || undefined}>
            <FieldLabel htmlFor="price">Harga jual</FieldLabel>
            <Input {...f("price")} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="18.500" className="money" />
            <FieldDescription>Belum termasuk pajak. Harga per cabang bisa diatur di halaman Stok.</FieldDescription>
            <FieldError>{fieldError(state, "price")}</FieldError>
          </Field>
          <Field data-invalid={!!fieldError(state, "cost") || undefined}>
            <FieldLabel htmlFor="cost">Harga modal</FieldLabel>
            <Input {...f("cost")} inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="16.800" className="money" />
            <FieldError>{fieldError(state, "cost")}</FieldError>
          </Field>
        </div>
        <MarginHint price={price} cost={cost} />

        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <Checkbox name="isActive" value="on" defaultChecked={state.values ? state.values.isActive === "on" : (product?.isActive ?? true)} />
          <span className="text-sm">
            <span className="font-medium">Aktif dijual</span>
            <span className="block text-muted-foreground">
              Produk nonaktif tidak muncul di layar kasir, tapi riwayat penjualannya tetap tersimpan.
            </span>
          </span>
        </label>
      </FieldGroup>

      <FormError state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Menyimpan..." : submitLabel}
      </Button>
    </form>
  );
}

/** Laba kotor per unit, dihitung saat mengetik supaya salah ketik harga cepat ketahuan. */
function MarginHint({ price, cost }: { price: string; cost: string }) {
  const p = parseRupiah(price);
  const c = parseRupiah(cost);
  if (p === null || c === null || p === 0) return null;
  const margin = p - c;
  const pct = Math.round((margin / p) * 100);
  return (
    <p aria-live="polite" className={`money text-sm ${margin < 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
      {margin < 0
        ? `Harga jual di bawah modal: rugi ${formatRupiah(-margin)} per unit.`
        : `Laba kotor ${formatRupiah(margin)} per unit (${pct}% dari harga jual).`}
    </p>
  );
}

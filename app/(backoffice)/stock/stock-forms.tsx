"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { fieldError, FormError, initial, useActionFeedback } from "@/components/form-bits";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { formatRupiah } from "@/lib/format";

type BoundAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const id = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <section aria-labelledby={id} className="rounded-xl border bg-card p-5">
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      <p className="mt-0.5 mb-4 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

export function StockInForm({ action, unit }: { action: BoundAction; unit: string }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useActionFeedback(state, () => formRef.current?.reset());
  const keep = !state.ok;

  return (
    <Panel title="Barang masuk" description="Catat barang yang diterima dari pemasok.">
      <form ref={formRef} action={formAction} noValidate>
        <FieldGroup>
          <Field data-invalid={!!fieldError(state, "quantity") || undefined}>
            <FieldLabel htmlFor="in-quantity">Jumlah ({unit})</FieldLabel>
            <Input id="in-quantity" name="quantity" inputMode="numeric" className="money" defaultValue={keep ? initial(state, "quantity", "") : ""} aria-invalid={!!fieldError(state, "quantity") || undefined} />
            <FieldError>{fieldError(state, "quantity")}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="in-note">Catatan</FieldLabel>
            <Input id="in-note" name="note" placeholder="Opsional, mis. nomor faktur pemasok" defaultValue={keep ? initial(state, "note", "") : ""} />
          </Field>
          <FormError state={state} />
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan..." : "Tambah stok"}
          </Button>
        </FieldGroup>
      </form>
    </Panel>
  );
}

export function OpnameForm({ action, current, unit }: { action: BoundAction; current: number; unit: string }) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useActionFeedback(state, () => formRef.current?.reset());
  const keep = !state.ok;

  return (
    <Panel title="Stok opname" description={`Masukkan hasil hitung fisik. Tercatat sekarang: ${current} ${unit}.`}>
      <form ref={formRef} action={formAction} noValidate>
        <FieldGroup>
          <Field data-invalid={!!fieldError(state, "counted") || undefined}>
            <FieldLabel htmlFor="counted">Hasil hitung ({unit})</FieldLabel>
            <Input id="counted" name="counted" inputMode="numeric" className="money" defaultValue={keep ? initial(state, "counted", "") : ""} aria-invalid={!!fieldError(state, "counted") || undefined} />
            <FieldError>{fieldError(state, "counted")}</FieldError>
          </Field>
          <Field data-invalid={!!fieldError(state, "note") || undefined}>
            <FieldLabel htmlFor="count-note">Alasan</FieldLabel>
            <Input id="count-note" name="note" placeholder="mis. Hitung bulanan, barang rusak" defaultValue={keep ? initial(state, "note", "") : ""} aria-invalid={!!fieldError(state, "note") || undefined} />
            <FieldDescription>Wajib, supaya selisih stok bisa diaudit.</FieldDescription>
            <FieldError>{fieldError(state, "note")}</FieldError>
          </Field>
          <FormError state={state} />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Menyimpan..." : "Simpan hasil hitung"}
          </Button>
        </FieldGroup>
      </form>
    </Panel>
  );
}

export function BranchSettingsForm({
  action,
  minStock,
  priceOverride,
  basePrice,
}: {
  action: BoundAction;
  minStock: number;
  priceOverride: number | null;
  basePrice: number;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  useActionFeedback(state);

  return (
    <Panel title="Pengaturan cabang" description="Hanya berlaku di cabang ini.">
      <form action={formAction} noValidate>
        <FieldGroup>
          <Field data-invalid={!!fieldError(state, "minStock") || undefined}>
            <FieldLabel htmlFor="minStock">Stok minimum</FieldLabel>
            <Input id="minStock" name="minStock" inputMode="numeric" className="money" defaultValue={initial(state, "minStock", minStock)} aria-invalid={!!fieldError(state, "minStock") || undefined} />
            <FieldDescription>Di bawah angka ini, produk ditandai menipis di dashboard.</FieldDescription>
            <FieldError>{fieldError(state, "minStock")}</FieldError>
          </Field>
          <Field data-invalid={!!fieldError(state, "priceOverride") || undefined}>
            <FieldLabel htmlFor="priceOverride">Harga khusus cabang</FieldLabel>
            <Input id="priceOverride" name="priceOverride" inputMode="numeric" className="money" defaultValue={initial(state, "priceOverride", priceOverride)} aria-invalid={!!fieldError(state, "priceOverride") || undefined} />
            <FieldDescription>Kosongkan untuk memakai harga standar {formatRupiah(basePrice)}.</FieldDescription>
            <FieldError>{fieldError(state, "priceOverride")}</FieldError>
          </Field>
          <FormError state={state} />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Menyimpan..." : "Simpan pengaturan"}
          </Button>
        </FieldGroup>
      </form>
    </Panel>
  );
}

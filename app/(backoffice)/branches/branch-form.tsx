"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldError, FormError, initial, useActionFeedback } from "@/components/form-bits";
import { initialActionState, type ActionState } from "@/lib/action-state";

type Branch = {
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  taxRate: number;
  receiptFooter: string | null;
  isActive: boolean;
};

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  branch?: Branch;
  submitLabel: string;
  redirectTo?: string;
};

export function BranchForm({ action, branch, submitLabel, redirectTo }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialActionState);
  useActionFeedback(state, () => redirectTo && router.push(redirectTo));

  const field = (key: keyof Branch) => ({
    id: key,
    name: key,
    "aria-invalid": !!fieldError(state, key) || undefined,
  });
  const invalid = (key: string) => !!fieldError(state, key) || undefined;

  return (
    <form action={formAction} className="max-w-2xl" noValidate>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <Field data-invalid={invalid("code")}>
            <FieldLabel htmlFor="code">Kode</FieldLabel>
            {branch ? (
              <p id="code" className="money flex h-11 items-center rounded-lg border bg-muted/50 px-3 text-sm">
                {branch.code}
              </p>
            ) : (
              <Input {...field("code")} defaultValue={initial(state, "code", "")} placeholder="MDN03" className="money uppercase" />
            )}
            <FieldError>{fieldError(state, "code")}</FieldError>
          </Field>
          <Field data-invalid={invalid("name")}>
            <FieldLabel htmlFor="name">Nama cabang</FieldLabel>
            <Input {...field("name")} defaultValue={initial(state, "name", branch?.name)} placeholder="Toko Contoh Medan Johor" />
            <FieldError>{fieldError(state, "name")}</FieldError>
          </Field>
        </div>
        {!branch && <FieldDescription className="-mt-3">Kode dipakai di nomor struk (mis. MDN03-20261126-0001) dan tidak bisa diubah setelah dibuat.</FieldDescription>}

        <Field data-invalid={invalid("address")}>
          <FieldLabel htmlFor="address">Alamat</FieldLabel>
          <Input {...field("address")} defaultValue={initial(state, "address", branch?.address)} />
          <FieldError>{fieldError(state, "address")}</FieldError>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={invalid("phone")}>
            <FieldLabel htmlFor="phone">Telepon</FieldLabel>
            <Input {...field("phone")} inputMode="tel" defaultValue={initial(state, "phone", branch?.phone)} />
            <FieldError>{fieldError(state, "phone")}</FieldError>
          </Field>
          <Field data-invalid={invalid("taxRate")}>
            <FieldLabel htmlFor="taxRate">Tarif PPN (%)</FieldLabel>
            <Input {...field("taxRate")} inputMode="numeric" defaultValue={initial(state, "taxRate", branch?.taxRate ?? 11)} className="money" />
            <FieldDescription>Berlaku untuk transaksi berikutnya. Transaksi lama tetap memakai tarif saat itu.</FieldDescription>
            <FieldError>{fieldError(state, "taxRate")}</FieldError>
          </Field>
        </div>

        <Field data-invalid={invalid("receiptFooter")}>
          <FieldLabel htmlFor="receiptFooter">Catatan kaki struk</FieldLabel>
          <Input
            {...field("receiptFooter")}
            defaultValue={initial(state, "receiptFooter", branch?.receiptFooter ?? "Terima kasih telah berbelanja!")}
          />
          <FieldError>{fieldError(state, "receiptFooter")}</FieldError>
        </Field>

        <label className="flex items-start gap-3">
          <Checkbox name="isActive" value="on" defaultChecked={state.values ? state.values.isActive === "on" : (branch?.isActive ?? true)} />
          <span className="text-sm">
            <span className="font-medium">Cabang aktif</span>
            <span className="block text-muted-foreground">
              Cabang nonaktif tidak bisa membuka shift atau menerima transfer. Riwayat penjualannya tetap tersimpan.
            </span>
          </span>
        </label>

        <FormError state={state} />
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan..." : submitLabel}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

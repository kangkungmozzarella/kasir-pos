"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { fieldError, FormError, initial, useActionFeedback } from "@/components/form-bits";
import { initialActionState } from "@/lib/action-state";
import { openShiftAction } from "./actions";

export function OpenShiftForm({ branches }: { branches: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(openShiftAction, initialActionState);
  useActionFeedback(state);
  const err = fieldError(state, "openingCash");

  return (
    <form action={action} noValidate className="mt-6">
      <FieldGroup>
        {branches.length > 1 ? (
          <Field data-invalid={!!fieldError(state, "branchId") || undefined}>
            <FieldLabel htmlFor="branchId">Cabang</FieldLabel>
            <NativeSelect id="branchId" name="branchId" defaultValue={initial(state, "branchId", "")} className="w-full">
              <NativeSelectOption value="" disabled>
                Pilih cabang tempat Anda berjaga
              </NativeSelectOption>
              {branches.map((b) => (
                <NativeSelectOption key={b.id} value={b.id}>
                  {b.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <input type="hidden" name="branchId" value={branches[0]?.id ?? ""} />
        )}
        <Field data-invalid={!!err || undefined}>
          <FieldLabel htmlFor="openingCash">Modal awal di laci</FieldLabel>
          <Input
            id="openingCash"
            name="openingCash"
            inputMode="numeric"
            autoFocus
            placeholder="500.000"
            defaultValue={initial(state, "openingCash", "")}
            aria-invalid={!!err || undefined}
            className="money h-12 text-lg"
          />
          <FieldDescription>Hitung uang di laci sebelum mulai. Angka ini dipakai saat tutup shift.</FieldDescription>
          <FieldError>{err}</FieldError>
        </Field>
        <FormError state={state} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Membuka shift..." : "Buka shift"}
        </Button>
      </FieldGroup>
    </form>
  );
}

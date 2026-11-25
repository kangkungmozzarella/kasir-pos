"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { fieldError, FormError, initial, useActionFeedback } from "@/components/form-bits";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { ROLE_LABEL, type Role } from "@/lib/roles";

type User = { name: string; email: string; role: Role; branchId: string | null; isActive: boolean; hasPin: boolean };

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  roles: Role[];
  branches: { id: string; name: string }[];
  user?: User;
  redirectTo?: string;
};

export function UserForm({ action, roles, branches, user, redirectTo }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialActionState);
  useActionFeedback(state, () => redirectTo && router.push(redirectTo));
  const editing = !!user;
  const invalid = (k: string) => !!fieldError(state, k) || undefined;

  return (
    <form action={formAction} className="max-w-xl space-y-6" noValidate>
      <FieldGroup>
        <Field data-invalid={invalid("name")}>
          <FieldLabel htmlFor="name">Nama</FieldLabel>
          <Input id="name" name="name" defaultValue={initial(state, "name", user?.name)} aria-invalid={invalid("name")} placeholder="Nama yang tampil di struk" />
          <FieldError>{fieldError(state, "name")}</FieldError>
        </Field>
        <Field data-invalid={invalid("email")}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="off" defaultValue={initial(state, "email", user?.email)} aria-invalid={invalid("email")} placeholder="nama@tokoanda.id" />
          <FieldDescription>Dipakai untuk masuk.</FieldDescription>
          <FieldError>{fieldError(state, "email")}</FieldError>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {roles.length > 1 ? (
            <Field data-invalid={invalid("role")}>
              <FieldLabel htmlFor="role">Role</FieldLabel>
              <NativeSelect id="role" name="role" defaultValue={initial(state, "role", user?.role ?? roles.at(-1))} className="w-full">
                {roles.map((r) => (
                  <NativeSelectOption key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError>{fieldError(state, "role")}</FieldError>
            </Field>
          ) : (
            <input type="hidden" name="role" value={roles[0]} />
          )}
          {branches.length > 1 ? (
            <Field data-invalid={invalid("branchId")}>
              <FieldLabel htmlFor="branchId">Cabang</FieldLabel>
              <NativeSelect id="branchId" name="branchId" defaultValue={initial(state, "branchId", user?.branchId ?? "")} className="w-full">
                <NativeSelectOption value="" disabled>
                  Pilih cabang
                </NativeSelectOption>
                {branches.map((b) => (
                  <NativeSelectOption key={b.id} value={b.id}>
                    {b.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError>{fieldError(state, "branchId")}</FieldError>
            </Field>
          ) : (
            <input type="hidden" name="branchId" value={branches[0]?.id ?? ""} />
          )}
        </div>

        <Field data-invalid={invalid("password")}>
          <FieldLabel htmlFor="password">{editing ? "Kata sandi baru" : "Kata sandi"}</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={invalid("password")} />
          <FieldDescription>{editing ? "Kosongkan bila tidak diganti. Minimal 8 karakter." : "Minimal 8 karakter."}</FieldDescription>
          <FieldError>{fieldError(state, "password")}</FieldError>
        </Field>

        <Field data-invalid={invalid("pin")}>
          <FieldLabel htmlFor="pin">{editing && user?.hasPin ? "PIN baru" : "PIN kasir"}</FieldLabel>
          <Input id="pin" name="pin" inputMode="numeric" autoComplete="off" maxLength={6} className="money w-40" aria-invalid={invalid("pin")} />
          <FieldDescription>
            Opsional, 4 sampai 6 digit untuk ganti kasir cepat di layar kasir.
            {editing && (user?.hasPin ? " PIN sudah diatur; kosongkan bila tidak diganti." : " Belum ada PIN.")}
          </FieldDescription>
          <FieldError>{fieldError(state, "pin")}</FieldError>
        </Field>

        {editing && user?.hasPin && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <Checkbox name="clearPin" value="on" defaultChecked={state.values?.clearPin === "on"} />
            Hapus PIN
          </label>
        )}

        {editing && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <Checkbox name="isActive" value="on" defaultChecked={state.values ? state.values.isActive === "on" : user.isActive} />
            <span className="text-sm">
              <span className="font-medium">Akun aktif</span>
              <span className="block text-muted-foreground">Akun nonaktif tidak bisa masuk dan langsung keluar dari semua perangkat.</span>
            </span>
          </label>
        )}
      </FieldGroup>

      <FormError state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Menyimpan..." : editing ? "Simpan perubahan" : "Buat akun"}
      </Button>
    </form>
  );
}

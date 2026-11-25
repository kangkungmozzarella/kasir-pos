"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { ROLE_LABEL } from "@/lib/roles";
import { login, type LoginState } from "./actions";

export function LoginPanel() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fillDemo(email: string) {
    if (!emailRef.current || !passwordRef.current) return;
    emailRef.current.value = email;
    passwordRef.current.value = DEMO_PASSWORD;
    passwordRef.current.focus();
  }

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:gap-14">
      <section aria-labelledby="login-title" className="self-start rounded-xl border bg-card p-6 sm:p-8">
        <h1 id="login-title" className="text-2xl font-bold tracking-tight">
          Masuk
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Pakai akun yang diberikan admin cabang.</p>

        <form action={formAction} className="mt-6" noValidate>
          <FieldGroup>
            <Field data-invalid={!!state.fieldErrors?.email || undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="nama@tokoanda.id"
                defaultValue={state.email}
                aria-invalid={!!state.fieldErrors?.email || undefined}
                autoFocus
                required
              />
              <FieldError>{state.fieldErrors?.email?.[0]}</FieldError>
            </Field>
            <Field data-invalid={!!state.fieldErrors?.password || undefined}>
              <FieldLabel htmlFor="password">Kata sandi</FieldLabel>
              <Input
                ref={passwordRef}
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!state.fieldErrors?.password || undefined}
                required
              />
              <FieldError>{state.fieldErrors?.password?.[0]}</FieldError>
            </Field>

            {state.error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={pending} className="w-full">
              {pending ? "Memeriksa akun..." : "Masuk"}
            </Button>
          </FieldGroup>
        </form>
      </section>

      <section aria-labelledby="demo-title" className="md:pt-2">
        <h2 id="demo-title" className="text-lg font-semibold">
          Coba pakai akun demo
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Toko, produk, dan transaksi di sini fiktif. Pembayaran QRIS dan kartu hanya simulasi, tidak ada uang yang
          berpindah. Kata sandi semua akun: <code className="font-mono font-semibold text-foreground">{DEMO_PASSWORD}</code>
        </p>

        <ul className="mt-5 divide-y rounded-xl border bg-card">
          {DEMO_ACCOUNTS.map((acc) => (
            <li key={acc.email} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {ROLE_LABEL[acc.role]}
                  <span className="font-normal text-muted-foreground">
                    {acc.branch ? ` · ${acc.branch}` : " · semua cabang"}
                  </span>
                </p>
                <p className="truncate text-sm text-muted-foreground">{acc.email}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => fillDemo(acc.email)}
                aria-label={`Isi formulir dengan akun ${ROLE_LABEL[acc.role]}${acc.branch ? ` ${acc.branch}` : ""}`}
              >
                Isi
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

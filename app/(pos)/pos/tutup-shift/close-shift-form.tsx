"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fieldError, FormError, initial } from "@/components/form-bits";
import { initialActionState } from "@/lib/action-state";
import { formatNumber, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseRupiah } from "@/lib/validation";
import { closeShiftAction } from "../actions";

const NOTES = [100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000] as const;

/**
 * Hitung buta: kasir mengisi jumlah uang di laci tanpa melihat angka sistem, supaya
 * hitungannya jujur. Kas yang diharapkan dan selisihnya baru ditampilkan setelah tutup.
 */
export function CloseShiftForm() {
  const [state, action, pending] = useActionState(closeShiftAction, initialActionState);
  const [mode, setMode] = useState<"total" | "pecahan">("total");
  const [text, setText] = useState(() => initial(state, "countedCash", ""));
  const [sheets, setSheets] = useState<Record<number, string>>({});
  const [coins, setCoins] = useState("");
  const [confirming, setConfirming] = useState(false);

  const sheetTotal = NOTES.reduce((s, n) => s + n * (Number(sheets[n]) || 0), 0);
  const coinTotal = parseRupiah(coins || "0") ?? 0;
  const counted = mode === "pecahan" ? sheetTotal + coinTotal : parseRupiah(text);
  const err = fieldError(state, "countedCash");

  return (
    <form action={action} noValidate className="mt-6">
      <input type="hidden" name="countedCash" value={counted === null ? text : String(counted)} />
      <FieldGroup>
        <fieldset>
          <legend className="text-sm font-medium">Cara menghitung</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ["total", "Isi totalnya"],
                ["pecahan", "Per pecahan"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  mode === value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => {
                    setMode(value);
                    setConfirming(false);
                  }}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {mode === "total" ? (
          <Field data-invalid={!!err || undefined}>
            <FieldLabel htmlFor="counted">Uang di laci sekarang</FieldLabel>
            <Input
              id="counted"
              inputMode="numeric"
              autoFocus
              placeholder="1.250.000"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setConfirming(false);
              }}
              aria-invalid={!!err || undefined}
              aria-describedby="counted-hint"
              className="money h-12 text-lg"
            />
            <FieldDescription id="counted-hint">Termasuk modal awal. Angka sistem ditampilkan setelah shift ditutup.</FieldDescription>
            <FieldError>{err}</FieldError>
          </Field>
        ) : (
          <div>
            <table className="w-full text-sm">
              <caption className="mb-2 text-left text-sm font-medium">Jumlah lembar per pecahan</caption>
              <tbody>
                {NOTES.map((n) => {
                  const id = `lembar-${n}`;
                  const qty = Number(sheets[n]) || 0;
                  return (
                    <tr key={n} className="border-b last:border-0">
                      <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                        <label htmlFor={id} className="money">
                          {formatRupiah(n)}
                        </label>
                      </th>
                      <td className="w-24 py-1.5">
                        <Input
                          id={id}
                          inputMode="numeric"
                          value={sheets[n] ?? ""}
                          placeholder="0"
                          onChange={(e) => {
                            setSheets((s) => ({ ...s, [n]: e.target.value.replace(/\D/g, "").slice(0, 5) }));
                            setConfirming(false);
                          }}
                          className="money text-right"
                        />
                      </td>
                      <td className="money py-1.5 pl-3 text-right text-muted-foreground">{qty > 0 ? formatNumber(n * qty) : ""}</td>
                    </tr>
                  );
                })}
                <tr>
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                    <label htmlFor="koin">Koin (total Rupiah)</label>
                  </th>
                  <td className="w-24 py-1.5" colSpan={2}>
                    <Input
                      id="koin"
                      inputMode="numeric"
                      value={coins}
                      placeholder="0"
                      onChange={(e) => {
                        setCoins(e.target.value);
                        setConfirming(false);
                      }}
                      className="money text-right"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 flex items-baseline justify-between border-t pt-3">
              <span className="text-sm font-medium">Total uang di laci</span>
              <span className="money text-xl font-bold">{formatRupiah(sheetTotal + coinTotal)}</span>
            </p>
            {parseRupiah(coins || "0") === null && <p className="mt-1 text-sm text-destructive">Isi koin sebagai nominal Rupiah, mis. 3.500.</p>}
            {err && <p className="mt-1 text-sm text-destructive">{err}</p>}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="note">Catatan (opsional)</FieldLabel>
          <Textarea id="note" name="note" rows={2} maxLength={200} defaultValue={initial(state, "note", "")} placeholder="Mis. ada uang Rp 50.000 yang ditukar ke pecahan kecil" />
          <FieldError>{fieldError(state, "note")}</FieldError>
        </Field>

        <FormError state={state} />

        {confirming && counted !== null ? (
          <div className="rounded-xl border bg-secondary p-4" role="group" aria-labelledby="confirm-title">
            <p id="confirm-title" className="font-semibold">
              Tutup shift dengan uang di laci <span className="money">{formatRupiah(counted)}</span>?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Setelah ditutup, Anda perlu membuka shift baru untuk berjualan lagi.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Menutup shift..." : "Ya, tutup shift"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
                Hitung ulang
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type={counted === null ? "submit" : "button"}
            size="lg"
            onClick={() => counted !== null && setConfirming(true)}
          >
            Lanjut
          </Button>
        )}
      </FieldGroup>
    </form>
  );
}

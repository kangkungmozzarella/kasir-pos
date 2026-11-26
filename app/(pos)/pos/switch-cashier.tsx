"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ROLE_LABEL } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { switchCashierAction } from "./actions";
import type { SwitchCandidate } from "./types";

type Props = {
  candidates: SwitchCandidate[];
  /** Alasan belum bisa ganti kasir (mis. keranjang masih berisi). */
  blocked?: string;
  /** Nama kasir yang shift-nya sedang buka di perangkat ini. */
  openShiftOf?: string;
  returnFocus?: React.RefObject<HTMLElement | null>;
  /** Supaya layar kasir mematikan shortcut keyboard selama dialog terbuka. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

export function SwitchCashier({ candidates, blocked, openShiftOf, returnFocus, onOpenChange, className }: Props) {
  const [open, setOpenState] = useState(false);
  const setOpen = (o: boolean) => {
    setOpenState(o);
    onOpenChange?.(o);
  };
  const [target, setTarget] = useState<string>();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const pinRef = useRef<HTMLInputElement>(null);
  const id = useId();
  if (candidates.length === 0) return null;
  const chosen = candidates.find((c) => c.id === target);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return setError("Pilih nama Anda dulu.");
    setError(undefined);
    startTransition(async () => {
      const res = await switchCashierAction(target, pin);
      // Berhasil = redirect ke layar kasir akun baru; sampai sini berarti gagal.
      if (res && !res.ok) {
        setError(res.error);
        setPin("");
        pinRef.current?.focus();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(undefined);
          setPin("");
          setTarget(undefined);
        }}
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-sm font-medium whitespace-nowrap text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      >
        Ganti kasir
      </button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-md" finalFocus={returnFocus}>
          <DialogHeader>
            <DialogTitle>Ganti kasir</DialogTitle>
            <DialogDescription>Pilih nama Anda, lalu masukkan PIN. Kasir bergantian tanpa perlu email dan kata sandi.</DialogDescription>
          </DialogHeader>

          {blocked ? (
            <p role="alert" className="rounded-lg bg-secondary px-3 py-2 text-sm">
              {blocked}
            </p>
          ) : (
            <form id={`${id}-form`} onSubmit={submit} className="space-y-4">
              {openShiftOf && (
                <p className="rounded-lg bg-secondary px-3 py-2 text-sm">
                  Shift {openShiftOf} tetap terbuka. Bila selesai bertugas dan laci diserahkan, tutup shift dulu supaya uangnya tercatat atas nama yang benar.
                </p>
              )}
              <fieldset>
                <legend className="text-sm font-medium">Kasir</legend>
                <div className="mt-2 grid gap-2">
                  {candidates.map((c) => (
                    <label
                      key={c.id}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        c.locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-accent",
                        target === c.id && "border-primary bg-secondary",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="target"
                          value={c.id}
                          checked={target === c.id}
                          disabled={c.locked}
                          onChange={() => {
                            setTarget(c.id);
                            setError(undefined);
                            requestAnimationFrame(() => pinRef.current?.focus());
                          }}
                          className="size-4 accent-primary"
                        />
                        <span className="font-medium">{c.name}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{c.locked ? "PIN dikunci sementara" : ROLE_LABEL[c.role]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-1.5">
                <label htmlFor={`${id}-pin`} className="text-sm font-medium">
                  PIN
                </label>
                <Input
                  ref={pinRef}
                  id={`${id}-pin`}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  aria-invalid={!!error || undefined}
                  aria-describedby={`${id}-hint`}
                  className="money h-12 text-center text-xl tracking-[0.5em]"
                />
                <p id={`${id}-hint`} role={error ? "alert" : undefined} className={error ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
                  {error ?? "4 sampai 6 angka. Lima kali salah mengunci PIN selama 5 menit."}
                </p>
              </div>
            </form>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Batal
            </Button>
            {!blocked && (
              <Button type="submit" form={`${id}-form`} disabled={pending || pin.length < 4 || !target}>
                {pending ? "Memeriksa PIN..." : chosen ? `Masuk sebagai ${chosen.name}` : "Masuk"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

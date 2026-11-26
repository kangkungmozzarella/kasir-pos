"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { transferStepAction } from "../actions";

type Step = "send" | "receive" | "cancel";

const COPY: Record<Step, { button: string; title: string; confirm: string }> = {
  send: { button: "Kirim sekarang", title: "Kirim transfer ini?", confirm: "Ya, kirim" },
  receive: { button: "Terima barang", title: "Barang sudah sampai?", confirm: "Ya, terima" },
  cancel: { button: "Batalkan draf", title: "Batalkan draf ini?", confirm: "Ya, batalkan" },
};

export function TransferSteps({
  transferId,
  steps,
  editHref,
  descriptions,
}: {
  transferId: string;
  steps: Step[];
  editHref?: string;
  /** Penjelasan dampak tiap langkah, mis. "Stok Medan Kota berkurang 8 barang." */
  descriptions: Partial<Record<Step, string>>;
}) {
  const [open, setOpen] = useState<Step | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function run(step: Step) {
    setError(undefined);
    startTransition(async () => {
      const res = await transferStepAction(transferId, step);
      if (!res.ok) return setError(res.error);
      setOpen(null);
      toast.success(res.message);
    });
  }

  if (steps.length === 0 && !editHref) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {steps.includes("send") && <Button onClick={() => setOpen("send")}>{COPY.send.button}</Button>}
      {steps.includes("receive") && <Button onClick={() => setOpen("receive")}>{COPY.receive.button}</Button>}
      {editHref && (
        <Link href={editHref} className={buttonVariants({ variant: "outline" })}>
          Ubah draf
        </Link>
      )}
      {steps.includes("cancel") && (
        <Button variant="destructive" className="sm:ml-auto" onClick={() => setOpen("cancel")}>
          {COPY.cancel.button}
        </Button>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !pending && !o && (setOpen(null), setError(undefined))}>
        <DialogContent className="sm:max-w-md">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{COPY[open].title}</DialogTitle>
                <DialogDescription>{descriptions[open]}</DialogDescription>
              </DialogHeader>
              {error && (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(null)} disabled={pending}>
                  Tidak jadi
                </Button>
                <Button variant={open === "cancel" ? "destructive" : "default"} onClick={() => run(open)} disabled={pending}>
                  {pending ? "Memproses..." : COPY[open].confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

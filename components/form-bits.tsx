"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";

/** Tampilkan toast saat action sukses. `onSuccess` dipanggil sekali per submit yang berhasil. */
export function useActionFeedback(state: ActionState, onSuccess?: () => void) {
  const lastAt = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!state.at || state.at === lastAt.current) return;
    lastAt.current = state.at;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      onSuccess?.();
    }
  }, [state, onSuccess]);
}

/** Pesan error umum di atas tombol simpan. */
export function FormError({ state }: { state: ActionState }) {
  if (state.ok || !state.error) return null;
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {state.error}
    </p>
  );
}

/** Nilai awal field: nilai yang terakhir dikirim (bila validasi gagal), selain itu nilai tersimpan. */
export function initial(state: ActionState, key: string, fallback: string | number | null | undefined): string {
  return state.values?.[key] ?? (fallback === null || fallback === undefined ? "" : String(fallback));
}

export function fieldError(state: ActionState, key: string): string | undefined {
  return state.fieldErrors?.[key]?.[0];
}

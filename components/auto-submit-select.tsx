"use client";

import { NativeSelect } from "@/components/ui/native-select";

/**
 * Select di dalam form GET yang langsung mengirim form saat nilainya berubah.
 * Tanpa JavaScript, form tetap bisa dikirim lewat tombol submit di sebelahnya.
 */
export function AutoSubmitSelect(props: React.ComponentProps<typeof NativeSelect>) {
  return <NativeSelect {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

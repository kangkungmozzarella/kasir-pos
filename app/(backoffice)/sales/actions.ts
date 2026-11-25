"use server";

import { refresh } from "next/cache";
import { actionError } from "@/lib/actions";
import { assertUser } from "@/lib/auth";
import { requestOrigin } from "@/lib/origin";
import { PERMISSIONS } from "@/lib/permissions";
import { voidSchema } from "@/lib/validation";
import { voidSale, type VoidResult } from "@/lib/void";

export type VoidActionResult = { ok: true; result: VoidResult } | { ok: false; error: string };

export async function voidSaleAction(saleId: unknown, reason: unknown): Promise<VoidActionResult> {
  try {
    const user = await assertUser(PERMISSIONS["sale:void"]);
    if (typeof saleId !== "string" || !saleId) return { ok: false, error: "Transaksi tidak valid." };
    const parsed = voidSchema.safeParse({ reason });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Alasan tidak valid." };
    const result = await voidSale(user, saleId, parsed.data.reason, await requestOrigin());
    refresh();
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: actionError(err).error ?? "Pembatalan gagal. Coba lagi." };
  }
}

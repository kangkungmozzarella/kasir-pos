"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { actionError, success, validationFailed } from "@/lib/actions";
import { assertUser } from "@/lib/auth";
import { checkoutCash } from "@/lib/checkout";
import { PERMISSIONS } from "@/lib/permissions";
import { openShift } from "@/lib/shift";
import { checkoutSchema, formValues, openShiftSchema } from "@/lib/validation";
import type { CheckoutResponse } from "./types";

export async function openShiftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["openingCash", "branchId"]);
  try {
    const user = await assertUser(PERMISSIONS["pos:use"]);
    const parsed = openShiftSchema.safeParse(values);
    if (!parsed.success) return validationFailed(parsed.error, values);
    await openShift(user, parsed.data);
    refresh();
    return success("Shift dibuka. Selamat berjualan!");
  } catch (err) {
    return actionError(err, values);
  }
}

export async function checkoutAction(input: unknown): Promise<CheckoutResponse> {
  try {
    const user = await assertUser(PERMISSIONS["pos:use"]);
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Data transaksi tidak valid." };
    }
    const result = await checkoutCash(user, parsed.data);
    return { ok: true, ...result };
  } catch (err) {
    const state = actionError(err);
    return { ok: false, error: state.error ?? "Transaksi gagal. Coba lagi." };
  } finally {
    // Berhasil atau gagal, layar kasir perlu stok dan harga terbaru.
    refresh();
  }
}

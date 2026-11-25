"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { actionError, success, validationFailed } from "@/lib/actions";
import { assertUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { PERMISSIONS, resolveBranchScope, ScopeError } from "@/lib/permissions";
import { applyStockDelta, setStockCount } from "@/lib/stock";
import { branchStockSettingsSchema, formValues, stockInSchema, stockOpnameSchema } from "@/lib/validation";

/** branchId datang dari klien, jadi selalu dicek ulang terhadap hak akses user. */
async function authorize(branchId: string) {
  const user = await assertUser(PERMISSIONS["stock:manage"]);
  const scoped = resolveBranchScope(user, branchId);
  if (!scoped) throw new ScopeError("Pilih cabang terlebih dahulu.");
  return { user, branchId: scoped };
}

export async function receiveStock(
  productId: string,
  branchIdInput: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["quantity", "note"]);
  try {
    const { user, branchId } = await authorize(branchIdInput);
    const parsed = stockInSchema.safeParse(values);
    if (!parsed.success) return validationFailed(parsed.error, values);

    const after = await db.$transaction((tx) =>
      applyStockDelta(tx, {
        branchId,
        productId,
        delta: parsed.data.quantity,
        type: "PURCHASE",
        note: parsed.data.note,
        userId: user.id,
      }),
    );
    refresh();
    return success(`Stok bertambah ${formatNumber(parsed.data.quantity)}. Sekarang ${formatNumber(after)}.`);
  } catch (err) {
    return actionError(err, values);
  }
}

export async function countStock(
  productId: string,
  branchIdInput: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["counted", "note"]);
  try {
    const { user, branchId } = await authorize(branchIdInput);
    const parsed = stockOpnameSchema.safeParse(values);
    if (!parsed.success) return validationFailed(parsed.error, values);

    const delta = await db.$transaction((tx) =>
      setStockCount(tx, {
        branchId,
        productId,
        counted: parsed.data.counted,
        type: "ADJUSTMENT",
        note: parsed.data.note,
        userId: user.id,
      }),
    );
    refresh();
    if (delta === 0) return success("Stok fisik sama dengan catatan. Tidak ada yang diubah.");
    const sign = delta > 0 ? "lebih" : "kurang";
    return success(`Stok disesuaikan ke ${formatNumber(parsed.data.counted)} (${sign} ${formatNumber(Math.abs(delta))}).`);
  } catch (err) {
    return actionError(err, values);
  }
}

export async function updateBranchStockSettings(
  productId: string,
  branchIdInput: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["minStock", "priceOverride"]);
  try {
    const { branchId } = await authorize(branchIdInput);
    const parsed = branchStockSettingsSchema.safeParse(values);
    if (!parsed.success) return validationFailed(parsed.error, values);

    await db.branchStock.update({
      where: { branchId_productId: { branchId, productId } },
      data: parsed.data,
    });
    refresh();
    return success("Pengaturan cabang disimpan.");
  } catch (err) {
    return actionError(err, values);
  }
}

"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { actionError, success, UserFacingError, validationFailed } from "@/lib/actions";
import { assertUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { categorySchema, formValues } from "@/lib/validation";

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["name"]);
  try {
    await assertUser(PERMISSIONS["catalog:manage"]);
    const parsed = categorySchema.safeParse(values);
    if (!parsed.success) return validationFailed(parsed.error, values);
    await db.category.create({ data: parsed.data });
    refresh();
    return success(`Kategori "${parsed.data.name}" ditambahkan.`);
  } catch (err) {
    return actionError(err, values);
  }
}

export async function renameCategory(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["name"]);
  try {
    await assertUser(PERMISSIONS["catalog:manage"]);
    const parsed = categorySchema.safeParse(values);
    if (!parsed.success) return validationFailed(parsed.error, values);
    await db.category.update({ where: { id }, data: parsed.data });
    refresh();
    return success("Nama kategori disimpan.");
  } catch (err) {
    return actionError(err, values);
  }
}

export async function deleteCategory(id: string, _prev: ActionState): Promise<ActionState> {
  try {
    await assertUser(PERMISSIONS["catalog:manage"]);
    const used = await db.product.count({ where: { categoryId: id } });
    if (used > 0) {
      throw new UserFacingError(`Kategori ini masih dipakai ${used} produk. Pindahkan produknya dulu.`);
    }
    const deleted = await db.category.delete({ where: { id } });
    refresh();
    return success(`Kategori "${deleted.name}" dihapus.`);
  } catch (err) {
    return actionError(err);
  }
}

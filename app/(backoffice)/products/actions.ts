"use server";

import { refresh, revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { actionError, success, UserFacingError, validationFailed } from "@/lib/actions";
import { assertUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { formValues, productSchema } from "@/lib/validation";

const FIELDS = ["name", "sku", "barcode", "unit", "price", "cost", "categoryId", "isActive"] as const;

async function parse(formData: FormData) {
  const values = formValues(formData, FIELDS);
  const parsed = productSchema.safeParse(values);
  if (parsed.success && parsed.data.categoryId) {
    const exists = await db.category.count({ where: { id: parsed.data.categoryId } });
    if (!exists) throw new UserFacingError("Kategori yang dipilih sudah tidak ada. Muat ulang halaman.");
  }
  return { values, parsed };
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let values: ActionState["values"];
  try {
    await assertUser(PERMISSIONS["catalog:manage"]);
    const result = await parse(formData);
    values = result.values;
    if (!result.parsed.success) return validationFailed(result.parsed.error, values);
    const data = result.parsed.data;

    // Produk baru langsung terdaftar di semua cabang dengan stok 0, supaya bisa
    // diterima (barang masuk) dan dijual tanpa langkah tambahan.
    await db.$transaction(async (tx) => {
      const product = await tx.product.create({ data });
      const branches = await tx.branch.findMany({ select: { id: true } });
      await tx.branchStock.createMany({
        data: branches.map((b) => ({ branchId: b.id, productId: product.id })),
      });
    });
    revalidatePath("/products");
    return success(`Produk "${data.name}" ditambahkan dengan stok 0 di semua cabang.`);
  } catch (err) {
    return actionError(err, values);
  }
}

export async function updateProduct(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  let values: ActionState["values"];
  try {
    await assertUser(PERMISSIONS["catalog:manage"]);
    const result = await parse(formData);
    values = result.values;
    if (!result.parsed.success) return validationFailed(result.parsed.error, values);

    await db.product.update({ where: { id }, data: result.parsed.data });
    refresh();
    return success("Perubahan produk disimpan.");
  } catch (err) {
    return actionError(err, values);
  }
}

"use server";

import { refresh, revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { actionError, success, UserFacingError, validationFailed } from "@/lib/actions";
import { assertUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { branchCreateSchema, branchUpdateSchema, formValues } from "@/lib/validation";

const FIELDS = ["code", "name", "address", "phone", "taxRate", "receiptFooter", "isActive"] as const;

export async function createBranch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, FIELDS);
  try {
    await assertUser(PERMISSIONS["branch:manage"]);
    const parsed = branchCreateSchema.safeParse(values);
    if (!parsed.success) return validationFailed(parsed.error, values);
    // Cabang baru langsung punya baris stok 0 untuk semua produk, supaya bisa
    // menerima barang, transfer, dan berjualan tanpa langkah tambahan.
    await db.$transaction(async (tx) => {
      const branch = await tx.branch.create({ data: parsed.data });
      const products = await tx.product.findMany({ select: { id: true } });
      await tx.branchStock.createMany({ data: products.map((p) => ({ branchId: branch.id, productId: p.id })) });
    });
    revalidatePath("/branches");
    return success(`Cabang ${parsed.data.name} ditambahkan dengan stok 0 untuk semua produk.`);
  } catch (err) {
    return actionError(err, values);
  }
}

export async function updateBranch(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, FIELDS);
  try {
    await assertUser(PERMISSIONS["branch:manage"]);
    const parsed = branchUpdateSchema.safeParse(values);
    if (!parsed.success) return validationFailed(parsed.error, values);

    if (!parsed.data.isActive) {
      // Cabang yang masih berjalan tidak boleh dimatikan diam-diam.
      const [openShifts, inTransit] = await Promise.all([
        db.shift.count({ where: { branchId: id, status: "OPEN" } }),
        db.stockTransfer.count({ where: { status: "SENT", OR: [{ fromBranchId: id }, { toBranchId: id }] } }),
      ]);
      if (openShifts > 0) throw new UserFacingError(`Masih ada ${openShifts} shift yang buka di cabang ini. Tutup dulu sebelum menonaktifkan.`);
      if (inTransit > 0) throw new UserFacingError("Masih ada transfer stok dalam perjalanan dari atau ke cabang ini.");
    }
    await db.branch.update({ where: { id }, data: parsed.data });
    refresh();
    return success(parsed.data.isActive ? "Perubahan cabang disimpan." : "Cabang dinonaktifkan.");
  } catch (err) {
    return actionError(err, values);
  }
}

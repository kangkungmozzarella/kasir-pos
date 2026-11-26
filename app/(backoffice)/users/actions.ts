"use server";

import bcrypt from "bcryptjs";
import { refresh, revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { actionError, success, UserFacingError, validationFailed } from "@/lib/actions";
import { assertUser, AuthError, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageUser, manageableRoles, PERMISSIONS } from "@/lib/permissions";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { formValues, userCreateSchema, userUpdateSchema } from "@/lib/validation";

const HASH_COST = 10;

/** Pastikan role & cabang tujuan boleh diberikan oleh actor, dan cabangnya aktif. */
async function assertAssignable(actor: CurrentUser, role: Role, branchId: string) {
  if (!manageableRoles(actor.role).includes(role)) {
    throw new AuthError(`Anda tidak bisa memberi role ${ROLE_LABEL[role]}.`, 403);
  }
  if (actor.role === "ADMIN" && branchId !== actor.branchId) {
    throw new AuthError("Admin hanya bisa menempatkan pengguna di cabangnya sendiri.", 403);
  }
  const branch = await db.branch.findFirst({ where: { id: branchId, isActive: true }, select: { id: true } });
  if (!branch) throw new UserFacingError("Cabang yang dipilih tidak ada atau sudah nonaktif.");
}

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Kata sandi dan PIN sengaja tidak dikembalikan ke form.
  const values = formValues(formData, ["name", "email", "role", "branchId"]);
  try {
    const actor = await assertUser(PERMISSIONS["user:manage"]);
    const parsed = userCreateSchema.safeParse({ ...values, ...formValues(formData, ["password", "pin"]) });
    if (!parsed.success) return validationFailed(parsed.error, values);
    const { password, pin, ...data } = parsed.data;
    await assertAssignable(actor, data.role, data.branchId);

    await db.user.create({
      data: {
        ...data,
        passwordHash: await bcrypt.hash(password, HASH_COST),
        pin: pin ? await bcrypt.hash(pin, HASH_COST) : null,
      },
    });
    revalidatePath("/users");
    return success(`Akun ${data.name} dibuat. Berikan email dan kata sandinya ke yang bersangkutan.`);
  } catch (err) {
    return actionError(err, values);
  }
}

export async function updateUser(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["name", "email", "role", "branchId", "isActive", "clearPin"]);
  try {
    const actor = await assertUser(PERMISSIONS["user:manage"]);
    const target = await db.user.findUnique({ where: { id }, select: { id: true, role: true, branchId: true } });
    if (!target || !canManageUser(actor, target)) {
      throw new AuthError("Anda tidak bisa mengubah akun ini.", 403);
    }

    const parsed = userUpdateSchema.safeParse({ ...values, ...formValues(formData, ["password", "pin"]) });
    if (!parsed.success) return validationFailed(parsed.error, values);
    const { password, pin, clearPin, ...data } = parsed.data;
    await assertAssignable(actor, data.role, data.branchId);

    await db.user.update({
      where: { id },
      data: {
        ...data,
        ...(password && { passwordHash: await bcrypt.hash(password, HASH_COST) }),
        // PIN baru (atau dihapus) juga membuka kunci percobaan PIN yang salah.
        ...(clearPin
          ? { pin: null, pinFailedCount: 0, pinLockedUntil: null }
          : pin
            ? { pin: await bcrypt.hash(pin, HASH_COST), pinFailedCount: 0, pinLockedUntil: null }
            : {}),
      },
    });
    refresh();
    return success(data.isActive ? "Perubahan akun disimpan." : "Akun dinonaktifkan dan langsung keluar dari semua perangkat.");
  } catch (err) {
    return actionError(err, values);
  }
}

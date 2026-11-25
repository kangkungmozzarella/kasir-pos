"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { homePathFor } from "@/lib/roles";

const loginSchema = z.object({
  email: z.email({ error: "Format email belum benar." }),
  password: z.string().min(1, { error: "Kata sandi wajib diisi." }),
});

export type LoginState = {
  email?: string;
  error?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
};

// Dipakai saat email tidak ditemukan, supaya waktu respons sama dengan saat
// kata sandi salah dan penyerang tidak bisa menebak email mana yang terdaftar.
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("bukan-kata-sandi-siapa-pun", 10));

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = loginSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) {
    return { email, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, branchId: true, isActive: true, passwordHash: true },
  });
  const passwordOk = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? getDummyHash());

  if (!user || !passwordOk) return { email, error: "Email atau kata sandi salah." };
  if (!user.isActive) return { email, error: "Akun ini sedang dinonaktifkan. Hubungi admin cabang." };

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role;
  session.branchId = user.branchId;
  await session.save();

  redirect(homePathFor(user.role));
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { actionError } from "@/lib/actions";
import { assertUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { cancelTransfer, createTransfer, receiveTransfer, sendTransfer, updateDraft } from "@/lib/transfer";
import { transferSchema } from "@/lib/validation";

type Result = { ok: true; message: string } | { ok: false; error: string };

const fail = (err: unknown): Result => ({ ok: false, error: actionError(err).error ?? "Gagal. Coba lagi." });

/** Simpan draf baru (id null) atau ubah draf, lalu buka halaman detailnya. */
export async function saveTransferAction(id: string | null, input: unknown): Promise<Result> {
  let target: string;
  try {
    const user = await assertUser(PERMISSIONS["transfer:manage"]);
    const parsed = transferSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data transfer tidak valid." };
    if (id) {
      await updateDraft(user, id, parsed.data);
      target = id;
    } else {
      target = (await createTransfer(user, parsed.data)).id;
    }
  } catch (err) {
    return fail(err);
  }
  redirect(`/transfers/${target}`);
}

const ACTIONS = {
  send: [sendTransfer, "dikirim. Stok cabang asal sudah dikurangi."],
  receive: [receiveTransfer, "diterima. Stok cabang tujuan sudah ditambah."],
  cancel: [cancelTransfer, "dibatalkan."],
} as const;

export async function transferStepAction(id: unknown, step: unknown): Promise<Result> {
  try {
    const user = await assertUser(PERMISSIONS["transfer:manage"]);
    if (typeof id !== "string" || !(typeof step === "string" && step in ACTIONS)) return { ok: false, error: "Permintaan tidak valid." };
    const [run, suffix] = ACTIONS[step as keyof typeof ACTIONS];
    const { transferNo } = await run(user, id);
    refresh();
    return { ok: true, message: `Transfer ${transferNo} ${suffix}` };
  } catch (err) {
    return fail(err);
  }
}

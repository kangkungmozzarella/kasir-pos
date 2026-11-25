"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { actionError, success, validationFailed } from "@/lib/actions";
import { assertUser } from "@/lib/auth";
import { checkoutCash, createPendingSale } from "@/lib/checkout";
import { requestOrigin } from "@/lib/origin";
import { PERMISSIONS } from "@/lib/permissions";
import {
  cancelActivePayment,
  cancelPendingSale,
  getSaleState,
  payByCard,
  payCashRemaining,
  startQris,
} from "@/lib/sale-flow";
import { closeShift, openShift } from "@/lib/shift";
import { amountSchema, cartSchema, checkoutSchema, closeShiftSchema, formValues, openShiftSchema } from "@/lib/validation";
import { toClientState, type ClientSaleState } from "./client-state";
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

/** Tutup shift (hitung buta: kasir belum melihat angka sistem), lalu tampilkan rekapnya. */
export async function closeShiftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["countedCash", "note"]);
  let shiftId: string;
  try {
    const user = await assertUser(PERMISSIONS["pos:use"]);
    const parsed = closeShiftSchema.safeParse(values);
    if (!parsed.success) return validationFailed(parsed.error, values);
    ({ shiftId } = await closeShift(user, parsed.data));
  } catch (err) {
    return actionError(err, values);
  }
  redirect(`/shifts/${shiftId}?ditutup=1`);
}

function failure(err: unknown) {
  return { ok: false as const, error: actionError(err).error ?? "Transaksi gagal. Coba lagi." };
}

/** Bayar tunai penuh dari keranjang (jalur tercepat, tanpa transaksi menunggu). */
export async function checkoutAction(input: unknown): Promise<CheckoutResponse> {
  try {
    const user = await assertUser(PERMISSIONS["pos:use"]);
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data transaksi tidak valid." };
    return { ok: true, ...(await checkoutCash(user, parsed.data)) };
  } catch (err) {
    return failure(err);
  } finally {
    refresh(); // berhasil atau gagal, layar kasir perlu stok dan harga terbaru
  }
}

export type SaleActionResult =
  | {
      ok: true;
      state: ClientSaleState;
      /** Alasan kartu ditolak, bila ada. */
      declined?: string;
      /** Kembalian bila transaksi dilunasi dengan tunai. */
      change?: number;
    }
  | { ok: false; error: string };

/** Buat transaksi yang akan dibayar QRIS/kartu/kombinasi. Stok langsung dipesan. */
export async function startSaleAction(input: unknown): Promise<SaleActionResult> {
  try {
    const user = await assertUser(PERMISSIONS["pos:use"]);
    const parsed = cartSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data transaksi tidak valid." };
    const { saleId } = await createPendingSale(user, parsed.data);
    return { ok: true, state: toClientState((await getSaleState(saleId, user))!) };
  } catch (err) {
    return failure(err);
  } finally {
    refresh();
  }
}

async function withSale(saleId: unknown, run: (user: Awaited<ReturnType<typeof assertUser>>, id: string) => Promise<SaleActionResult>) {
  try {
    const user = await assertUser(PERMISSIONS["pos:use"]);
    if (typeof saleId !== "string" || !saleId) return { ok: false as const, error: "Transaksi tidak valid." };
    return await run(user, saleId);
  } catch (err) {
    return failure(err);
  }
}

export async function qrisAction(saleId: unknown, amount: unknown): Promise<SaleActionResult> {
  return withSale(saleId, async (user, id) => {
    const parsed = amountSchema.safeParse(amount);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Nominal tidak valid." };
    const state = await startQris(user, id, parsed.data, await requestOrigin());
    return { ok: true, state: toClientState(state) };
  });
}

export async function cancelQrisAction(saleId: unknown): Promise<SaleActionResult> {
  return withSale(saleId, async (user, id) => ({ ok: true, state: toClientState(await cancelActivePayment(user, id)) }));
}

export async function cardAction(saleId: unknown, amount: unknown): Promise<SaleActionResult> {
  const result = await withSale(saleId, async (user, id) => {
    const parsed = amountSchema.safeParse(amount);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Nominal tidak valid." };
    const { state, declined } = await payByCard(user, id, parsed.data, await requestOrigin());
    return { ok: true, state: toClientState(state), declined: declined ?? undefined };
  });
  if (result.ok && result.state.status === "COMPLETED") refresh();
  return result;
}

export async function cashRemainingAction(saleId: unknown, tendered: unknown): Promise<SaleActionResult> {
  const result = await withSale(saleId, async (user, id) => {
    const parsed = amountSchema.safeParse(tendered);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Nominal tidak valid." };
    const { change, ...state } = await payCashRemaining(user, id, parsed.data);
    return { ok: true, state: toClientState(state), change };
  });
  refresh();
  return result;
}

export async function cancelSaleAction(saleId: unknown): Promise<{ ok: true; invoiceNo: string } | { ok: false; error: string }> {
  try {
    const user = await assertUser(PERMISSIONS["pos:use"]);
    if (typeof saleId !== "string" || !saleId) return { ok: false, error: "Transaksi tidak valid." };
    const { invoiceNo } = await cancelPendingSale(user, saleId);
    return { ok: true, invoiceNo };
  } catch (err) {
    return failure(err);
  } finally {
    refresh();
  }
}

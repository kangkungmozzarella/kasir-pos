import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { ActionState } from "./action-state";
import { AuthError } from "./auth";
import { ScopeError } from "./permissions";
import { StockError } from "./stock";

/** Kesalahan bisnis yang pesannya aman ditampilkan ke pengguna. */
export class UserFacingError extends Error {}

const UNIQUE_FIELD_LABEL: Record<string, string> = {
  sku: "SKU",
  barcode: "Barcode",
  email: "Email",
  name: "Nama",
  code: "Kode cabang",
};

export function validationFailed(error: z.ZodError, values?: ActionState["values"]): ActionState {
  return { ok: false, fieldErrors: z.flattenError(error).fieldErrors, values, at: Date.now() };
}

export function success(message: string): ActionState {
  return { ok: true, message, at: Date.now() };
}

/**
 * Ubah error yang dilempar di dalam action menjadi pesan berbahasa Indonesia.
 * Error tak dikenal tetap dilempar supaya tercatat di log dan memicu error.tsx.
 */
export function actionError(err: unknown, values?: ActionState["values"]): ActionState {
  unstable_rethrow(err); // redirect() dan notFound() harus diteruskan, bukan ditangkap
  const fail = (error: string, fieldErrors?: ActionState["fieldErrors"]): ActionState => ({
    ok: false,
    error,
    fieldErrors,
    values,
    at: Date.now(),
  });

  if (err instanceof AuthError || err instanceof ScopeError || err instanceof UserFacingError || err instanceof StockError) {
    return fail(err.message);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = uniqueTarget(err);
    const label = target ? UNIQUE_FIELD_LABEL[target] : undefined;
    return label
      ? fail(`${label} ini sudah dipakai data lain.`, { [target!]: [`${label} ini sudah dipakai.`] })
      : fail("Data yang sama sudah ada.");
  }
  throw err;
}

type UniqueMeta = {
  target?: string[] | string;
  driverAdapterError?: { cause?: { constraint?: { fields?: string[]; index?: string } } };
};

/**
 * Kolom yang melanggar unique constraint. Dengan driver adapter (Prisma 7) metadata
 * hanya berisi nama index, mis. "Product_sku_key", jadi kolomnya diambil dari situ.
 */
export function uniqueTarget(err: { meta?: unknown }): string | undefined {
  const meta = err.meta as UniqueMeta | undefined;
  const constraint = meta?.driverAdapterError?.cause?.constraint;
  const fields = constraint?.fields ?? meta?.target;
  const first = Array.isArray(fields) ? fields[0] : fields;
  if (first) return first.replace(/"/g, "");
  return constraint?.index?.match(/^[^_]+_(.+)_key$/)?.[1];
}

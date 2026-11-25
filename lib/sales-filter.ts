import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "./auth";
import { resolveBranchFilter } from "./branch-scope";
import { jakartaDateInput, jakartaDayStart, parseJakartaDate } from "./format";

const DAY_MS = 86_400_000;
const METHODS = ["CASH", "QRIS", "CARD"] as const;
const STATUSES = ["COMPLETED", "VOIDED", "PENDING_PAYMENT"] as const;

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const pick = <T extends string>(list: readonly T[], v: string): T | "" => (list.includes(v as T) ? (v as T) : "");

/**
 * Filter riwayat penjualan dari query string. Dipakai halaman /sales dan export CSV,
 * supaya yang diunduh selalu sama dengan yang terlihat. Cakupan cabang ditentukan
 * server: admin hanya cabangnya walau URL meminta cabang lain.
 */
export async function salesFilter(user: CurrentUser, sp: SearchParams) {
  const { branchId, branches } = await resolveBranchFilter(user, one(sp.branch) || undefined);
  const shift = one(sp.shift);
  const today = jakartaDateInput(new Date());
  // Default 7 hari terakhir; bila datang dari rekap shift, tampilkan seluruh shift itu.
  const from = parseJakartaDate(one(sp.from)) ? one(sp.from) : shift ? "" : jakartaDateInput(jakartaDayStart(6));
  const to = parseJakartaDate(one(sp.to)) ? one(sp.to) : shift ? "" : today;
  const method = pick(METHODS, one(sp.method));
  const status = pick(STATUSES, one(sp.status));
  const cashier = one(sp.cashier);
  const q = one(sp.q).slice(0, 40);

  const fromDate = from ? parseJakartaDate(from) : null;
  const toDate = to ? parseJakartaDate(to) : null;
  const where: Prisma.SaleWhereInput = {
    ...(branchId && { branchId }),
    ...((fromDate || toDate) && {
      createdAt: { ...(fromDate && { gte: fromDate }), ...(toDate && { lt: new Date(toDate.getTime() + DAY_MS) }) },
    }),
    ...(status && { status }),
    ...(cashier && { cashierId: cashier }),
    ...(shift && { shiftId: shift }),
    ...(q && { invoiceNo: { contains: q, mode: "insensitive" } }),
    ...(method && { payments: { some: { method, status: { in: ["PAID", "REFUNDED"] } } } }),
  };

  const params: Record<string, string> = Object.fromEntries(
    Object.entries({
      branch: user.role === "OWNER" ? (branchId ?? "") : "",
      from,
      to,
      method,
      status,
      cashier,
      shift,
      q,
    }).filter(([, v]) => v),
  );
  return { where, params, branchId, branches, values: { from, to, method, status, cashier, shift, q } };
}

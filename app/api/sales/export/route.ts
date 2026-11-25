import { assertUser, AuthError } from "@/lib/auth";
import { csvRow } from "@/lib/csv";
import { db } from "@/lib/db";
import { jakartaDateInput, jakartaDateKey } from "@/lib/format";
import { PERMISSIONS, ScopeError } from "@/lib/permissions";
import { methodSummary, SALE_STATUS_LABEL } from "@/lib/sale-labels";
import { salesFilter } from "@/lib/sales-filter";

const MAX_ROWS = 20_000;

const timeFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false });

/** Unduh riwayat penjualan sebagai CSV, dengan saringan yang sama seperti halaman /sales. */
export async function GET(request: Request) {
  let user;
  try {
    user = await assertUser(PERMISSIONS["report:view"]);
  } catch (err) {
    if (err instanceof AuthError) return new Response(err.message, { status: err.status });
    throw err;
  }

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  let filter;
  try {
    filter = await salesFilter(user, sp);
  } catch (err) {
    if (err instanceof ScopeError) return new Response(err.message, { status: 403 });
    throw err;
  }

  const count = await db.sale.count({ where: filter.where });
  if (count > MAX_ROWS) {
    return new Response(`Terlalu banyak transaksi (${count}). Persempit rentang tanggal, maksimal ${MAX_ROWS} baris.`, { status: 400 });
  }
  const sales = await db.sale.findMany({
    where: filter.where,
    orderBy: { createdAt: "asc" },
    select: {
      invoiceNo: true,
      createdAt: true,
      status: true,
      subtotal: true,
      discountTotal: true,
      taxTotal: true,
      total: true,
      voidReason: true,
      branch: { select: { code: true } },
      cashier: { select: { name: true } },
      payments: { select: { method: true, status: true } },
    },
  });

  let body = "﻿"; // BOM supaya Excel membaca UTF-8
  body += csvRow(["No. invoice", "Tanggal", "Jam", "Cabang", "Kasir", "Status", "Metode", "Subtotal", "Diskon", "Pajak", "Total", "Alasan batal"]);
  for (const s of sales) {
    body += csvRow([
      s.invoiceNo,
      jakartaDateInput(s.createdAt),
      timeFmt.format(s.createdAt),
      s.branch.code,
      s.cashier.name,
      SALE_STATUS_LABEL[s.status],
      methodSummary(s.payments),
      s.subtotal,
      s.discountTotal,
      s.taxTotal,
      s.total,
      s.voidReason,
    ]);
  }

  const range = [filter.values.from, filter.values.to].filter(Boolean).join("_sd_") || jakartaDateKey(new Date());
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="penjualan_${range}.csv"`,
      "cache-control": "no-store",
    },
  });
}

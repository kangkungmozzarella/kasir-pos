import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { jakartaDateInput, jakartaDayStart } from "./format";

const DAY_MS = 86_400_000;
export const TREND_DAYS = 30;
/** Pembanding grafik per jam: rata-rata 28 hari sebelumnya (4 minggu penuh, semua hari terwakili sama). */
export const BASELINE_DAYS = 28;

// Jam lokal WIB dari kolom timestamp UTC. Lihat AGENTS.md.
const LOCAL = Prisma.sql`(s."createdAt" at time zone 'UTC') at time zone 'Asia/Jakarta'`;

const branchCond = (branchId: string | null) => (branchId ? Prisma.sql`AND s."branchId" = ${branchId}` : Prisma.empty);

export type Summary = { transactions: number; revenue: number; netSales: number; cost: number; grossProfit: number; avgBasket: number };

/**
 * Ringkasan transaksi selesai dalam rentang waktu.
 * Laba kotor = penjualan bersih sebelum pajak (subtotal - diskon transaksi) - harga modal
 * barang terjual (snapshot SaleItem.unitCost). Pajak bukan pendapatan toko.
 */
async function summary(branchId: string | null, from: Date, to: Date): Promise<Summary> {
  const [row] = await db.$queryRaw<{ n: number; revenue: bigint; net: bigint; cost: bigint }[]>`
    SELECT count(*)::int AS n,
           coalesce(sum(s.total), 0)::bigint AS revenue,
           coalesce(sum(s.subtotal - s."discountTotal"), 0)::bigint AS net,
           coalesce(sum(c.cost), 0)::bigint AS cost
    FROM "Sale" s
    LEFT JOIN LATERAL (
      SELECT sum(i."unitCost" * i.quantity) AS cost FROM "SaleItem" i WHERE i."saleId" = s.id
    ) c ON true
    WHERE s.status = 'COMPLETED' AND s."createdAt" >= ${from} AND s."createdAt" < ${to} ${branchCond(branchId)}`;
  const revenue = Number(row.revenue);
  const net = Number(row.net);
  const cost = Number(row.cost);
  return {
    transactions: row.n,
    revenue,
    netSales: net,
    cost,
    grossProfit: net - cost,
    avgBasket: row.n ? Math.round(revenue / row.n) : 0,
  };
}

export type HourPoint = { hour: number; revenue: number; transactions: number; baseline: number };

/** Omzet per jam hari ini, dengan rata-rata omzet jam yang sama selama 28 hari sebelumnya. */
async function hourly(branchId: string | null, todayStart: Date): Promise<HourPoint[]> {
  const baselineStart = new Date(todayStart.getTime() - BASELINE_DAYS * DAY_MS);
  const rows = await db.$queryRaw<{ hour: number; today: bigint; n: number; past: bigint }[]>`
    SELECT extract(hour FROM ${LOCAL})::int AS hour,
           coalesce(sum(s.total) FILTER (WHERE s."createdAt" >= ${todayStart}), 0)::bigint AS today,
           (count(*) FILTER (WHERE s."createdAt" >= ${todayStart}))::int AS n,
           coalesce(sum(s.total) FILTER (WHERE s."createdAt" < ${todayStart}), 0)::bigint AS past
    FROM "Sale" s
    WHERE s.status = 'COMPLETED' AND s."createdAt" >= ${baselineStart} ${branchCond(branchId)}
    GROUP BY 1`;
  const byHour = new Map(rows.map((r) => [r.hour, r]));
  // Rentang jam buka dari data (minimal 07.00-21.00) supaya grafik tidak dipenuhi jam kosong.
  const hours = rows.map((r) => r.hour);
  const first = Math.min(7, ...hours);
  const last = Math.max(21, ...hours);
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const r = byHour.get(first + i);
    return {
      hour: first + i,
      revenue: Number(r?.today ?? 0),
      transactions: r?.n ?? 0,
      baseline: Math.round(Number(r?.past ?? 0) / BASELINE_DAYS),
    };
  });
}

export type DayPoint = { date: string; revenue: number; transactions: number };

/** Omzet per tanggal (WIB) selama 30 hari terakhir, termasuk hari ini yang masih berjalan. */
async function daily(branchId: string | null, todayStart: Date): Promise<DayPoint[]> {
  const from = new Date(todayStart.getTime() - (TREND_DAYS - 1) * DAY_MS);
  const rows = await db.$queryRaw<{ day: string; revenue: bigint; n: number }[]>`
    SELECT to_char(${LOCAL}, 'YYYY-MM-DD') AS day, sum(s.total)::bigint AS revenue, count(*)::int AS n
    FROM "Sale" s
    WHERE s.status = 'COMPLETED' AND s."createdAt" >= ${from} ${branchCond(branchId)}
    GROUP BY 1`;
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: TREND_DAYS }, (_, i) => {
    const date = jakartaDateInput(new Date(from.getTime() + i * DAY_MS + 12 * 3_600_000));
    const r = byDay.get(date);
    return { date, revenue: Number(r?.revenue ?? 0), transactions: r?.n ?? 0 };
  });
}

export type TopProduct = { productId: string; name: string; qty: number; revenue: number };

async function topProducts(branchId: string | null, todayStart: Date, limit = 8): Promise<TopProduct[]> {
  const from = new Date(todayStart.getTime() - (TREND_DAYS - 1) * DAY_MS);
  const rows = await db.$queryRaw<{ productId: string; name: string; qty: bigint; revenue: bigint }[]>`
    SELECT i."productId", p.name, sum(i.quantity)::bigint AS qty, sum(i."lineTotal")::bigint AS revenue
    FROM "SaleItem" i
    JOIN "Sale" s ON s.id = i."saleId"
    JOIN "Product" p ON p.id = i."productId"
    WHERE s.status = 'COMPLETED' AND s."createdAt" >= ${from} ${branchCond(branchId)}
    GROUP BY i."productId", p.name
    ORDER BY revenue DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ productId: r.productId, name: r.name, qty: Number(r.qty), revenue: Number(r.revenue) }));
}

export type LowStock = { productId: string; name: string; unit: string; branchCode: string; branchId: string; quantity: number; minStock: number };

async function lowStock(branchId: string | null, limit = 8) {
  const where = {
    ...(branchId && { branchId }),
    product: { isActive: true },
    quantity: { lt: db.branchStock.fields.minStock },
  };
  const [total, rows] = await Promise.all([
    db.branchStock.count({ where }),
    db.branchStock.findMany({
      where,
      orderBy: [{ quantity: "asc" }, { product: { name: "asc" } }],
      take: limit,
      select: {
        quantity: true,
        minStock: true,
        branchId: true,
        branch: { select: { code: true } },
        product: { select: { id: true, name: true, unit: true } },
      },
    }),
  ]);
  return {
    total,
    items: rows.map(
      (r): LowStock => ({
        productId: r.product.id,
        name: r.product.name,
        unit: r.product.unit,
        branchCode: r.branch.code,
        branchId: r.branchId,
        quantity: r.quantity,
        minStock: r.minStock,
      }),
    ),
  };
}

export type BranchRow = { id: string; name: string; code: string; today: number; revenue: number; transactions: number; grossProfit: number; lowStock: number };

/** Perbandingan cabang (Pemilik, semua cabang). Satu query agregat per jenis angka, bukan per cabang. */
async function branchComparison(todayStart: Date): Promise<BranchRow[]> {
  const from = new Date(todayStart.getTime() - (TREND_DAYS - 1) * DAY_MS);
  const [branches, sales, low] = await Promise.all([
    db.branch.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, name: true, code: true } }),
    db.$queryRaw<{ branchId: string; today: bigint; revenue: bigint; n: number; net: bigint; cost: bigint }[]>`
      SELECT s."branchId",
             coalesce(sum(s.total) FILTER (WHERE s."createdAt" >= ${todayStart}), 0)::bigint AS today,
             sum(s.total)::bigint AS revenue,
             count(*)::int AS n,
             sum(s.subtotal - s."discountTotal")::bigint AS net,
             coalesce(sum(c.cost), 0)::bigint AS cost
      FROM "Sale" s
      LEFT JOIN LATERAL (SELECT sum(i."unitCost" * i.quantity) AS cost FROM "SaleItem" i WHERE i."saleId" = s.id) c ON true
      WHERE s.status = 'COMPLETED' AND s."createdAt" >= ${from}
      GROUP BY s."branchId"`,
    db.branchStock.groupBy({
      by: ["branchId"],
      where: { product: { isActive: true }, quantity: { lt: db.branchStock.fields.minStock } },
      _count: { _all: true },
    }),
  ]);
  return branches.map((b) => {
    const s = sales.find((r) => r.branchId === b.id);
    return {
      ...b,
      today: Number(s?.today ?? 0),
      revenue: Number(s?.revenue ?? 0),
      transactions: s?.n ?? 0,
      grossProfit: Number(s?.net ?? 0) - Number(s?.cost ?? 0),
      lowStock: low.find((l) => l.branchId === b.id)?._count._all ?? 0,
    };
  });
}

export async function getDashboard(branchId: string | null, now: Date = new Date()) {
  const todayStart = jakartaDayStart(0, now);
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
  const [today, yesterdaySoFar, hours, days, top, low, branches] = await Promise.all([
    summary(branchId, todayStart, now),
    // Kemarin sampai jam yang sama: pembanding yang adil untuk hari yang belum selesai.
    summary(branchId, yesterdayStart, new Date(now.getTime() - DAY_MS)),
    hourly(branchId, todayStart),
    daily(branchId, todayStart),
    topProducts(branchId, todayStart),
    lowStock(branchId),
    branchId ? Promise.resolve(null) : branchComparison(todayStart),
  ]);
  return { now, today, yesterdaySoFar, hours, days, top, low, branches };
}

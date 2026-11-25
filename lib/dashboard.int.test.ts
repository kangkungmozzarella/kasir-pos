import { afterAll, describe, expect, it } from "vitest";
import { getDashboard } from "./dashboard";
import { db } from "./db";
import { jakartaDayStart } from "./format";

afterAll(() => db.$disconnect());

describe("dashboard", () => {
  it("angka hari ini cocok dengan hitungan manual per transaksi, dan konsisten dengan grafik", async () => {
    const branch = await db.branch.findUniqueOrThrow({ where: { code: "MDN01" } });
    const now = new Date();
    const d = await getDashboard(branch.id, now);

    const sales = await db.sale.findMany({
      where: { branchId: branch.id, status: "COMPLETED", createdAt: { gte: jakartaDayStart(0, now), lt: now } },
      include: { items: true },
    });
    const revenue = sales.reduce((s, x) => s + x.total, 0);
    const net = sales.reduce((s, x) => s + x.subtotal - x.discountTotal, 0);
    const cost = sales.reduce((s, x) => s + x.items.reduce((c, i) => c + i.unitCost * i.quantity, 0), 0);

    expect(d.today.transactions).toBe(sales.length);
    expect(d.today.revenue).toBe(revenue);
    expect(d.today.grossProfit).toBe(net - cost);
    expect(d.hours.reduce((s, h) => s + h.revenue, 0)).toBe(revenue);
    expect(d.days.at(-1)!.revenue).toBe(revenue);
    expect(d.days).toHaveLength(30);
    expect(d.branches).toBeNull(); // perbandingan hanya untuk "semua cabang"
  });

  it("semua cabang = jumlah tiap cabang; jam dihitung menurut WIB", async () => {
    const all = await getDashboard(null);
    expect(all.branches!.reduce((s, b) => s + b.today, 0)).toBe(all.today.revenue);
    const total30 = all.days.reduce((s, x) => s + x.revenue, 0);
    expect(all.branches!.reduce((s, b) => s + b.revenue, 0)).toBe(total30);
    // Seed hanya membuat transaksi pukul 07.00 sampai 21.59 WIB.
    const busy = all.hours.filter((h) => h.baseline > 0).map((h) => h.hour);
    expect(Math.min(...busy)).toBeGreaterThanOrEqual(7);
    expect(Math.max(...busy)).toBeLessThanOrEqual(21);
  });
});

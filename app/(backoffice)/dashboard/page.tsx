import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatNumber, formatRupiah, jakartaDayStart } from "@/lib/format";
import { PERMISSIONS, resolveBranchScope } from "@/lib/permissions";

export const metadata: Metadata = { title: "Dashboard" };

const PERIOD_DAYS = 30;

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat ringkasan cabang...</p>}>
      <DashboardContent />
    </Suspense>
  );
}

type Row = { id: string; name: string; code: string; transactions: number; revenue: number; lowStock: number };

async function DashboardContent() {
  const user = await requireUser(PERMISSIONS["dashboard:view"]);
  const branchId = resolveBranchScope(user);
  const branchFilter = branchId ? { branchId } : {};
  const since = jakartaDayStart(PERIOD_DAYS - 1);

  // Tiga query agregat, bukan satu query per cabang (hindari N+1).
  const [branches, salesByBranch, lowStockByBranch] = await Promise.all([
    db.branch.findMany({
      where: { isActive: true, ...(branchId ? { id: branchId } : {}) },
      select: { id: true, name: true, code: true },
      orderBy: { code: "asc" },
    }),
    db.sale.groupBy({
      by: ["branchId"],
      where: { ...branchFilter, status: "COMPLETED", createdAt: { gte: since } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    db.branchStock.groupBy({
      by: ["branchId"],
      where: { ...branchFilter, quantity: { lt: db.branchStock.fields.minStock } },
      _count: { _all: true },
    }),
  ]);

  const rows: Row[] = branches.map((b) => {
    const sales = salesByBranch.find((s) => s.branchId === b.id);
    return {
      ...b,
      transactions: sales?._count._all ?? 0,
      revenue: sales?._sum.total ?? 0,
      lowStock: lowStockByBranch.find((s) => s.branchId === b.id)?._count._all ?? 0,
    };
  });
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalTransactions = rows.reduce((s, r) => s + r.transactions, 0);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">{formatDate(new Date())}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {branchId ? (user.branch?.name ?? "Cabang") : "Semua cabang"}
        </h1>
      </header>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <section aria-labelledby="omzet-title" className="space-y-3">
          <div>
            <h2 id="omzet-title" className="text-sm font-medium text-muted-foreground">
              Omzet {PERIOD_DAYS} hari terakhir
            </h2>
            <p className="money mt-1 text-4xl font-extrabold tracking-tight">{formatRupiah(totalRevenue)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              dari {formatNumber(totalTransactions)} transaksi selesai
            </p>
          </div>

          {/* HP: daftar bertumpuk, karena tabel 4 kolom tidak muat di lebar 375px. */}
          <ul className="divide-y rounded-xl border bg-card sm:hidden">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <p className="font-semibold">
                  {r.name}
                  <span className="ml-2 font-normal text-muted-foreground">{r.code}</span>
                </p>
                <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Omzet</dt>
                  <dd className="money text-right">{formatRupiah(r.revenue)}</dd>
                  <dt className="text-muted-foreground">Transaksi</dt>
                  <dd className="money text-right">{formatNumber(r.transactions)}</dd>
                  <dt className="text-muted-foreground">Di bawah stok minimum</dt>
                  <dd className={`money text-right ${r.lowStock > 0 ? "font-semibold text-destructive" : ""}`}>
                    {formatNumber(r.lowStock)} produk
                  </dd>
                </dl>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Ringkasan per cabang, {PERIOD_DAYS} hari terakhir</caption>
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Cabang
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Transaksi
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Omzet
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Produk di bawah stok minimum
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row" className="px-4 py-3 text-left font-semibold">
                      {r.name}
                      <span className="ml-2 font-normal text-muted-foreground">{r.code}</span>
                    </th>
                    <td className="money px-4 py-3 text-right">{formatNumber(r.transactions)}</td>
                    <td className="money px-4 py-3 text-right">{formatRupiah(r.revenue)}</td>
                    <td className={`money px-4 py-3 text-right ${r.lowStock > 0 ? "font-semibold text-destructive" : ""}`}>
                      {formatNumber(r.lowStock)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            Grafik per jam, produk terlaris, dan laba kotor menyusul di fase 5.
          </p>
        </section>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed p-8">
      <h2 className="font-semibold">Belum ada cabang aktif</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ringkasan muncul setelah ada cabang dan transaksi. Untuk data contoh, jalankan <code className="font-mono">pnpm db:seed</code>.
      </p>
    </div>
  );
}

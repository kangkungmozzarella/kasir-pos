import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BranchPicker } from "@/components/branch-picker";
import { ColumnChart, type ColumnPoint } from "@/components/charts/column-chart";
import { EmptyState, LoadingText } from "@/components/empty-state";
import { requireUser } from "@/lib/auth";
import { resolveBranchFilter } from "@/lib/branch-scope";
import { BASELINE_DAYS, getDashboard, TREND_DAYS, type DayPoint, type HourPoint } from "@/lib/dashboard";
import { formatDate, formatNumber, formatRupiah, TIME_ZONE } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<LoadingText>Memuat ringkasan...</LoadingText>}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

const timeFmt = new Intl.DateTimeFormat("id-ID", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dayTitle = new Intl.DateTimeFormat("id-ID", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "short" });
const pad = (n: number) => String(n).padStart(2, "0");

async function DashboardContent({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const user = await requireUser(PERMISSIONS["dashboard:view"]);
  const sp = await searchParams;
  const requested = Array.isArray(sp.branch) ? sp.branch[0] : sp.branch;
  const { branchId, branches } = await resolveBranchFilter(user, requested || undefined);
  if (branches.length === 0) {
    return (
      <EmptyState title="Belum ada cabang aktif">
        Ringkasan muncul setelah ada cabang dan transaksi. Untuk data contoh, jalankan <code className="font-mono">pnpm db:seed</code>.
      </EmptyState>
    );
  }

  const data = await getDashboard(branchId);
  const { today, yesterdaySoFar } = data;
  const isOwner = user.role === "OWNER";
  const branchName = branchId ? (branches.find((b) => b.id === branchId)?.name ?? "Cabang") : "Semua cabang";
  const branchQuery = isOwner && branchId ? `&branch=${branchId}` : "";

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{formatDate(data.now)}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{branchName}</h1>
        </div>
        {isOwner && branches.length > 1 && <BranchPicker branches={branches} value={branchId ?? ""} action="/dashboard" allLabel="Semua cabang" />}
      </header>

      {/* Hari ini: satu angka utama, tiga angka pendukung. */}
      <section aria-labelledby="today-title" className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] lg:items-end">
        <div>
          <h2 id="today-title" className="text-sm font-medium text-muted-foreground">
            Omzet hari ini
          </h2>
          <p className="mt-1 text-5xl font-extrabold tracking-tight">{formatRupiah(today.revenue)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Sampai pukul {timeFmt.format(data.now)}. Kemarin sampai jam yang sama{" "}
            <span className="money font-medium text-foreground">{formatRupiah(yesterdaySoFar.revenue)}</span> dari{" "}
            {formatNumber(yesterdaySoFar.transactions)} transaksi.
          </p>
        </div>
        <dl className="grid grid-cols-3 divide-x rounded-xl border bg-card">
          <Stat label="Transaksi" value={formatNumber(today.transactions)} />
          <Stat label="Rata-rata belanja" value={formatRupiah(today.avgBasket)} />
          <Stat label="Laba kotor" value={formatRupiah(today.grossProfit)} hint="sebelum pajak" />
        </dl>
      </section>

      <section aria-labelledby="hourly-title">
        <h2 id="hourly-title" className="font-semibold">
          Omzet per jam hari ini
        </h2>
        <p className="mt-0.5 mb-4 text-sm text-muted-foreground">
          Garis menunjukkan rata-rata jam yang sama selama {BASELINE_DAYS} hari sebelumnya, untuk melihat apakah hari ini lebih ramai atau sepi.
        </p>
        <ColumnChart
          points={data.hours.map(hourPoint(data.now))}
          label="Omzet per jam hari ini"
          valueHeader="Omzet hari ini"
          referenceHeader={`Rata-rata ${BASELINE_DAYS} hari`}
          legend={[
            { label: "Hari ini", kind: "bar" },
            { label: `Rata-rata ${BASELINE_DAYS} hari sebelumnya`, kind: "line" },
          ]}
        />
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="low-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="low-title" className="font-semibold">
              Stok menipis
            </h2>
            {data.low.total > 0 && (
              <Link
                href={`/stock?filter=low${branchQuery}`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Lihat semua ({formatNumber(data.low.total)})
              </Link>
            )}
          </div>
          {data.low.items.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Semua produk di atas stok minimum.</p>
          ) : (
            <ul className="mt-2 divide-y rounded-xl border bg-card">
              {data.low.items.map((s) => (
                <li key={`${s.branchId}:${s.productId}`}>
                  <Link
                    href={`/stock/${s.productId}${isOwner ? `?branch=${s.branchId}` : ""}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.name}</span>
                      {!branchId && <span className="text-xs text-muted-foreground">{s.branchCode}</span>}
                    </span>
                    <span className="money shrink-0 text-right">
                      <span className={s.quantity === 0 ? "font-semibold text-destructive" : "font-semibold"}>
                        {s.quantity === 0 ? "Habis" : `Sisa ${formatNumber(s.quantity)}`}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        minimum {formatNumber(s.minStock)} {s.unit}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="top-title">
          <h2 id="top-title" className="flex min-h-11 items-center font-semibold">
            Produk terlaris {TREND_DAYS} hari
          </h2>
          {data.top.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Belum ada penjualan dalam {TREND_DAYS} hari terakhir.</p>
          ) : (
            <ol className="mt-2 divide-y rounded-xl border bg-card">
              {data.top.map((p) => (
                <li key={p.productId} className="px-4 py-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{p.name}</span>
                    <span className="money shrink-0 font-semibold">{formatRupiah(p.revenue)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-muted" aria-hidden>
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${(p.revenue / data.top[0].revenue) * 100}%` }} />
                    </div>
                    <span className="money w-20 shrink-0 text-right text-xs text-muted-foreground">{formatNumber(p.qty)} terjual</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section aria-labelledby="daily-title">
        <h2 id="daily-title" className="font-semibold">
          Omzet {TREND_DAYS} hari terakhir
        </h2>
        <p className="mt-0.5 mb-4 text-sm text-muted-foreground">
          Total{" "}
          <span className="money font-medium text-foreground">{formatRupiah(data.days.reduce((s, d) => s + d.revenue, 0))}</span> dari{" "}
          {formatNumber(data.days.reduce((s, d) => s + d.transactions, 0))} transaksi.
        </p>
        <ColumnChart
          points={data.days.map(dayPoint(data.days.length))}
          label={`Omzet harian ${TREND_DAYS} hari terakhir`}
          valueHeader="Omzet"
          legend={[
            { label: "Omzet per hari", kind: "bar" },
            { label: "Hari ini, masih berjalan", kind: "bar-partial" },
          ]}
        />
      </section>

      {data.branches && data.branches.length > 1 && <BranchComparison rows={data.branches} />}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 px-3 py-3 sm:px-4">
      <dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt>
      <dd className="mt-1 truncate text-base font-bold sm:text-xl">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function hourPoint(now: Date) {
  const nowHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false }).format(now));
  return (h: HourPoint): ColumnPoint => ({
    key: String(h.hour),
    axisLabel: h.hour % 3 === 1 ? pad(h.hour) : "",
    title: `Pukul ${pad(h.hour)}.00 sampai ${pad(h.hour)}.59`,
    value: h.revenue,
    valueText: h.hour > nowHour ? "Belum berjalan" : formatRupiah(h.revenue),
    detail: h.hour > nowHour ? undefined : `${formatNumber(h.transactions)} transaksi`,
    reference: h.baseline,
    referenceText: formatRupiah(h.baseline),
    partial: h.hour === nowHour,
    note: h.hour === nowHour ? "jam ini masih berjalan" : undefined,
  });
}

function dayPoint(count: number) {
  return (d: DayPoint, i: number): ColumnPoint => {
    const date = new Date(`${d.date}T12:00:00+07:00`);
    const isToday = i === count - 1;
    return {
      key: d.date,
      // Label tiap 7 hari dihitung dari hari ini, supaya hari ini selalu berlabel.
      axisLabel: (count - 1 - i) % 7 === 0 ? `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}` : "",
      title: dayTitle.format(date),
      value: d.revenue,
      valueText: formatRupiah(d.revenue),
      detail: `${formatNumber(d.transactions)} transaksi`,
      partial: isToday,
      note: isToday ? "hari ini, masih berjalan" : undefined,
    };
  };
}

function BranchComparison({ rows }: { rows: NonNullable<Awaited<ReturnType<typeof getDashboard>>["branches"]> }) {
  return (
    <section aria-labelledby="branch-title">
      <h2 id="branch-title" className="font-semibold">
        Perbandingan cabang
      </h2>
      <p className="mt-0.5 mb-3 text-sm text-muted-foreground">Kolom selain &quot;Hari ini&quot; dihitung untuk {TREND_DAYS} hari terakhir.</p>

      <ul className="divide-y rounded-xl border bg-card md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <p className="font-semibold">
              {r.name}
              <span className="ml-2 font-normal text-muted-foreground">{r.code}</span>
            </p>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Hari ini</dt>
              <dd className="money text-right">{formatRupiah(r.today)}</dd>
              <dt className="text-muted-foreground">Omzet {TREND_DAYS} hari</dt>
              <dd className="money text-right">{formatRupiah(r.revenue)}</dd>
              <dt className="text-muted-foreground">Laba kotor</dt>
              <dd className="money text-right">{formatRupiah(r.grossProfit)}</dd>
              <dt className="text-muted-foreground">Transaksi</dt>
              <dd className="money text-right">{formatNumber(r.transactions)}</dd>
              <dt className="text-muted-foreground">Stok menipis</dt>
              <dd className={`money text-right ${r.lowStock > 0 ? "font-semibold text-destructive" : ""}`}>{formatNumber(r.lowStock)} produk</dd>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Perbandingan cabang</caption>
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Cabang</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Hari ini</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Omzet</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Laba kotor</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Transaksi</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Rata-rata belanja</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Stok menipis</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="px-4 py-3 text-left font-semibold">
                  <Link href={`/dashboard?branch=${r.id}`} className="rounded outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                    {r.name}
                  </Link>
                  <span className="ml-2 font-normal text-muted-foreground">{r.code}</span>
                </th>
                <td className="money px-4 py-3 text-right">{formatRupiah(r.today)}</td>
                <td className="money px-4 py-3 text-right">{formatRupiah(r.revenue)}</td>
                <td className="money px-4 py-3 text-right">{formatRupiah(r.grossProfit)}</td>
                <td className="money px-4 py-3 text-right">{formatNumber(r.transactions)}</td>
                <td className="money px-4 py-3 text-right">{formatRupiah(r.transactions ? Math.round(r.revenue / r.transactions) : 0)}</td>
                <td className={`money px-4 py-3 text-right ${r.lowStock > 0 ? "font-semibold text-destructive" : ""}`}>{formatNumber(r.lowStock)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

"use client";

import { useId, useState } from "react";
import { formatCompact, niceTicks } from "@/lib/chart-scale";
import { cn } from "@/lib/utils";

export type ColumnPoint = {
  key: string;
  /** Label sumbu X; kosongkan untuk melewati (supaya label tidak berdesakan). */
  axisLabel: string;
  /** Judul di tooltip dan tabel, mis. "Senin, 24 Nov". */
  title: string;
  value: number;
  valueText: string;
  /** Baris tambahan di bawah nilai, mis. jumlah transaksi. */
  detail?: string;
  /** Nilai pembanding (mis. rata-rata), digambar sebagai garis pendek di slot yang sama. */
  reference?: number;
  referenceText?: string;
  /** Batang pucat: data belum lengkap (mis. hari ini yang masih berjalan). */
  partial?: boolean;
  note?: string;
};

type LegendItem = { label: string; kind: "bar" | "bar-partial" | "line" };

type Props = {
  points: ColumnPoint[];
  /** Nama grafik untuk pembaca layar dan judul kolom tabel. */
  label: string;
  valueHeader: string;
  /** Nama nilai pembanding, mis. "Rata-rata 28 hari". */
  referenceHeader?: string;
  legend?: LegendItem[];
};

/**
 * Grafik kolom satu seri, dengan garis pembanding opsional. Batang tipis (maks 24px)
 * dengan ujung membulat 4px, grid tipis, tooltip saat hover atau fokus keyboard
 * (panah kiri/kanan), dan tabel sebagai pengganti yang setara.
 */
export function ColumnChart({ points, label, valueHeader, referenceHeader, legend }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  const max = Math.max(0, ...points.map((p) => Math.max(p.value, p.reference ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks.at(-1) || 1;
  const pct = (v: number) => `${(v / top) * 100}%`;
  const n = points.length;
  const current = active === null ? null : points[active];

  function onKeyDown(e: React.KeyboardEvent) {
    const last = n - 1;
    const next =
      e.key === "ArrowRight" ? Math.min(last, (active ?? -1) + 1)
      : e.key === "ArrowLeft" ? Math.max(0, (active ?? n) - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  }

  return (
    <div>
      {legend && legend.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="Keterangan grafik">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  l.kind === "bar" && "h-3 w-2.5 rounded-t-[3px] bg-primary",
                  l.kind === "bar-partial" && "h-3 w-2.5 rounded-t-[3px] bg-primary/35",
                  l.kind === "line" && "h-0.5 w-3.5 rounded-full bg-muted-foreground",
                )}
              />
              {l.label}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-2">
        {/* Sumbu Y */}
        <div className="relative h-44" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="money absolute right-0 translate-y-1/2 text-[11px] text-muted-foreground" style={{ bottom: pct(t) }}>
              {formatCompact(t)}
            </span>
          ))}
        </div>

        <div
          role="group"
          aria-label={`${label}. Gunakan panah kiri dan kanan untuk membaca tiap batang.`}
          aria-describedby={`${id}-live`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => active === null && setActive(n - 1)}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="relative h-44 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {ticks.map((t) => (
            <div key={t} aria-hidden className="absolute inset-x-0 border-t border-border" style={{ bottom: pct(t) }} />
          ))}
          <div className="absolute inset-0 flex">
            {points.map((p, i) => (
              <div
                key={p.key}
                aria-hidden
                onPointerEnter={() => setActive(i)}
                className={cn("relative h-full min-w-0 flex-1", active === i && "bg-muted/70")}
              >
                {p.value > 0 && (
                  <div
                    className={cn(
                      "absolute bottom-0 left-1/2 w-[calc(100%-2px)] max-w-6 -translate-x-1/2 rounded-t-[4px]",
                      p.partial ? "bg-primary/35" : "bg-primary",
                    )}
                    style={{ height: pct(p.value) }}
                  />
                )}
                {p.reference !== undefined && p.reference > 0 && (
                  <div
                    className="absolute left-1/2 h-0.5 w-[calc(100%-2px)] max-w-7 -translate-x-1/2 translate-y-1/2 rounded-full bg-muted-foreground"
                    style={{ bottom: pct(p.reference) }}
                  />
                )}
              </div>
            ))}
          </div>

          {current && active !== null && (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-0 z-10 min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md",
                active < n * 0.2 ? "translate-x-0" : active > n * 0.8 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${((active + 0.5) / n) * 100}%` }}
            >
              <p className="text-muted-foreground">{current.title}</p>
              <p className="money text-sm font-semibold">{current.valueText}</p>
              {current.detail && <p className="money text-muted-foreground">{current.detail}</p>}
              {current.referenceText && (
                <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-0.5 w-3 rounded-full bg-muted-foreground" />
                  <span>
                    {referenceHeader}: <span className="money">{current.referenceText}</span>
                  </span>
                </p>
              )}
              {current.note && <p className="mt-1 text-muted-foreground">{current.note}</p>}
            </div>
          )}
        </div>

        {/* Sumbu X */}
        <div />
        <div className="mt-1.5 flex" aria-hidden>
          {/* Label lebih lebar dari slotnya; label di tepi diratakan ke dalam supaya tidak keluar layar. */}
          {points.map((p, i) => (
            <span
              key={p.key}
              className={cn(
                "money flex min-w-0 flex-1 text-[11px] whitespace-nowrap text-muted-foreground",
                i === 0 ? "justify-start" : i === n - 1 ? "justify-end" : "justify-center",
              )}
            >
              <span>{p.axisLabel}</span>
            </span>
          ))}
        </div>
      </div>

      <p id={`${id}-live`} aria-live="polite" className="sr-only">
        {current ? `${current.title}: ${current.valueText}${current.detail ? `, ${current.detail}` : ""}${current.referenceText ? `, ${referenceHeader}: ${current.referenceText}` : ""}` : ""}
      </p>

      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-md font-medium text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Lihat sebagai tabel
        </summary>
        <div className="mt-2 max-h-80 overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">{label}</caption>
            <thead className="sticky top-0 border-b bg-card text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Waktu</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{valueHeader}</th>
                {referenceHeader && <th scope="col" className="px-3 py-2 text-right font-medium">{referenceHeader}</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {points.map((p) => (
                <tr key={p.key}>
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    {p.title}
                    {p.note && <span className="ml-1 text-muted-foreground">({p.note})</span>}
                  </th>
                  <td className="money px-3 py-1.5 text-right">
                    {p.valueText}
                    {p.detail && <span className="block text-xs text-muted-foreground">{p.detail}</span>}
                  </td>
                  {referenceHeader && <td className="money px-3 py-1.5 text-right text-muted-foreground">{p.referenceText}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

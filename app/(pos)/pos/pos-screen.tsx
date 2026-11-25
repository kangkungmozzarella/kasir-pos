"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useReducer, useRef, useState, useTransition } from "react";
import { ClockCounterClockwiseIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cartReducer, emptyCart, normalizeDiscounts } from "@/lib/cart";
import { formatNumber, formatRupiah } from "@/lib/format";
import { computeTotals } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { checkoutAction } from "./actions";
import { AmountInput, CartLines } from "./cart-panel";
import { DoneDialog, type DoneSale } from "./done-dialog";
import { HistoryDialog } from "./history-dialog";
import { PayDialog } from "./pay-dialog";
import { ProductGrid } from "./product-grid";
import type { PosCategory, PosProduct, PosShift, RecentSale } from "./types";

type Notice = { tone: "ok" | "error" | "info"; text: string } | null;

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("rounded border border-current/30 px-1.5 py-0.5 font-mono text-[11px] leading-none font-medium opacity-80", className)}>{children}</kbd>;
}

export function PosScreen({
  products,
  categories,
  shift,
  recentSales,
}: {
  products: PosProduct[];
  categories: PosCategory[];
  shift: PosShift;
  recentSales: RecentSale[];
}) {
  const [cart, dispatch] = useReducer(cartReducer, emptyCart);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingTxDiscount, setEditingTxDiscount] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState<string>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [done, setDone] = useState<DoneSale | null>(null);
  const [paying, startPaying] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const inCart = useCallback((id: string) => cart.lines.find((l) => l.productId === id)?.qty ?? 0, [cart.lines]);
  const available = useCallback((p: PosProduct) => p.stock - inCart(p.id), [inCart]);
  const focusSearch = useCallback(() => requestAnimationFrame(() => searchRef.current?.focus()), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!category || p.categoryId === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode?.startsWith(q) ?? false)),
    );
  }, [products, query, category]);

  // ---- Total (pratinjau; server menghitung ulang) ---------------------------
  const lines = normalizeDiscounts(
    cart.lines.filter((l) => byId.has(l.productId)),
    (id) => byId.get(id)!.price,
  );
  const missing = lines.length !== cart.lines.length;
  const overStock = lines.find((l) => l.qty > byId.get(l.productId)!.stock);
  const subtotal = lines.reduce((s, l) => s + byId.get(l.productId)!.price * l.qty - l.discount, 0);
  const txDiscount = Math.min(cart.transactionDiscount, subtotal);
  const totals =
    lines.length > 0
      ? computeTotals(
          lines.map((l) => ({ unitPrice: byId.get(l.productId)!.price, qty: l.qty, discount: l.discount })),
          { taxRate: shift.taxRate, transactionDiscount: txDiscount },
        )
      : null;
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const blocker = missing
    ? "Hapus produk yang sudah tidak dijual dari keranjang."
    : overStock
      ? `Jumlah ${byId.get(overStock.productId)!.name} melebihi stok (${byId.get(overStock.productId)!.stock}).`
      : null;
  const canPay = !!totals && !blocker;

  // ---- Aksi --------------------------------------------------------------------
  const add = useCallback(
    (p: PosProduct) => {
      if (available(p) <= 0) {
        setNotice({ tone: "error", text: `Stok ${p.name} habis.` });
        return;
      }
      dispatch({ type: "add", productId: p.id, max: p.stock });
      setNotice({ tone: "ok", text: `Ditambahkan: ${p.name}` });
      setConfirmClear(false);
    },
    [available],
  );

  /** Enter di kolom cari. Scanner barcode USB mengetik kode lalu Enter, jadi jalurnya sama. */
  function submitSearch() {
    const q = query.trim();
    if (!q) return;
    const exact =
      products.find((p) => p.barcode === q) ?? products.find((p) => p.sku.toLowerCase() === q.toLowerCase());
    const target = exact ?? (filtered.length === 1 ? filtered[0] : undefined);
    if (target) {
      add(target);
      setQuery("");
      return;
    }
    if (filtered.length === 0) {
      setNotice({ tone: "error", text: `"${q}" tidak ditemukan di cabang ini.` });
      if (/^\d{8,14}$/.test(q)) setQuery(""); // kosongkan supaya pindaian berikutnya tidak tergabung
    } else {
      setNotice({ tone: "info", text: `${filtered.length} produk cocok. Pilih salah satu, atau ketik lebih spesifik.` });
    }
  }

  function openPay() {
    if (!totals) return setNotice({ tone: "info", text: "Keranjang masih kosong." });
    if (blocker) return setNotice({ tone: "error", text: blocker });
    setPayError(undefined);
    setPayOpen(true);
  }

  function pay(tendered: number) {
    if (!totals) return;
    startPaying(async () => {
      const res = await checkoutAction({
        items: lines.map((l) => ({ productId: l.productId, qty: l.qty, discount: l.discount })),
        transactionDiscount: txDiscount,
        expectedTotal: totals.total,
        tendered,
      });
      if (res.ok) {
        setPayOpen(false);
        setDone(res);
      } else {
        setPayError(res.error);
      }
    });
  }

  function nextTransaction() {
    setDone(null);
    dispatch({ type: "clear" });
    setQuery("");
    setNotice(null);
    setConfirmClear(false);
    focusSearch();
  }

  const requestClear = useCallback(() => {
    if (cart.lines.length === 0) return;
    if (confirmClear) {
      dispatch({ type: "clear" });
      setConfirmClear(false);
      setNotice({ tone: "info", text: "Transaksi dibatalkan." });
    } else {
      setConfirmClear(true);
      setNotice({ tone: "info", text: "Tekan Esc atau Batal sekali lagi untuk mengosongkan keranjang." });
    }
  }, [cart.lines.length, confirmClear]);

  useEffect(() => {
    if (!confirmClear) return;
    const id = window.setTimeout(() => setConfirmClear(false), 4000);
    return () => window.clearTimeout(id);
  }, [confirmClear]);

  // ---- Shortcut keyboard -------------------------------------------------------
  // useEffectEvent: selalu membaca state terbaru tanpa memasang ulang listener.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (payOpen || done || historyOpen) return; // dialog menangani tombolnya sendiri
    const target = e.target as HTMLElement;
    const inSearch = target === searchRef.current;
    const typing = !inSearch && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement);

    if (e.key === "F2") {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    } else if (e.key === "F4") {
      e.preventDefault();
      openPay();
    } else if (e.key === "Escape" && !typing) {
      e.preventDefault();
      if (query) setQuery("");
      else requestClear();
    } else if ((e.key === "+" || e.key === "=" || e.key === "-") && !typing && !(inSearch && query)) {
      const p = cart.selectedId ? byId.get(cart.selectedId) : undefined;
      if (!p) return;
      e.preventDefault();
      dispatch({ type: "step", productId: p.id, delta: e.key === "-" ? -1 : 1, max: p.stock });
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- Tampilan ----------------------------------------------------------------
  const payLabel = totals ? formatRupiah(totals.total) : formatRupiah(0);

  return (
    <div className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <section aria-label="Produk" className="flex flex-col lg:min-h-0">
        <div className="shrink-0 px-4 pt-4 pb-2 sm:px-6">
          <p className="mb-2 text-xs text-muted-foreground">
            {shift.branchName} · {formatNumber(shift.saleCount)} transaksi di shift ini
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="pos-search" className="sr-only">
                Cari produk atau pindai barcode
              </label>
              <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                id="pos-search"
                type="search"
                autoFocus
                autoComplete="off"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitSearch();
                  }
                }}
                placeholder="Cari atau pindai barcode"
                className="h-12 w-full rounded-lg border border-input bg-card pr-14 pl-11 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 text-muted-foreground sm:block">F2</Kbd>
            </div>
            <Button variant="outline" className="h-12 gap-2" onClick={() => setHistoryOpen(true)}>
              <ClockCounterClockwiseIcon className="size-5" aria-hidden />
              <span className="hidden sm:inline">Riwayat</span>
              <span className="sr-only sm:hidden">Riwayat transaksi shift ini</span>
            </Button>
          </div>
          <p
            role="status"
            className={cn(
              "mt-2 min-h-5 text-sm",
              notice?.tone === "error" ? "text-destructive" : notice?.tone === "ok" ? "text-success" : "text-muted-foreground",
            )}
          >
            {notice?.text}
          </p>
        </div>
        <ProductGrid
          products={filtered}
          categories={categories}
          category={category}
          onCategory={(id) => {
            setCategory(id);
            focusSearch();
          }}
          available={available}
          onAdd={(p) => {
            add(p);
            focusSearch(); // kolom cari harus siap menerima pindaian berikutnya
          }}
          query={query.trim()}
        />
      </section>

      <aside id="keranjang" aria-labelledby="cart-title" className="flex flex-col border-t bg-card lg:min-h-0 lg:border-t-0 lg:border-l">
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
          <h2 id="cart-title" className="font-semibold">
            Keranjang
            {itemCount > 0 && <span className="money ml-1.5 font-normal text-muted-foreground">({formatNumber(itemCount)} barang)</span>}
          </h2>
          {cart.lines.length > 0 && (
            <Button variant={confirmClear ? "destructive" : "ghost"} onClick={requestClear} className="gap-2">
              {confirmClear ? "Ya, kosongkan" : "Batal"}
              <Kbd className="hidden sm:inline">Esc</Kbd>
            </Button>
          )}
        </div>

        <CartLines lines={cart.lines} selectedId={cart.selectedId} productOf={(id) => byId.get(id)} dispatch={dispatch} />

        <div className="shrink-0 space-y-1.5 border-t px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="money">{formatRupiah(totals?.subtotal ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setEditingTxDiscount((v) => !v)}
              disabled={!totals}
              aria-expanded={editingTxDiscount}
              className="-ml-1 min-h-9 rounded px-1 text-left text-muted-foreground underline decoration-dotted underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:no-underline"
            >
              Diskon transaksi
            </button>
            <span className="money">{txDiscount > 0 ? `-${formatRupiah(txDiscount)}` : formatRupiah(0)}</span>
          </div>
          {editingTxDiscount && totals && (
            <AmountInput
              label="Diskon transaksi"
              hint={`Potongan untuk seluruh belanja, maksimal ${formatRupiah(totals.subtotal)}.`}
              value={cart.transactionDiscount}
              onCommit={(v) => {
                dispatch({ type: "setTransactionDiscount", amount: v });
                setEditingTxDiscount(false);
                focusSearch();
              }}
              onCancel={() => setEditingTxDiscount(false)}
            />
          )}
          {cart.transactionDiscount > txDiscount && (
            <p className="text-xs text-destructive">Diskon dipangkas menjadi sebesar subtotal.</p>
          )}
          {shift.taxRate > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">PPN {shift.taxRate}%</span>
              <span className="money">{formatRupiah(totals?.taxTotal ?? 0)}</span>
            </div>
          )}
        </div>

        <div className="hidden shrink-0 px-4 pb-4 lg:block">
          {blocker && <p className="mb-2 text-sm text-destructive">{blocker}</p>}
          <Button variant="highlight" onClick={openPay} disabled={!canPay} className="h-16 w-full justify-between px-5 text-lg">
            <span className="flex items-center gap-2">
              Bayar <Kbd>F4</Kbd>
            </span>
            <span className="money text-2xl font-extrabold">{payLabel}</span>
          </Button>
        </div>
      </aside>

      {/* HP dan tablet tegak: ringkasan dan tombol bayar selalu terlihat di bawah. */}
      <div className="sticky bottom-0 z-30 flex items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <a href="#keranjang" className="min-w-0 flex-1 rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="block text-xs text-muted-foreground">
            {itemCount > 0 ? `${formatNumber(itemCount)} barang · lihat keranjang` : "Keranjang kosong"}
          </span>
          <span className="money block text-xl font-extrabold">{payLabel}</span>
        </a>
        <Button variant="highlight" size="lg" onClick={openPay} disabled={!canPay} className="h-12 px-6">
          Bayar
        </Button>
      </div>

      <PayDialog
        open={payOpen}
        onOpenChange={(o) => {
          setPayOpen(o);
          if (!o) focusSearch();
        }}
        total={totals?.total ?? 0}
        pending={paying}
        error={payError}
        onPay={pay}
        returnFocus={searchRef}
      />
      <DoneDialog sale={done} onNext={nextTransaction} returnFocus={searchRef} />
      <HistoryDialog
        open={historyOpen}
        onOpenChange={(o) => {
          setHistoryOpen(o);
          if (!o) focusSearch();
        }}
        sales={recentSales}
        shift={shift}
        returnFocus={searchRef}
      />
    </div>
  );
}

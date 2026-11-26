import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingText } from "@/components/empty-state";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { effectivePrice } from "@/lib/pricing";
import { switchCandidates } from "@/lib/pin";
import { findPendingSale } from "@/lib/sale-flow";
import { getOpenShift } from "@/lib/shift";
import { toClientState } from "./client-state";
import { OpenShiftForm } from "./open-shift-form";
import { PosScreen } from "./pos-screen";
import { SwitchCashier } from "./switch-cashier";

export const metadata: Metadata = { title: "Kasir" };

const RECENT_LIMIT = 20;

export default function PosPage() {
  return (
    <Suspense fallback={<div className="p-6"><LoadingText>Menyiapkan layar kasir...</LoadingText></div>}>
      <PosContent />
    </Suspense>
  );
}

async function PosContent() {
  const user = await requireUser(PERMISSIONS["pos:use"]);
  const shift = await getOpenShift(user.id);
  if (!shift) return <OpenShift user={user} />;

  const [stocks, categories, recent, saleCount, pending, candidates] = await Promise.all([
    db.branchStock.findMany({
      where: { branchId: shift.branchId, product: { isActive: true } },
      orderBy: { product: { name: "asc" } },
      select: {
        quantity: true,
        priceOverride: true,
        product: { select: { id: true, name: true, sku: true, barcode: true, unit: true, price: true, categoryId: true } },
      },
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.sale.findMany({
      where: { shiftId: shift.id, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
      select: { id: true, invoiceNo: true, createdAt: true, total: true, _count: { select: { items: true } } },
    }),
    db.sale.count({ where: { shiftId: shift.id, status: "COMPLETED" } }),
    findPendingSale(user),
    switchCandidates(user),
  ]);

  return (
    <PosScreen
      products={stocks.map((s) => ({
        id: s.product.id,
        name: s.product.name,
        sku: s.product.sku,
        barcode: s.product.barcode,
        unit: s.product.unit,
        price: effectivePrice(s.product.price, s.priceOverride),
        stock: s.quantity,
        categoryId: s.product.categoryId,
      }))}
      categories={categories}
      shift={{
        id: shift.id,
        openedAt: shift.openedAt,
        branchName: shift.branch.name,
        taxRate: shift.branch.taxRate,
        saleCount,
      }}
      recentSales={recent.map((r) => ({
        id: r.id,
        invoiceNo: r.invoiceNo,
        createdAt: r.createdAt,
        total: r.total,
        itemCount: r._count.items,
      }))}
      switchCandidates={candidates}
      cashierName={user.name}
      pending={
        pending && {
          state: toClientState(pending.state),
          items: pending.items,
          transactionDiscount: pending.transactionDiscount,
        }
      }
    />
  );
}

async function OpenShift({ user }: { user: CurrentUser }) {
  const branches = await db.branch.findMany({
    where: { isActive: true, ...(user.role === "OWNER" ? {} : { id: user.branchId ?? "" }) },
    orderBy: { code: "asc" },
    select: { id: true, name: true },
  });
  const candidates = await switchCandidates(user);
  const last = await db.shift.findFirst({
    where: { cashierId: user.id, status: "CLOSED" },
    orderBy: { closedAt: "desc" },
    select: { closedAt: true },
  });

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <p className="text-sm text-muted-foreground">{branches.length === 1 ? branches[0].name : "Pilih cabang"}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Buka shift dulu</h1>
      <p className="mt-1 text-muted-foreground">
        Setiap transaksi dicatat di shift Anda, supaya uang di laci bisa dicocokkan saat tutup.
        {last?.closedAt && ` Shift terakhir ditutup ${formatDateTime(last.closedAt)}.`}
      </p>
      {branches.length === 0 ? (
        <p role="alert" className="mt-6 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Akun ini belum ditempatkan di cabang aktif. Hubungi admin.
        </p>
      ) : (
        <OpenShiftForm branches={branches} />
      )}
      {candidates.length > 0 && (
        <p className="mt-6 flex items-center gap-1 text-sm text-muted-foreground">
          Bukan {user.name}?
          <SwitchCashier candidates={candidates} className="-ml-1" />
        </p>
      )}
    </div>
  );
}

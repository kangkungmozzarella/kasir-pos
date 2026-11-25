import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BranchPicker } from "@/components/branch-picker";
import { EmptyState, LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { resolveSingleBranch } from "@/lib/branch-scope";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { MOVEMENT_LABEL } from "@/lib/stock-labels";
import { countStock, receiveStock, updateBranchStockSettings } from "../actions";
import { BranchSettingsForm, OpnameForm, StockInForm } from "../stock-forms";

export const metadata: Metadata = { title: "Atur stok" };

const HISTORY_LIMIT = 30;

export default function StockDetailPage(props: PageProps<"/stock/[productId]">) {
  return (
    <Suspense fallback={<LoadingText>Memuat stok produk...</LoadingText>}>
      <StockDetail {...props} />
    </Suspense>
  );
}

async function StockDetail({ params, searchParams }: PageProps<"/stock/[productId]">) {
  const user = await requireUser(PERMISSIONS["stock:manage"]);
  const [{ productId }, sp] = await Promise.all([params, searchParams]);
  const requested = typeof sp.branch === "string" ? sp.branch : undefined;
  const { branch, branches } = await resolveSingleBranch(user, requested);
  if (!branch) return <EmptyState title="Belum ada cabang aktif" />;

  const stock = await db.branchStock.findUnique({
    where: { branchId_productId: { branchId: branch.id, productId } },
    include: { product: { select: { name: true, sku: true, unit: true, price: true, isActive: true } } },
  });
  if (!stock) notFound();

  const movements = await db.stockMovement.findMany({
    where: { branchId: branch.id, productId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { id: true, type: true, quantity: true, note: true, createdAt: true, user: { select: { name: true } } },
  });

  const { product } = stock;
  const low = stock.quantity < stock.minStock;
  const isOwner = user.role === "OWNER";

  return (
    <>
      <PageHeader
        title={product.name}
        description={`${product.sku} · ${branch.name}${product.isActive ? "" : " · produk nonaktif"}`}
        back={{ href: isOwner ? `/stock?branch=${branch.id}` : "/stock", label: "Stok" }}
        actions={isOwner && branches.length > 1 && <BranchPicker branches={branches} value={branch.id} action={`/stock/${productId}`} />}
      />

      <div className="mb-8">
        <p className="text-sm text-muted-foreground">Stok tercatat</p>
        <p className={`money text-4xl font-extrabold tracking-tight ${low ? "text-destructive" : ""}`}>
          {formatNumber(stock.quantity)} <span className="text-xl font-semibold text-muted-foreground">{product.unit}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Minimum {formatNumber(stock.minStock)}
          {low && <span className="font-semibold text-destructive"> · perlu ditambah</span>}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StockInForm action={receiveStock.bind(null, productId, branch.id)} unit={product.unit} />
        <OpnameForm action={countStock.bind(null, productId, branch.id)} current={stock.quantity} unit={product.unit} />
        <BranchSettingsForm
          action={updateBranchStockSettings.bind(null, productId, branch.id)}
          minStock={stock.minStock}
          priceOverride={stock.priceOverride}
          basePrice={product.price}
        />
      </div>

      <section aria-labelledby="riwayat" className="mt-10">
        <h2 id="riwayat" className="text-lg font-semibold">
          Riwayat stok
        </h2>
        <p className="text-sm text-muted-foreground">{HISTORY_LIMIT} perubahan terakhir di cabang ini.</p>
        {movements.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="Belum ada perubahan stok">Riwayat muncul setelah ada barang masuk, penjualan, atau stok opname.</EmptyState>
          </div>
        ) : (
          <ol className="mt-3 divide-y rounded-xl border bg-card">
            {movements.map((m) => (
              <li key={m.id} className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{MOVEMENT_LABEL[m.type]}</p>
                  <p className="truncate text-muted-foreground">
                    {formatDateTime(m.createdAt)}
                    {m.user ? ` · ${m.user.name}` : ""}
                    {m.note ? ` · ${m.note}` : ""}
                  </p>
                </div>
                <p className={`money self-center text-right font-semibold ${m.quantity < 0 ? "text-destructive" : "text-success"}`}>
                  {m.quantity > 0 ? "+" : "−"}
                  {formatNumber(Math.abs(m.quantity))}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

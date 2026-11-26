import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Data untuk form transfer: cabang asal yang boleh dipakai user dan stok produknya. */
export async function loadTransferFormData(user: CurrentUser) {
  const branches = await db.branch.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, name: true, code: true } });
  const origins = user.role === "OWNER" ? branches : branches.filter((b) => b.id === user.branchId);
  const stocks = await db.branchStock.findMany({
    where: { branchId: { in: origins.map((b) => b.id) }, product: { isActive: true } },
    orderBy: { product: { name: "asc" } },
    select: { branchId: true, quantity: true, product: { select: { id: true, name: true, sku: true, unit: true } } },
  });
  const products: Record<string, { id: string; name: string; sku: string; unit: string; stock: number }[]> = {};
  for (const s of stocks) (products[s.branchId] ??= []).push({ ...s.product, stock: s.quantity });
  return { branches, origins, products };
}

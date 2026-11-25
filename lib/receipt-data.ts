import "server-only";
import type { ReceiptData } from "@/components/receipt/receipt";
import type { CurrentUser } from "./auth";
import { db } from "./db";

/**
 * Data struk, atau null bila tidak ada / tidak boleh dilihat user ini.
 * Kasir hanya bisa membuka struk transaksinya sendiri; Admin semua struk di
 * cabangnya; Pemilik semua struk.
 */
export async function getReceipt(saleId: string, user: CurrentUser): Promise<ReceiptData | null> {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      branch: { select: { name: true, address: true, phone: true, receiptFooter: true } },
      cashier: { select: { name: true } },
      items: { orderBy: { id: "asc" } },
      payments: { where: { status: { in: ["PAID", "REFUNDED"] } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!sale) return null;
  const allowed =
    user.role === "OWNER" ||
    (user.role === "ADMIN" && sale.branchId === user.branchId) ||
    (user.role === "CASHIER" && sale.cashierId === user.id);
  if (!allowed) return null;

  return {
    store: {
      name: sale.branch.name,
      address: sale.branch.address,
      phone: sale.branch.phone,
      footer: sale.branch.receiptFooter,
    },
    invoiceNo: sale.invoiceNo,
    createdAt: sale.completedAt ?? sale.createdAt,
    cashierName: sale.cashier.name,
    status: sale.status,
    items: sale.items.map((i) => ({
      name: i.productName,
      qty: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      lineTotal: i.lineTotal,
    })),
    subtotal: sale.subtotal,
    discountTotal: sale.discountTotal,
    taxRate: sale.taxRate,
    taxTotal: sale.taxTotal,
    total: sale.total,
    payments: sale.payments.map((p) => ({
      method: p.method,
      amount: p.amount,
      tendered: p.tendered,
      change: p.change,
      providerRef: p.providerRef,
      cardLast4: p.cardLast4,
      approvalCode: p.approvalCode,
    })),
  };
}

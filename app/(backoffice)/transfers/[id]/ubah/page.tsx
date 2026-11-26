import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { loadTransferFormData } from "../../load";
import { TransferForm } from "../../transfer-form";

export const metadata: Metadata = { title: "Ubah transfer" };

export default function EditTransferPage({ params }: PageProps<"/transfers/[id]/ubah">) {
  return (
    <Suspense fallback={<LoadingText>Memuat transfer...</LoadingText>}>
      <EditTransfer params={params} />
    </Suspense>
  );
}

async function EditTransfer({ params }: { params: PageProps<"/transfers/[id]/ubah">["params"] }) {
  const user = await requireUser(PERMISSIONS["transfer:manage"]);
  const { id } = await params;
  const t = await db.stockTransfer.findUnique({
    where: { id },
    select: { id: true, transferNo: true, status: true, fromBranchId: true, toBranchId: true, note: true, items: { select: { productId: true, quantity: true } } },
  });
  // Hanya cabang asal yang mengubah draf; yang lain mendapat 404.
  if (!t || (user.role === "ADMIN" && user.branchId !== t.fromBranchId)) notFound();
  if (t.status !== "DRAFT") redirect(`/transfers/${t.id}`);
  const data = await loadTransferFormData(user);

  return (
    <>
      <PageHeader title={`Ubah ${t.transferNo}`} back={{ href: `/transfers/${t.id}`, label: "Kembali ke transfer" }} />
      <TransferForm
        {...data}
        transferId={t.id}
        initial={{
          fromBranchId: t.fromBranchId,
          toBranchId: t.toBranchId,
          note: t.note ?? "",
          items: t.items.map((i) => ({ productId: i.productId, qty: i.quantity })),
        }}
      />
    </>
  );
}

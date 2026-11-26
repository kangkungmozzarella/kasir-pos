import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { loadTransferFormData } from "../load";
import { TransferForm } from "../transfer-form";

export const metadata: Metadata = { title: "Transfer baru" };

export default function NewTransferPage() {
  return (
    <>
      <PageHeader title="Transfer baru" description="Kirim stok dari satu cabang ke cabang lain." back={{ href: "/transfers", label: "Semua transfer" }} />
      <Suspense fallback={<LoadingText>Memuat stok cabang...</LoadingText>}>
        <NewTransfer />
      </Suspense>
    </>
  );
}

async function NewTransfer() {
  const user = await requireUser(PERMISSIONS["transfer:manage"]);
  const data = await loadTransferFormData(user);
  return <TransferForm {...data} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { updateBranch } from "../actions";
import { BranchForm } from "../branch-form";

export const metadata: Metadata = { title: "Ubah cabang" };

export default function EditBranchPage({ params }: PageProps<"/branches/[id]">) {
  return (
    <Suspense fallback={<LoadingText>Memuat cabang...</LoadingText>}>
      <EditBranch params={params} />
    </Suspense>
  );
}

async function EditBranch({ params }: { params: PageProps<"/branches/[id]">["params"] }) {
  await requireUser(PERMISSIONS["branch:manage"]);
  const { id } = await params;
  const branch = await db.branch.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, address: true, phone: true, taxRate: true, receiptFooter: true, isActive: true },
  });
  if (!branch) notFound();
  return (
    <>
      <PageHeader title={branch.name} back={{ href: "/branches", label: "Cabang" }} />
      <BranchForm key={branch.id} action={updateBranch.bind(null, branch.id)} branch={branch} submitLabel="Simpan perubahan" />
    </>
  );
}

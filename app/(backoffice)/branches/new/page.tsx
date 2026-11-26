import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createBranch } from "../actions";
import { BranchForm } from "../branch-form";

export const metadata: Metadata = { title: "Tambah cabang" };

export default function NewBranchPage() {
  return (
    <>
      <PageHeader title="Tambah cabang" back={{ href: "/branches", label: "Cabang" }} />
      <Suspense fallback={<LoadingText>Menyiapkan formulir...</LoadingText>}>
        <NewBranch />
      </Suspense>
    </>
  );
}

async function NewBranch() {
  await requireUser(PERMISSIONS["branch:manage"]);
  return <BranchForm action={createBranch} submitLabel="Simpan cabang" redirectTo="/branches" />;
}

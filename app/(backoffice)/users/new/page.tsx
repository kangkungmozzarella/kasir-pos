import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { manageableRoles, PERMISSIONS } from "@/lib/permissions";
import { createUser } from "../actions";
import { UserForm } from "../user-form";

export const metadata: Metadata = { title: "Tambah pengguna" };

export default function NewUserPage() {
  return (
    <>
      <PageHeader title="Tambah pengguna" back={{ href: "/users", label: "Pengguna" }} />
      <Suspense fallback={<LoadingText>Menyiapkan formulir...</LoadingText>}>
        <NewUserForm />
      </Suspense>
    </>
  );
}

async function NewUserForm() {
  const actor = await requireUser(PERMISSIONS["user:manage"]);
  const branches = await db.branch.findMany({
    where: { isActive: true, ...(actor.role === "ADMIN" ? { id: actor.branchId ?? "" } : {}) },
    orderBy: { code: "asc" },
    select: { id: true, name: true },
  });
  return <UserForm action={createUser} roles={manageableRoles(actor.role)} branches={branches} redirectTo="/users" />;
}

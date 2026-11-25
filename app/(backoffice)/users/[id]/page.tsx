import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageUser, manageableRoles, PERMISSIONS } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/roles";
import { updateUser } from "../actions";
import { UserForm } from "../user-form";

export const metadata: Metadata = { title: "Ubah pengguna" };

export default function EditUserPage({ params }: PageProps<"/users/[id]">) {
  return (
    <Suspense fallback={<LoadingText>Memuat akun...</LoadingText>}>
      <EditUser params={params} />
    </Suspense>
  );
}

async function EditUser({ params }: { params: PageProps<"/users/[id]">["params"] }) {
  const actor = await requireUser(PERMISSIONS["user:manage"]);
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, branchId: true, isActive: true, pin: true },
  });
  // Akun yang tidak boleh dikelola diperlakukan sama dengan tidak ada.
  if (!user || !canManageUser(actor, user)) notFound();

  const branches = await db.branch.findMany({
    where: { isActive: true, ...(actor.role === "ADMIN" ? { id: actor.branchId ?? "" } : {}) },
    orderBy: { code: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader title={user.name} description={`${ROLE_LABEL[user.role]} · ${user.email}`} back={{ href: "/users", label: "Pengguna" }} />
      <UserForm
        action={updateUser.bind(null, user.id)}
        roles={manageableRoles(actor.role)}
        branches={branches}
        // Hash PIN tidak boleh ikut terkirim ke browser; cukup tanda ada/tidaknya.
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
          branchId: user.branchId,
          isActive: user.isActive,
          hasPin: !!user.pin,
        }}
      />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { EmptyState, LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { NativeSelectOption } from "@/components/ui/native-select";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageUser, PERMISSIONS } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/roles";

export const metadata: Metadata = { title: "Pengguna" };

export default function UsersPage({ searchParams }: PageProps<"/users">) {
  return (
    <Suspense fallback={<LoadingText>Memuat pengguna...</LoadingText>}>
      <UsersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UsersContent({ searchParams }: { searchParams: PageProps<"/users">["searchParams"] }) {
  const actor = await requireUser(PERMISSIONS["user:manage"]);
  const sp = await searchParams;
  const isOwner = actor.role === "OWNER";
  const branchFilter = isOwner && typeof sp.branch === "string" ? sp.branch : "";

  const [branches, users] = await Promise.all([
    isOwner ? db.branch.findMany({ orderBy: { code: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    db.user.findMany({
      where: isOwner ? (branchFilter ? { branchId: branchFilter } : {}) : { branchId: actor.branchId },
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true,
        pin: true,
        branch: { select: { name: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Pengguna"
        description={isOwner ? "Admin dan kasir di semua cabang." : `Akun di ${actor.branch?.name ?? "cabang Anda"}. Admin cabang bisa mengelola akun kasir.`}
        actions={
          <Link href="/users/new" className={buttonVariants()}>
            {isOwner ? "Tambah pengguna" : "Tambah kasir"}
          </Link>
        }
      />

      {isOwner && (
        <form method="get" className="mb-4 flex items-center gap-2">
          <label htmlFor="branch" className="text-sm font-medium">
            Cabang
          </label>
          <AutoSubmitSelect id="branch" name="branch" defaultValue={branchFilter} className="w-56">
            <NativeSelectOption value="">Semua cabang</NativeSelectOption>
            {branches.map((b) => (
              <NativeSelectOption key={b.id} value={b.id}>
                {b.name}
              </NativeSelectOption>
            ))}
          </AutoSubmitSelect>
          <noscript>
            <button type="submit" className={buttonVariants({ variant: "outline" })}>
              Tampilkan
            </button>
          </noscript>
        </form>
      )}

      {users.length === 0 ? (
        <EmptyState title="Belum ada pengguna di cabang ini">Tambahkan admin atau kasir lewat tombol di atas.</EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {users.map((u) => {
            const manageable = canManageUser(actor, u);
            const content = (
              <>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {u.name}
                    {u.id === actor.id && <span className="ml-2 font-normal text-muted-foreground">(Anda)</span>}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">{u.email}</span>
                </span>
                <span className="text-sm sm:text-right">
                  <span className="block font-medium">{ROLE_LABEL[u.role]}</span>
                  <span className="block text-muted-foreground">{u.branch?.name ?? "Semua cabang"}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                  {!u.isActive && <Badge variant="destructive">Nonaktif</Badge>}
                  {u.role === "CASHIER" && <Badge variant="outline">{u.pin ? "PIN diatur" : "Tanpa PIN"}</Badge>}
                </span>
              </>
            );
            const cls = "grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_12rem_9rem] sm:items-center";
            return (
              <li key={u.id} className={u.isActive ? "" : "opacity-70"}>
                {manageable ? (
                  <Link href={`/users/${u.id}`} className={`${cls} outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50`}>
                    {content}
                  </Link>
                ) : (
                  <div className={cls}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

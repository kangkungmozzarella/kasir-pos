import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, LoadingText } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Cabang" };

export default function BranchesPage() {
  return (
    <>
      <PageHeader
        title="Cabang"
        description="Tarif PPN, alamat, dan catatan kaki struk per cabang."
        actions={
          <Link href="/branches/new" className={buttonVariants()}>
            Tambah cabang
          </Link>
        }
      />
      <Suspense fallback={<LoadingText>Memuat cabang...</LoadingText>}>
        <BranchList />
      </Suspense>
    </>
  );
}

async function BranchList() {
  await requireUser(PERMISSIONS["branch:manage"]);
  const branches = await db.branch.findMany({
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      address: true,
      taxRate: true,
      isActive: true,
      _count: { select: { users: { where: { isActive: true } } } },
    },
  });
  if (branches.length === 0) return <EmptyState title="Belum ada cabang">Tambahkan cabang pertama untuk mulai berjualan.</EmptyState>;

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {branches.map((b) => (
        <li key={b.id}>
          <Link
            href={`/branches/${b.id}`}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="min-w-0">
              <p className="font-semibold">
                {b.name}
                <span className="money ml-2 font-normal text-muted-foreground">{b.code}</span>
              </p>
              <p className="text-sm text-muted-foreground">{b.address ?? "Alamat belum diisi"}</p>
            </div>
            <div className="text-right text-sm">
              <p className="money">PPN {b.taxRate}%</p>
              <p className="text-muted-foreground">
                {formatNumber(b._count.users)} pengguna aktif{!b.isActive && " · nonaktif"}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

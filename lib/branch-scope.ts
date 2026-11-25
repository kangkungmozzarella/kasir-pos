import "server-only";
import type { CurrentUser } from "./auth";
import { db } from "./db";
import { resolveBranchScope } from "./permissions";

/**
 * Untuk halaman yang selalu butuh satu cabang (mis. stok). Admin/kasir: cabangnya
 * sendiri. Pemilik: cabang yang diminta lewat ?branch=, atau cabang aktif pertama.
 */
export async function resolveSingleBranch(user: CurrentUser, requested: string | undefined) {
  const branches = await db.branch.findMany({
    where: { isActive: true, ...(user.role === "OWNER" ? {} : { id: user.branchId ?? "" }) },
    orderBy: { code: "asc" },
    select: { id: true, name: true, code: true },
  });
  // Admin yang mengetik ?branch= cabang lain di URL cukup diarahkan ke cabangnya sendiri;
  // penolakan keras ada di server action (resolveBranchScope).
  const scoped = resolveBranchScope(user, user.role === "OWNER" ? requested : undefined);
  const branch = branches.find((b) => b.id === scoped) ?? (user.role === "OWNER" ? branches[0] : undefined);
  return { branch, branches };
}

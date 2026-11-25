import Link from "next/link";
import { cn } from "@/lib/utils";

/** Navigasi halaman berbasis query string, berfungsi tanpa JavaScript. */
export function Pagination({
  page,
  pageCount,
  total,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const linkClass =
    "inline-flex h-11 items-center rounded-lg border bg-card px-4 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <nav aria-label="Halaman" className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Halaman {page} dari {pageCount} · {total} data
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={linkClass}>
            Sebelumnya
          </Link>
        ) : (
          <span aria-disabled className={cn(linkClass, "pointer-events-none opacity-50")}>
            Sebelumnya
          </span>
        )}
        {page < pageCount ? (
          <Link href={hrefFor(page + 1)} className={linkClass}>
            Berikutnya
          </Link>
        ) : (
          <span aria-disabled className={cn(linkClass, "pointer-events-none opacity-50")}>
            Berikutnya
          </span>
        )}
      </div>
    </nav>
  );
}

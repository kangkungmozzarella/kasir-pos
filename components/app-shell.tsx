import { Suspense } from "react";
import { SignOutIcon } from "@phosphor-icons/react/dist/ssr";
import { logout } from "@/app/(auth)/login/actions";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { requireUser } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/roles";

/**
 * `wide`: untuk layar kasir. Lebar penuh, dan di layar besar tingginya pas satu layar
 * supaya daftar produk dan keranjang bisa digulir sendiri-sendiri.
 */
export function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "flex min-h-dvh flex-col lg:h-dvh" : "flex min-h-dvh flex-col"}>
      <div aria-hidden className="awning shrink-0 print:hidden" />
      <header className="relative shrink-0 border-b print:hidden">
        <div className={`mx-auto flex h-16 w-full items-center gap-3 px-4 sm:gap-6 sm:px-6 ${wide ? "" : "max-w-6xl"}`}>
          <Wordmark />
          {/* Bagian yang bergantung pada session dirender per request; sisanya ikut static shell. */}
          <Suspense fallback={<div className="flex-1" />}>
            <HeaderSession />
          </Suspense>
          <ThemeToggle />
        </div>
      </header>
      <main className={wide ? "flex w-full flex-1 flex-col lg:min-h-0" : "mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8"}>
        {children}
      </main>
    </div>
  );
}

async function HeaderSession() {
  const user = await requireUser();
  const place = user.branch?.name ?? "Semua cabang";

  return (
    <>
      <div className="flex-1">
        <NavLinks items={navFor(user.role)} />
      </div>
      <div className="hidden text-right leading-tight lg:block">
        <p className="text-sm font-semibold">{user.name}</p>
        <p className="text-xs text-muted-foreground">
          {ROLE_LABEL[user.role]} · {place}
        </p>
      </div>
      <form action={logout}>
        <Button type="submit" variant="ghost" size="icon" aria-label="Keluar" title="Keluar">
          <SignOutIcon className="size-5" />
        </Button>
      </form>
    </>
  );
}

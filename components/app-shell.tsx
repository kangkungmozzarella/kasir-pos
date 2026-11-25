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

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div aria-hidden className="awning" />
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <Wordmark />
          {/* Bagian yang bergantung pada session dirender per request; sisanya ikut static shell. */}
          <Suspense fallback={<div className="flex-1" />}>
            <HeaderSession />
          </Suspense>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
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
      <div className="hidden text-right leading-tight md:block">
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

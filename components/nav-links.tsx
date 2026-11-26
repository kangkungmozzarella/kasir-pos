"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav";

const linkBase =
  "inline-flex h-11 items-center rounded-lg px-2.5 text-sm whitespace-nowrap font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Tutup menu HP setiap pindah halaman.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = items.find((i) => isActive(pathname, i.href));

  return (
    <>
      <nav aria-label="Navigasi utama" className="hidden items-center gap-0.5 lg:flex">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(linkBase, active && "bg-secondary text-foreground")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="lg:hidden">
        <Button
          variant="ghost"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="gap-2"
        >
          {open ? <XIcon className="size-5" aria-hidden /> : <ListIcon className="size-5" aria-hidden />}
          {current?.label ?? "Menu"}
        </Button>
        {open && (
          <nav
            id={panelId}
            aria-label="Navigasi utama"
            className="absolute inset-x-0 top-full z-40 border-b bg-background px-4 pb-4 shadow-md"
          >
            <ul className="grid gap-1 pt-2">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(linkBase, "w-full text-base", active && "bg-secondary text-foreground")}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </>
  );
}

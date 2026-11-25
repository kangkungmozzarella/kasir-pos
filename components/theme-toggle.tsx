"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // Ikon ditukar lewat CSS (kelas dark:), bukan state, supaya tidak ada
  // perbedaan render server/klien sebelum tema diketahui.
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Ganti tema terang atau gelap"
      title="Ganti tema terang atau gelap"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <MoonIcon className="size-5 dark:hidden" />
      <SunIcon className="hidden size-5 dark:block" />
    </Button>
  );
}

import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { LoginPanel } from "./login-panel";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div aria-hidden className="awning" />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-4 sm:px-6">
        <Wordmark />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 md:py-16">
        {/* Dibaca saat build: demo publik di-deploy dengan DEMO_RESET_ENABLED=true. */}
        <LoginPanel resetsNightly={process.env.DEMO_RESET_ENABLED === "true"} />
      </main>
    </div>
  );
}

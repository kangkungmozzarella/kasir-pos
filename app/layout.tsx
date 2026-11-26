import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { OfflineBanner, ServiceWorkerRegistration } from "@/components/pwa";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Alasan pemilihan font: lihat DESIGN.md (tipografi).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Kasir", template: "%s · Kasir" },
  description: "Aplikasi kasir multi-cabang (proyek portofolio). Semua pembayaran non-tunai adalah simulasi.",
  appleWebApp: { capable: true, title: "Kasir", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f3a60" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1814" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <OfflineBanner />
          {children}
          <Toaster position="top-center" />
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}

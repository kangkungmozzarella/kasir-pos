"use client";

import { useEffect, useSyncExternalStore } from "react";

/** Daftarkan service worker (hanya di production, supaya dev server tidak tersimpan di cache). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Gagal mendaftar tidak mengganggu aplikasi; hanya fitur pasang/offline yang hilang.
    });
  }, []);
  return null;
}

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Banner saat perangkat kehilangan koneksi. Transaksi tidak diantrekan untuk dikirim
 * nanti (bisa tercatat dua kali), jadi kasir perlu tahu bahwa aksinya belum tersimpan.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="shrink-0 bg-destructive px-4 py-2 text-center text-sm font-medium text-white dark:text-background print:hidden">
      Tidak ada koneksi internet. Transaksi belum bisa disimpan sampai perangkat online lagi.
    </div>
  );
}

/*
 * Service worker Kasir. Sengaja sederhana:
 * - Aset Next yang ber-hash (/_next/static) disimpan cache-first: aman karena isinya tidak pernah berubah.
 * - Halaman selalu diambil dari jaringan (data kasir harus terbaru dan halaman berisi data akun).
 *   Bila jaringan putus, tampilkan halaman /offline yang sudah disimpan.
 * - API, server action, dan data transaksi TIDAK pernah disimpan atau diantrekan: transaksi
 *   yang diulang otomatis bisa tercatat dua kali.
 */
const VERSION = "kasir-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});

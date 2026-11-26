import type { MetadataRoute } from "next";

/** Supaya bisa dipasang ke layar utama tablet/HP kasir. Tidak untuk offline penuh (lihat README). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kasir: aplikasi kasir toko",
    short_name: "Kasir",
    description: "Aplikasi kasir multi-cabang (demo portofolio). Pembayaran non-tunai adalah simulasi.",
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf6ef",
    theme_color: "#1f3a60",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

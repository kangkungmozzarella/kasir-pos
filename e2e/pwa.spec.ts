import { expect, test } from "@playwright/test";

test("PWA: manifest, ikon, dan service worker tersedia tanpa login", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const json = await manifest.json();
  expect(json).toMatchObject({ short_name: "Kasir", display: "standalone", lang: "id" });
  for (const icon of json.icons as { src: string }[]) {
    expect((await request.get(icon.src)).status()).toBe(200);
  }
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["cache-control"]).toContain("no-cache");
});

test("PWA: tanpa koneksi, halaman menampilkan penjelasan offline dan banner koneksi", async ({ page, context }) => {
  await page.goto("/login");
  // Tunggu service worker aktif dan menyimpan halaman offline.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });

  await context.setOffline(true);
  await expect(page.getByText("Tidak ada koneksi internet. Transaksi belum bisa disimpan sampai perangkat online lagi.")).toBeVisible();
  await page.goto("/pos");
  await expect(page.getByRole("heading", { name: "Tidak ada koneksi internet" })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/Transaksi belum bisa disimpan/)).toHaveCount(0);
});

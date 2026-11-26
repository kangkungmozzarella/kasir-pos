import { expect, test } from "@playwright/test";
import { loginAs, toast } from "./helpers";

test("struk: pratinjau ESC/POS 32/48 kolom dan cetak ke printer USB (Web Serial tiruan)", async ({ page }) => {
  // Printer tiruan: menyimpan byte yang dikirim, supaya bisa diperiksa tanpa perangkat.
  await page.addInitScript(() => {
    const sent: number[] = [];
    (window as unknown as { __sent: number[] }).__sent = sent;
    const port = {
      open: async () => {},
      close: async () => {},
      writable: new WritableStream<Uint8Array>({ write: (chunk) => void sent.push(...chunk) }),
    };
    Object.defineProperty(navigator, "serial", { value: { getPorts: async () => [port], requestPort: async () => port } });
  });

  await loginAs(page, "admin.mdn01@demo.test", /dashboard/);
  await page.goto("/sales?status=COMPLETED");
  const invoice = (await page.getByRole("table", { name: "Riwayat penjualan" }).getByRole("link").first().innerText()).trim();
  await page.getByRole("link", { name: invoice }).first().click();
  await page.getByRole("link", { name: "Lihat struk" }).click();

  await page.getByText(/^Pratinjau printer thermal/).click();
  const preview = page.getByLabel("Pratinjau ESC/POS");
  await expect(preview).toContainText(invoice);
  await expect(preview).toContainText(/TOTAL\s+Rp [\d.]+/);
  const widest = async () => Math.max(...(await preview.innerText()).split("\n").map((l) => l.length));
  expect(await widest()).toBeLessThanOrEqual(32);
  await page.getByRole("radio", { name: "80 mm" }).click();
  await expect(page.getByText(/ESC\/POS, 48 kolom/)).toBeVisible();
  expect(await widest()).toBeGreaterThan(32);

  await page.getByRole("button", { name: "Cetak ke printer USB" }).click();
  await expect(toast(page, "Struk dikirim ke printer.")).toBeVisible();
  const sent = await page.evaluate(() => (window as unknown as { __sent: number[] }).__sent);
  expect(sent.slice(0, 2)).toEqual([0x1b, 0x40]); // init
  expect(sent.slice(-4)).toEqual([0x1d, 0x56, 0x42, 3]); // potong kertas
  expect(String.fromCharCode(...sent.filter((b) => b >= 0x20 && b < 0x7f))).toContain(invoice);
});

test("struk: tombol printer USB disembunyikan bila browser tidak mendukung Web Serial", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "serial", { value: undefined });
  });
  await loginAs(page, "admin.mdn01@demo.test", /dashboard/);
  await page.goto("/sales?status=COMPLETED");
  await page.getByRole("table", { name: "Riwayat penjualan" }).getByRole("link").first().click();
  await page.getByRole("link", { name: "Lihat struk" }).click();
  await expect(page.getByText(/^Pratinjau printer thermal/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cetak ke printer USB" })).toHaveCount(0);
});

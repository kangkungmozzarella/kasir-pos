import { expect, test, type Page } from "@playwright/test";
import { makeEan13 } from "../lib/ean13";
import { loginAs, toast } from "./helpers";

/** Barcode dari seed: awalan 20 + nomor urut SKU. */
const barcodeOf = (skuNo: number) => makeEan13(`20${String(skuNo).padStart(10, "0")}`);

async function ensureShift(page: Page, branch?: string) {
  await expect(page.getByRole("heading", { level: 1, name: "Buka shift dulu" }).or(page.getByLabel("Cari produk atau pindai barcode"))).toBeVisible();
  if (await page.getByRole("heading", { level: 1, name: "Buka shift dulu" }).isVisible()) {
    if (branch) await page.getByLabel("Cabang").selectOption({ label: branch });
    await page.getByLabel("Modal awal di laci").fill("500.000");
    await page.getByRole("button", { name: "Buka shift" }).click();
  }
  await expect(page.getByLabel("Cari produk atau pindai barcode")).toBeFocused();
}

const cart = (page: Page) => page.getByRole("list", { name: "Isi keranjang" });
const payButton = (page: Page) => page.getByRole("button", { name: /^Bayar/ }).first();
const stockOf = async (page: Page, name: string) => {
  const text = await page.getByRole("button", { name: new RegExp(`^Tambah ${name},`) }).innerText();
  return Number(text.match(/Sisa ([\d.]+)/)?.[1].replace(/\./g, "") ?? 0);
};

test.beforeEach(async ({ page }) => {
  // Dialog cetak tidak bisa diuji di browser headless; catat panggilannya saja.
  await page.addInitScript(() => {
    (window as unknown as { __printed: number }).__printed = 0;
    window.print = () => {
      (window as unknown as { __printed: number }).__printed++;
    };
  });
});

test("buka shift wajib diisi modal awal", async ({ page }) => {
  await loginAs(page, "kasir1.mdn02@demo.test", /\/pos$/);
  const heading = page.getByRole("heading", { level: 1, name: "Buka shift dulu" });
  if (await heading.isVisible()) {
    await page.getByRole("button", { name: "Buka shift" }).click();
    await expect(page.getByText("Modal awal wajib diisi.")).toBeVisible();
  }
  await ensureShift(page);
});

test("transaksi tunai lengkap: pindai, ubah jumlah, bayar, stok berkurang, struk", async ({ page, browser }) => {
  await loginAs(page, "kasir2.mdn01@demo.test", /\/pos$/);
  await ensureShift(page);
  const search = page.getByLabel("Cari produk atau pindai barcode");
  const stockBefore = await stockOf(page, "Gula Pasir 1 kg");

  // Scanner USB = ketik barcode + Enter.
  await search.fill(barcodeOf(3));
  await search.press("Enter");
  await expect(page.getByText("Ditambahkan: Gula Pasir 1 kg")).toBeVisible();
  await expect(search).toHaveValue("");
  await page.keyboard.press("+");
  await expect(cart(page).getByLabel("Jumlah Gula Pasir 1 kg")).toHaveValue("2");

  // Stok Air Mineral 600 ml di Medan Kota pada data seed = 0: tidak bisa dipilih.
  await expect(page.getByRole("button", { name: /^Tambah Air Mineral 600 ml,.*stok habis/ })).toBeDisabled();

  await page.getByRole("button", { name: /^Tambah Mi Instan Goreng,/ }).click();
  await expect(search).toBeFocused();

  // 2 x 18.500 + 3.500 = 40.500; PPN 11% = 4.455; total 44.955
  await expect(payButton(page)).toContainText("Rp 44.955");
  await page.keyboard.press("F4");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Rp 44.955")).toBeVisible();
  await dialog.getByRole("button", { name: "50.000" }).click();
  await expect(dialog.getByText("Rp 5.045")).toBeVisible();
  await dialog.getByLabel("Uang diterima").press("Enter");

  const done = page.getByRole("dialog");
  await expect(done.getByText("Transaksi selesai")).toBeVisible();
  await expect(done.getByText(/^MDN01-\d{8}-\d{4} · total Rp\s44\.955$/)).toBeVisible();
  await expect(done.getByText("Rp 5.045")).toBeVisible();
  const receiptHref = await done.getByRole("link", { name: "Lihat struk" }).getAttribute("href");

  // Cetak dari layar kasir lewat iframe tersembunyi.
  await done.getByRole("button", { name: "Cetak struk" }).click();
  const frame = page.frameLocator("#receipt-print-frame");
  await expect(frame.getByText("Gula Pasir 1 kg")).toBeAttached();
  await expect
    .poll(() => page.frame({ url: /embed=1/ })?.evaluate(() => (window as unknown as { __printed: number }).__printed))
    .toBe(1);

  await done.getByRole("button", { name: "Transaksi baru" }).click();
  await expect(page.locator("#keranjang").getByText("Keranjang kosong")).toBeVisible();
  await expect(search).toBeFocused();
  expect(await stockOf(page, "Gula Pasir 1 kg")).toBe(stockBefore - 2);

  // Halaman struk.
  await page.goto(receiptHref!);
  const receipt = page.getByRole("article");
  await expect(receipt).toContainText("Toko Contoh Medan Kota");
  await expect(receipt).toContainText("2 x 18.500");
  await expect(receipt).toContainText("PPN 11%");
  await expect(receipt).toContainText("Rp 44.955");
  await expect(receipt).toContainText("Kembalian");
  await expect(receipt).toContainText("5.045");
  await page.getByRole("radio", { name: "80 mm" }).click();
  await expect(page.getByRole("radio", { name: "80 mm" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Cetak" }).click();
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);

  // Kasir lain tidak bisa membuka struk ini.
  const otherCtx = await browser.newContext();
  const other = await otherCtx.newPage();
  await loginAs(other, "kasir1.mdn02@demo.test", /\/pos$/);
  // Status HTTP sudah 200 karena halaman di-stream; yang penting isi struk tidak terkirim.
  await other.goto(receiptHref!);
  await expect(other.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  await expect(other.getByRole("article")).toHaveCount(0);
  await expect(other.getByText("Gula Pasir 1 kg")).toHaveCount(0);
  await otherCtx.close();
});

test("harga yang diubah admin di tengah transaksi tidak ikut tertagih diam-diam", async ({ page, browser }) => {
  await loginAs(page, "kasir2.mdn02@demo.test", /\/pos$/);
  await ensureShift(page);
  await page.getByRole("button", { name: /^Tambah Kopi Bubuk Robusta 165 g,/ }).click();
  await expect(payButton(page)).toContainText("Rp 17.760"); // 16.000 + 11%

  // Admin menaikkan harga cabang saat barang sudah di keranjang.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginAs(admin, "admin.mdn02@demo.test", /dashboard/);
  await admin.goto("/stock?q=Kopi Bubuk");
  await admin.getByRole("link", { name: "Kopi Bubuk Robusta 165 g" }).click();
  await admin.getByLabel("Harga khusus cabang").fill("17.000");
  await admin.getByRole("button", { name: "Simpan pengaturan" }).click();
  await expect(toast(admin, "Pengaturan cabang disimpan.")).toBeVisible();

  await page.keyboard.press("F4");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Uang pas" }).click();
  await dialog.getByRole("button", { name: "Selesaikan transaksi" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Harga berubah");
  await expect(dialog.getByText("Rp 18.870")).toBeVisible(); // 17.000 + 11%, total baru tampil
  await dialog.getByRole("button", { name: "Uang pas" }).click();
  await dialog.getByRole("button", { name: "Selesaikan transaksi" }).click();
  await expect(page.getByText("Transaksi selesai")).toBeVisible();

  // Kembalikan harga supaya test bisa diulang.
  await admin.getByLabel("Harga khusus cabang").fill("");
  await admin.getByRole("button", { name: "Simpan pengaturan" }).click();
  await expect(toast(admin, "Pengaturan cabang disimpan.")).toHaveCount(2);
  await adminCtx.close();
});

test("Esc dua kali membatalkan transaksi; barcode tak dikenal diberi tahu", async ({ page }) => {
  await loginAs(page, "kasir1.mdn02@demo.test", /\/pos$/);
  await ensureShift(page);
  const search = page.getByLabel("Cari produk atau pindai barcode");

  await search.fill("2999999999994");
  await search.press("Enter");
  await expect(page.getByText('"2999999999994" tidak ditemukan di cabang ini.')).toBeVisible();
  await expect(search).toHaveValue("");

  await search.fill("SKU-0027");
  await search.press("Enter");
  await expect(page.getByText("Ditambahkan: Mi Instan Goreng")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Tekan Esc atau Batal sekali lagi")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Transaksi dibatalkan.")).toBeVisible();
  await expect(page.locator("#keranjang").getByText("Keranjang kosong")).toBeVisible();
});

test("Pemilik bisa membuka shift di cabang pilihan dan bertransaksi hanya dengan keyboard", async ({ page }) => {
  await loginAs(page, "pemilik@demo.test", /dashboard/);
  await page.goto("/pos");
  await ensureShift(page, "Toko Contoh Medan Baru");
  await expect(page.getByText(/^Toko Contoh Medan Baru ·/)).toBeVisible();

  await page.keyboard.type("SKU-0009"); // Air Mineral 600 ml
  await page.keyboard.press("Enter");
  await page.keyboard.press("+");
  await page.keyboard.press("F4");
  await page.keyboard.type("100000");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Transaksi selesai")).toBeVisible();
  await expect(page.getByRole("button", { name: "Transaksi baru" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#keranjang").getByText("Keranjang kosong")).toBeVisible();

  await page.getByRole("button", { name: "Riwayat" }).click();
  await expect(page.getByRole("dialog").getByText(/^MDN02-/).first()).toBeVisible();
});

test.describe("layar HP", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("ringkasan dan tombol bayar selalu terlihat, tanpa scroll horizontal", async ({ page }) => {
    await loginAs(page, "kasir1.mdn02@demo.test", /\/pos$/);
    await ensureShift(page);
    await page.getByRole("button", { name: /^Tambah Gula Pasir 1 kg,/ }).click();
    const bar = page.getByRole("button", { name: "Bayar", exact: true });
    await expect(bar).toBeInViewport();
    await expect(bar).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    await bar.click();
    await expect(page.getByRole("dialog").getByRole("radio", { name: "Tunai" })).toBeChecked();
  });
});

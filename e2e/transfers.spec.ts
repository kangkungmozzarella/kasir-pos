import { expect, test, type Page } from "@playwright/test";
import { login, loginAs, toast } from "./helpers";

// Produk ini tidak dipakai spec lain, supaya hitungan stok tidak terganggu test paralel.
const PRODUCT = "Bihun Jagung 175 g";

/** Sisa stok produk di cabang asal, dibaca dari hasil pencarian form transfer baru. */
async function originStock(page: Page) {
  await page.goto("/transfers/new");
  await page.getByLabel("Cari produk untuk ditambahkan").fill("Bihun Jagung");
  const text = await page.getByRole("button", { name: new RegExp(`^${PRODUCT}`) }).innerText();
  return Number(text.match(/sisa ([\d.]+)/)![1].replace(/\./g, ""));
}

test("transfer: Medan Kota mengirim, stok asal berkurang; Medan Baru menerima, stok tujuan bertambah", async ({ page, browser }) => {
  await loginAs(page, "admin.mdn01@demo.test", /dashboard/);
  const ctx = await browser.newContext();
  const tujuan = await ctx.newPage();
  await login(tujuan, "admin.mdn02@demo.test");
  await expect(tujuan).toHaveURL(/dashboard/);
  // Test ini memindahkan 3 barang tiap kali jalan; isi stok asal dulu bila menipis.
  if ((await originStock(page)) < 3) {
    await page.goto("/stock?q=Bihun");
    await page.getByRole("link", { name: PRODUCT }).click();
    await page.locator("#in-quantity").fill("50");
    await page.getByRole("button", { name: "Tambah stok" }).click();
    await expect(toast(page, /^Stok bertambah 50\./)).toBeVisible();
  }
  const asalBefore = await originStock(page);
  const tujuanBefore = await originStock(tujuan);

  // Draf: stok belum berubah.
  await page.getByRole("button", { name: new RegExp(`^${PRODUCT}`) }).click();
  const qty = page.getByLabel(`Jumlah ${PRODUCT}`);
  await expect(qty).toBeFocused();
  await qty.fill("3");
  await page.getByLabel("Ke cabang").selectOption({ label: "Toko Contoh Medan Baru" });
  await page.getByLabel("Catatan (opsional)").fill("Uji e2e");
  await page.getByRole("button", { name: "Simpan sebagai draf" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^TRF-MDN01-\d{8}-\d{2}$/ })).toBeVisible();
  await expect(page.getByText("Draf", { exact: true })).toBeVisible();
  const url = page.url();
  const transferNo = (await page.getByRole("heading", { level: 1 }).innerText()).trim();

  // Admin tujuan tidak bisa mengirim draf cabang lain.
  await tujuan.goto(url);
  await expect(tujuan.getByRole("button", { name: "Kirim sekarang" })).toHaveCount(0);

  await page.getByRole("button", { name: "Kirim sekarang" }).click();
  await expect(page.getByRole("dialog")).toContainText("Stok Toko Contoh Medan Kota langsung berkurang 3 barang");
  await page.getByRole("button", { name: "Ya, kirim" }).click();
  await expect(toast(page, `Transfer ${transferNo} dikirim.`)).toBeVisible();
  await expect(page.getByText("Dalam perjalanan", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Terima barang" })).toHaveCount(0);
  expect(await originStock(page)).toBe(asalBefore - 3);
  expect(await originStock(tujuan)).toBe(tujuanBefore); // masih di jalan

  await tujuan.goto("/transfers?dir=in&status=SENT");
  await tujuan.getByRole("link", { name: new RegExp(transferNo) }).click();
  await tujuan.getByRole("button", { name: "Terima barang" }).click();
  await tujuan.getByRole("button", { name: "Ya, terima" }).click();
  await expect(toast(tujuan, `Transfer ${transferNo} diterima.`)).toBeVisible();
  await expect(tujuan.getByText("Diterima", { exact: true }).first()).toBeVisible();
  await expect(tujuan.getByText(/oleh Admin Medan Baru$/)).toBeVisible();
  expect(await originStock(tujuan)).toBe(tujuanBefore + 3);
  await ctx.close();
});

test("transfer: draf yang melebihi stok ditolak saat dikirim, bisa diubah, lalu dibatalkan", async ({ page }) => {
  await loginAs(page, "admin.mdn02@demo.test", /dashboard/);
  await page.goto("/transfers/new");
  await page.getByLabel("Cari produk untuk ditambahkan").fill("Bawang Goreng");
  await page.getByRole("button", { name: /^Bawang Goreng 100 g/ }).click();
  await page.getByLabel("Jumlah Bawang Goreng 100 g").fill("99999");
  await expect(page.getByText(/^Melebihi stok asal/)).toBeVisible();
  await page.getByRole("button", { name: "Simpan sebagai draf" }).click();
  // Bukan getByRole("alert"): route announcer Next juga ber-role alert.
  await expect(page.getByText(/tidak cukup untuk Bawang Goreng 100 g/)).toBeVisible();

  await page.getByRole("button", { name: "Kirim sekarang" }).click();
  await page.getByRole("button", { name: "Ya, kirim" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Stok Bawang Goreng 100 g tidak cukup");
  await page.getByRole("button", { name: "Tidak jadi" }).click();

  await page.getByRole("link", { name: "Ubah draf" }).click();
  await page.getByLabel("Jumlah Bawang Goreng 100 g").fill("1");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText(/tidak cukup untuk Bawang Goreng 100 g/)).toHaveCount(0);

  await page.getByRole("button", { name: "Batalkan draf" }).click();
  await page.getByRole("button", { name: "Ya, batalkan" }).click();
  await expect(page.getByText("Dibatalkan", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Kirim sekarang" })).toHaveCount(0);
});

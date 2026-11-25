import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

async function ensureShift(page: Page) {
  const search = page.getByLabel("Cari produk atau pindai barcode");
  const heading = page.getByRole("heading", { level: 1, name: "Buka shift dulu" });
  await expect(heading.or(search)).toBeVisible();
  if (await heading.isVisible()) {
    await page.getByLabel("Modal awal di laci").fill("500.000");
    await page.getByRole("button", { name: "Buka shift" }).click();
  }
  await expect(search).toBeVisible();
}

const tile = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^Tambah ${name},`) });
const stockOf = async (page: Page, name: string) =>
  Number((await tile(page, name).innerText()).match(/Sisa ([\d.]+)/)?.[1].replace(/\./g, "") ?? 0);

/** Buka halaman simulator di "HP pembeli" (browser terpisah, tanpa login) lalu bayar atau tolak. */
async function payOnPhone(page: Page, decision: "Bayar" | "Tolak") {
  const href = await page.getByRole("link", { name: "Buka simulator" }).getAttribute("href");
  const phone = await page.context().browser()!.newContext({ viewport: { width: 375, height: 740 } });
  const p = await phone.newPage();
  await p.goto(href!);
  await expect(p.getByText("DEMO: bukan QRIS asli.")).toBeVisible();
  await p.getByRole("button", { name: new RegExp(`^${decision}`) }).click();
  await expect(p.getByText(decision === "Bayar" ? "Pembayaran berhasil." : "Pembayaran ditolak.")).toBeVisible();
  await phone.close();
}

test.describe.configure({ mode: "parallel" });

test("QRIS: ditolak pembeli, QR baru dibayar lewat simulator, layar kasir lanjut otomatis", async ({ page }) => {
  await loginAs(page, "kasir1.mdn01@demo.test", /\/pos$/);
  await ensureShift(page);
  await tile(page, "Gula Pasir 1 kg").click(); // 18.500 + PPN = 20.535
  await page.keyboard.press("F4");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "QRIS" }).click();
  await expect(dialog.getByLabel("Nominal QRIS")).toHaveValue("20535");
  await dialog.getByRole("button", { name: "Tampilkan QR" }).click();

  await expect(dialog.getByRole("img", { name: "Kode QR pembayaran Rp 20.535" })).toBeVisible();
  await expect(dialog.getByText("DEMO: bukan QRIS asli")).toBeVisible();
  await expect(dialog.getByText(/Menunggu pembayaran · [45]:\d\d/)).toBeVisible();
  await expect(page.getByText(/^Menunggu pembayaran MDN01-/)).toBeVisible(); // keranjang terkunci

  await payOnPhone(page, "Tolak");
  await expect(dialog.getByRole("button", { name: "Tampilkan QR" })).toBeVisible({ timeout: 8_000 });

  await dialog.getByRole("button", { name: "Tampilkan QR" }).click();
  await payOnPhone(page, "Bayar");
  await expect(page.getByText("Transaksi selesai")).toBeVisible({ timeout: 8_000 });
  const receipt = await page.getByRole("link", { name: "Lihat struk" }).getAttribute("href");
  await page.getByRole("button", { name: "Transaksi baru" }).click();

  await page.goto(receipt!);
  await expect(page.getByRole("article")).toContainText("QRIS");
  await expect(page.getByRole("article")).toContainText("Pembayaran non-tunai: simulasi demo");
});

test("batal sebelum lunas: QR dibatalkan, transaksi dibatalkan, stok yang dipesan kembali", async ({ page }) => {
  await loginAs(page, "kasir2.mdn01@demo.test", /\/pos$/);
  await ensureShift(page);
  const before = await stockOf(page, "Kecap Manis 520 ml");
  await tile(page, "Kecap Manis 520 ml").click();
  await page.keyboard.press("+");
  await page.keyboard.press("F4");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "QRIS" }).click();
  await dialog.getByRole("button", { name: "Tampilkan QR" }).click();
  await expect(dialog.getByRole("img", { name: /Kode QR/ })).toBeVisible();
  // Dialog modal menyembunyikan latar belakang; tutup dulu untuk membaca sisa stok.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await stockOf(page, "Kecap Manis 520 ml")).toBe(before - 2); // stok dipesan di server

  await page.keyboard.press("F4");
  await dialog.getByRole("button", { name: "Batalkan QR" }).click();
  await dialog.getByRole("button", { name: "Batalkan transaksi dan kembalikan stok" }).click();
  await expect(page.getByText(/^Transaksi MDN01-\d{8}-\d{4} dibatalkan\. Stok dikembalikan\.$/)).toBeVisible();
  await expect(page.locator("#keranjang").getByText("Keranjang kosong")).toBeVisible();
  await expect.poll(() => stockOf(page, "Kecap Manis 520 ml")).toBe(before);
});

test("kartu: nominal berakhiran 13 ditolak, lalu kartu lain disetujui", async ({ page }) => {
  await loginAs(page, "admin.mdn01@demo.test", /dashboard/);
  await page.goto("/pos");
  await ensureShift(page);
  await tile(page, "Beras Medium 5 kg").click(); // 68.000 + PPN = 75.480
  await page.keyboard.press("F4");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Kartu" }).click();
  await expect(dialog.getByText("Simulasi: nominal yang berakhiran 13 akan ditolak.")).toBeVisible();

  await dialog.getByLabel("Nominal Kartu").fill("10.013");
  await dialog.getByRole("button", { name: "Kirim ke terminal" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Kartu ditolak oleh bank penerbit.");

  await dialog.getByRole("radio", { name: "Kartu" }).click();
  await expect(dialog.getByLabel("Nominal Kartu")).toHaveValue("75480");
  await dialog.getByRole("button", { name: "Kirim ke terminal" }).click();
  await expect(page.getByText("Transaksi selesai")).toBeVisible();
  const receipt = await page.getByRole("link", { name: "Lihat struk" }).getAttribute("href");
  await page.getByRole("button", { name: "Transaksi baru" }).click();

  await page.goto(receipt!);
  await expect(page.getByRole("article")).toContainText(/Kartu\s*75\.480/);
  await expect(page.getByRole("article")).toContainText(/\*\*\*\* \d{4}/);
  await expect(page.getByRole("article")).toContainText(/Approval\s*\d{6}/);
});

test("kombinasi: sebagian QRIS, muat ulang halaman, sisanya tunai", async ({ page }) => {
  await loginAs(page, "admin.mdn02@demo.test", /dashboard/);
  await page.goto("/pos");
  await ensureShift(page);
  await tile(page, "Minyak Goreng Sawit 2 L").click(); // 38.000 + PPN = 42.180
  await page.keyboard.press("F4");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "QRIS" }).click();
  await dialog.getByLabel("Nominal QRIS").fill("20.000");
  await expect(dialog.getByText("Bayar sebagian. Sisa Rp 22.180 bisa dibayar tunai, QRIS, atau kartu.")).toBeVisible();
  await dialog.getByRole("button", { name: "Tampilkan QR" }).click();
  await payOnPhone(page, "Bayar");
  await expect(dialog.getByText("Sudah dibayar QRIS Rp 20.000")).toBeVisible({ timeout: 8_000 });
  await expect(dialog.getByText("Sisa tagihan")).toBeVisible();
  // Sudah ada uang masuk: kasir tidak bisa membatalkan sendiri.
  await expect(dialog.getByRole("button", { name: /Batalkan transaksi/ })).toHaveCount(0);

  // Kasir tidak sengaja memuat ulang halaman: transaksi dilanjutkan, bukan hilang.
  await page.reload();
  await expect(page.getByText(/^Menunggu pembayaran MDN02-/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Bayar/ }).first()).toContainText("Rp 22.180");
  await page.keyboard.press("F4");
  await page.getByRole("dialog").getByRole("button", { name: "Uang pas" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Selesaikan transaksi" }).click();
  await expect(page.getByText("Transaksi selesai")).toBeVisible();
  const receipt = await page.getByRole("link", { name: "Lihat struk" }).getAttribute("href");
  await page.getByRole("button", { name: "Transaksi baru" }).click();

  await page.goto(receipt!);
  const article = page.getByRole("article");
  await expect(article).toContainText(/QRIS\s*20\.000/);
  await expect(article).toContainText(/Tunai\s*22\.180/);
  await expect(article).toContainText("Rp 42.180");
});

test("webhook dan status transaksi menolak permintaan yang tidak sah", async ({ request }) => {
  const body = JSON.stringify({ providerRef: "MOCK-QR-palsu", status: "PAID" });
  const noSig = await request.post("/api/mock-provider/webhook", { data: body, headers: { "content-type": "application/json" } });
  expect(noSig.status()).toBe(401);
  const badSig = await request.post("/api/mock-provider/webhook", {
    data: body,
    headers: { "content-type": "application/json", "x-mock-signature": "00".repeat(32), "x-mock-timestamp": String(Math.floor(Date.now() / 1000)) },
  });
  expect(badSig.status()).toBe(401);

  const status = await request.get("/api/sales/apa-saja/status");
  expect(status.status()).toBe(401);
});

test("simulator untuk tagihan yang tidak ada menampilkan halaman tidak ditemukan", async ({ page }) => {
  await page.goto("/simulator/pay/MOCK-QR-tidak-ada");
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";
import { login, loginAs, toast, uid } from "./helpers";

// Sama persis dengan formatRupiah di aplikasi (termasuk spasi tak terputus setelah "Rp").
const rupiahText = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
/** Ambil nominal pertama "Rp 12.345" dari sebuah teks (tombol Bayar juga memuat "F4"). */
const parseRupiahText = (s: string) => Number(s.match(/Rp\s([\d.]+)/)![1].replace(/\./g, ""));

/** Admin membuat kasir baru, supaya alur tutup shift tidak bertabrakan dengan test lain yang memakai akun demo. */
async function createCashier(admin: Page) {
  const id = uid();
  const email = `kasir.shift.${id}@demo.test`;
  await admin.goto("/users/new");
  await admin.getByLabel("Nama").fill(`Kasir Shift ${id}`);
  await admin.getByLabel("Email").fill(email);
  await admin.getByLabel("Kata sandi").fill("rahasia123");
  await admin.getByRole("button", { name: "Buat akun" }).click();
  await expect(toast(admin, `Akun Kasir Shift ${id} dibuat.`)).toBeVisible();
  return { email, name: `Kasir Shift ${id}` };
}

test("kasir menutup shift dengan hitung per pecahan; admin melihat selisih lalu membatalkan transaksinya", async ({ page, browser }) => {
  await loginAs(page, "admin.mdn02@demo.test", /dashboard/);
  const { email, name } = await createCashier(page);

  // --- Kasir: buka shift, satu transaksi tunai, tutup shift ---------------------
  const ctx = await browser.newContext();
  const kasir = await ctx.newPage();
  await login(kasir, email, "rahasia123");
  await expect(kasir).toHaveURL(/\/pos$/);
  await kasir.getByLabel("Modal awal di laci").fill("200.000");
  await kasir.getByRole("button", { name: "Buka shift" }).click();
  await kasir.getByRole("button", { name: /^Tambah Gula Pasir 1 kg,/ }).click();
  const total = parseRupiahText(await kasir.getByRole("button", { name: /^Bayar/ }).first().innerText());
  await kasir.keyboard.press("F4");
  await kasir.getByRole("dialog").getByRole("button", { name: "Uang pas" }).click();
  await kasir.getByRole("dialog").getByRole("button", { name: "Selesaikan transaksi" }).click();
  await expect(kasir.getByText("Transaksi selesai")).toBeVisible();
  const invoice = (await kasir.getByText(/^MDN02-\d{8}-\d{4} · total/).innerText()).split(" ")[0];
  await kasir.getByRole("button", { name: "Transaksi baru" }).click();

  await kasir.getByRole("link", { name: "Tutup shift" }).click();
  await expect(kasir.getByRole("heading", { name: "Tutup shift" })).toBeVisible();
  await expect(kasir.getByText(/1 transaksi selesai/)).toBeVisible();
  // Hitung buta: angka sistem belum terlihat.
  await expect(kasir.getByText("Kas yang diharapkan")).toHaveCount(0);

  await kasir.getByText("Per pecahan").click();
  await kasir.getByLabel(rupiahText(100_000), { exact: true }).fill("2");
  await kasir.getByLabel(rupiahText(20_000), { exact: true }).fill("1");
  await kasir.getByLabel("Koin (total Rupiah)").fill("500");
  const counted = 220_500;
  await expect(kasir.getByText(rupiahText(counted), { exact: true })).toBeVisible();
  await kasir.getByRole("button", { name: "Lanjut" }).click();
  await expect(kasir.getByText(`Tutup shift dengan uang di laci ${rupiahText(counted)}?`)).toBeVisible();
  await kasir.getByRole("button", { name: "Ya, tutup shift" }).click();

  await expect(kasir).toHaveURL(/\/shifts\/[^/]+\?ditutup=1$/);
  await expect(kasir.getByText("Shift sudah ditutup.")).toBeVisible();
  const expected = 200_000 + total;
  const diff = counted - expected;
  const diffText = diff === 0 ? "Pas" : `${diff > 0 ? "Lebih" : "Kurang"} ${rupiahText(Math.abs(diff))}`;
  await expect(kasir.getByText(rupiahText(expected), { exact: true })).toBeVisible();
  await expect(kasir.getByText(diffText, { exact: true })).toBeVisible();
  const recapUrl = kasir.url().replace(/\?.*$/, "");

  // Shift sudah ditutup: layar kasir meminta buka shift baru.
  await kasir.getByRole("link", { name: "Kembali ke kasir" }).click();
  await expect(kasir.getByRole("heading", { name: "Buka shift dulu" })).toBeVisible();
  // Kasir tidak punya akses ke riwayat penjualan dan daftar shift.
  const forbidden = await kasir.request.get("/api/sales/export");
  expect(forbidden.status()).toBe(403);
  await ctx.close();

  // --- Admin: daftar shift, rekap, transaksi, void --------------------------------
  await page.goto("/shifts?filter=diff");
  await page.getByRole("link", { name }).first().click();
  await expect(page).toHaveURL(recapUrl);
  await expect(page.getByRole("heading", { level: 1, name: `Shift ${name}` })).toBeVisible();
  // Next 16 menyimpan halaman sebelumnya secara tersembunyi di DOM; batasi pencarian ke rekap ini.
  await expect(page.getByRole("region", { name: "Kas di laci" }).getByText(diffText, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Lihat transaksinya" }).click();
  await page.getByRole("link", { name: invoice }).first().click();

  await expect(page.getByRole("heading", { name: invoice })).toBeVisible();
  await page.getByRole("button", { name: "Batalkan transaksi" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(`Kembalikan uang tunai ${rupiahText(total)} ke pembeli.`)).toBeVisible();
  await dialog.getByRole("button", { name: "Batalkan transaksi" }).click();
  await expect(dialog.getByText("Tulis alasan pembatalan, minimal 5 karakter.")).toBeVisible();
  await dialog.getByLabel("Alasan pembatalan").fill("Pembeli batal membeli");
  await dialog.getByRole("button", { name: "Batalkan transaksi" }).click();
  await expect(toast(page, `Transaksi ${invoice} dibatalkan. Stok dikembalikan.`)).toBeVisible();
  await expect(page.getByText("Alasan: Pembeli batal membeli")).toBeVisible();
  await expect(page.getByText("Dikembalikan", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Batalkan transaksi" })).toHaveCount(0);

  // Rekap shift tidak berubah, void sesudah tutup ditandai terpisah.
  await page.goto(recapUrl);
  await expect(page.getByRole("region", { name: "Kas di laci" }).getByText(diffText, { exact: true })).toBeVisible();
  await expect(page.getByText("Dibatalkan setelah shift ditutup, tidak mengubah kas yang diharapkan di atas.")).toBeVisible();
});

test("dashboard menampilkan data seed; grafik bisa dibaca dengan keyboard dan sebagai tabel", async ({ page }) => {
  await loginAs(page, "admin.mdn01@demo.test", /dashboard/);
  await expect(page.getByRole("heading", { level: 1, name: "Toko Contoh Medan Kota" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Omzet hari ini" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Produk terlaris 30 hari" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Lihat semua \(\d+\)$/ })).toBeVisible(); // seed punya stok menipis
  await expect(page.getByRole("heading", { name: "Perbandingan cabang" })).toHaveCount(0); // hanya Pemilik

  const daily = page.getByRole("group", { name: /Omzet harian 30 hari/ });
  await daily.focus();
  await page.keyboard.press("Home");
  await expect(page.getByText(/^[A-Z][a-z]+, \d{1,2} [A-Z][a-z]+: Rp\s[\d.]+, \d+ transaksi$/)).toBeAttached();

  await page.getByText("Lihat sebagai tabel").last().click();
  const table = page.getByRole("table", { name: "Omzet harian 30 hari terakhir" });
  await expect(table.getByRole("row")).toHaveCount(31); // judul + 30 hari
});

test("pemilik: semua cabang dengan perbandingan, lalu satu cabang", async ({ page }) => {
  await loginAs(page, "pemilik@demo.test", /dashboard/);
  await expect(page.getByRole("heading", { level: 1, name: "Semua cabang" })).toBeVisible();
  const table = page.getByRole("table", { name: "Perbandingan cabang" });
  // Bukan hitung baris: test cabang berjalan paralel dan sempat membuat cabang uji aktif sebentar.
  await expect(table.getByRole("link", { name: "Toko Contoh Medan Kota" })).toBeVisible();
  await table.getByRole("link", { name: "Toko Contoh Medan Baru" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Toko Contoh Medan Baru" })).toBeVisible();
  await expect(page.getByLabel("Cabang", { exact: true })).not.toHaveValue("");
});

test("riwayat penjualan: saringan, dan CSV hanya berisi cabang admin", async ({ page }) => {
  await loginAs(page, "admin.mdn01@demo.test", /dashboard/);
  await page.goto("/sales");
  await page.getByLabel("Metode bayar").selectOption({ label: "Kartu" });
  await page.getByRole("button", { name: "Terapkan" }).click();
  await expect(page).toHaveURL(/method=CARD/);
  const rows = page.getByRole("table", { name: "Riwayat penjualan" }).getByRole("row");
  await expect(rows.nth(1)).toContainText("Kartu");

  const csv = await page.request.get("/api/sales/export?branch=lain&method=CARD");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const lines = (await csv.text()).replace(/^﻿/, "").trim().split("\r\n");
  expect(lines[0]).toBe("No. invoice;Tanggal;Jam;Cabang;Kasir;Status;Metode;Subtotal;Diskon;Pajak;Total;Alasan batal");
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.slice(1).every((l) => l.split(";")[3] === "MDN01" && l.includes("Kartu"))).toBe(true);
});

import { expect, test } from "@playwright/test";
import { login, loginAs, toast, uid } from "./helpers";

test.describe("kategori (Pemilik)", () => {
  test("tambah, ganti nama, lalu hapus kategori kosong", async ({ page }) => {
    await loginAs(page, "pemilik@demo.test", /dashboard/);
    await page.goto("/categories");
    const name = `Uji ${uid()}`;

    await page.getByRole("button", { name: "Tambah kategori" }).click();
    await expect(page.getByText("Nama kategori wajib diisi.")).toBeVisible();

    await page.getByLabel("Kategori baru").fill(name);
    await page.getByRole("button", { name: "Tambah kategori" }).click();
    await expect(toast(page, `Kategori "${name}" ditambahkan.`)).toBeVisible();
    await expect(page.getByLabel("Kategori baru")).toHaveValue("");

    await page.getByRole("button", { name: `Ganti nama kategori ${name}` }).click();
    await page.getByLabel("Nama kategori", { exact: true }).fill(`${name} baru`);
    await page.keyboard.press("Enter");
    await expect(toast(page, "Nama kategori disimpan.")).toBeVisible();

    await page.getByRole("button", { name: `Hapus kategori ${name} baru` }).click();
    await page.getByRole("button", { name: `Ya, hapus ${name} baru` }).click();
    await expect(toast(page, `Kategori "${name} baru" dihapus.`)).toBeVisible();
    await expect(page.getByText(`${name} baru`, { exact: true })).toHaveCount(0);
  });

  test("kategori yang dipakai produk tidak punya tombol hapus", async ({ page }) => {
    await loginAs(page, "pemilik@demo.test", /dashboard/);
    await page.goto("/categories");
    await expect(page.getByRole("button", { name: "Ganti nama kategori Sembako" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hapus kategori Sembako" })).toHaveCount(0);
  });
});

test.describe("produk (Pemilik)", () => {
  test("tambah produk baru lalu ubah harganya", async ({ page }) => {
    await loginAs(page, "pemilik@demo.test", /dashboard/);
    const id = uid();
    const name = `Kopi Uji ${id}`;

    await page.goto("/products/new");
    await page.getByLabel("Nama produk").fill(name);
    await page.getByLabel("SKU").fill(`UJI-${id}`);
    await page.getByLabel("Kategori").selectOption({ label: "Minuman" });
    await page.getByLabel("Harga jual").fill("12.500");
    await page.getByLabel("Harga modal").fill("10.000");
    await expect(page.getByText("Laba kotor Rp 2.500 per unit (20% dari harga jual).")).toBeVisible();
    await page.getByRole("button", { name: "Simpan produk" }).click();

    await expect(toast(page, `Produk "${name}" ditambahkan`)).toBeVisible();
    await expect(page).toHaveURL(/\/products$/);

    await page.getByLabel("Cari produk").fill(name);
    await page.keyboard.press("Enter");
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    // Produk baru langsung ada di semua cabang dengan stok 0.
    await expect(page.getByRole("link", { name: /Medan Kota.*Stok 0/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Medan Baru.*Stok 0/ })).toBeVisible();

    await page.getByLabel("Harga jual").fill("13000");
    await page.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(toast(page, "Perubahan produk disimpan.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Harga jual")).toHaveValue("13000");
  });

  test("SKU kembar, barcode salah, dan harga pecahan ditolak dengan pesan jelas", async ({ page }) => {
    await loginAs(page, "pemilik@demo.test", /dashboard/);
    await page.goto("/products/new");
    await page.getByLabel("Nama produk").fill("Produk Gagal");
    await page.getByLabel("SKU").fill("SKU-0001");
    await page.getByLabel("Barcode").fill("2000000000011");
    await page.getByLabel("Harga jual").fill("1.500,50");
    await page.getByLabel("Harga modal").fill("1000");
    await page.getByRole("button", { name: "Simpan produk" }).click();
    await expect(page.getByText(/Barcode harus 8 sampai 14 digit/)).toBeVisible();
    await expect(page.getByText(/Harga jual harus nominal Rupiah tanpa desimal/)).toBeVisible();

    await page.getByLabel("Barcode").fill("");
    await page.getByLabel("Harga jual").fill("1500");
    await page.getByRole("button", { name: "Simpan produk" }).click();
    await expect(page.getByText("SKU ini sudah dipakai.")).toBeVisible();
    await expect(page).toHaveURL(/\/products\/new$/);
  });
});

test.describe("katalog untuk Admin", () => {
  test("Admin hanya melihat katalog dan diarahkan ke stok cabangnya", async ({ page }) => {
    await loginAs(page, "admin.mdn01@demo.test", /dashboard/);
    await page.goto("/products");
    await expect(page.getByRole("link", { name: "Tambah produk" })).toHaveCount(0);
    await page.getByRole("link", { name: /Gula Pasir 1 kg/ }).click();
    await expect(page).toHaveURL(/\/stock\/.+/);
    await expect(page.getByText(/Toko Contoh Medan Kota/).first()).toBeVisible();

    await page.goto("/products/new");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/categories");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("stok cabang", () => {
  test("barang masuk, stok opname, dan harga cabang tercatat di riwayat", async ({ page }) => {
    await loginAs(page, "admin.mdn01@demo.test", /dashboard/);
    await page.goto("/stock?q=Garam");
    await page.getByRole("link", { name: "Garam Beryodium 250 g" }).click();

    const amount = page.locator("p.money.text-4xl");
    const before = Number((await amount.innerText()).replace(/\D/g, ""));

    await page.getByLabel(/Jumlah \(/).fill("10");
    await page.getByRole("button", { name: "Tambah stok" }).click();
    await expect(toast(page, `Stok bertambah 10. Sekarang ${before + 10}.`)).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Barang masuk" }).first()).toContainText("+10");

    await page.getByLabel(/Hasil hitung/).fill("5");
    await page.getByRole("button", { name: "Simpan hasil hitung" }).click();
    await expect(page.getByText("Alasan penyesuaian wajib diisi.")).toBeVisible();
    await page.getByLabel("Alasan").fill("Uji stok opname");
    await page.getByRole("button", { name: "Simpan hasil hitung" }).click();
    await expect(toast(page, /Stok disesuaikan ke 5/)).toBeVisible();
    await expect(amount).toContainText("5");
    await expect(page.getByRole("listitem").filter({ hasText: "Uji stok opname" }).first()).toBeVisible();

    await page.getByLabel("Harga khusus cabang").fill("4.500");
    await page.getByRole("button", { name: "Simpan pengaturan" }).click();
    await expect(toast(page, "Pengaturan cabang disimpan.")).toBeVisible();
    await page.getByLabel("Harga khusus cabang").fill("");
    await page.getByRole("button", { name: "Simpan pengaturan" }).click();
    await expect(toast(page, "Pengaturan cabang disimpan.")).toHaveCount(2);
  });

  test("Pemilik bisa berpindah cabang di halaman stok", async ({ page }) => {
    await loginAs(page, "pemilik@demo.test", /dashboard/);
    await page.goto("/stock");
    await expect(page.getByText(/^Toko Contoh Medan Kota:/)).toBeVisible();
    await page.getByLabel("Cabang").selectOption({ label: "Toko Contoh Medan Baru" });
    await expect(page.getByText(/^Toko Contoh Medan Baru:/)).toBeVisible();
    await expect(page).toHaveURL(/branch=/);
  });

  test("Admin yang mengganti ?branch= di URL tetap melihat cabangnya sendiri", async ({ page }) => {
    await loginAs(page, "admin.mdn02@demo.test", /dashboard/);
    await page.goto("/stock?branch=cabang-lain");
    await expect(page.getByText(/^Toko Contoh Medan Baru:/)).toBeVisible();
    await expect(page.getByLabel("Cabang")).toHaveCount(0);
  });
});

test.describe("pengguna", () => {
  test("Admin membuat kasir, kasir bisa masuk, lalu dinonaktifkan dan langsung keluar", async ({ page, browser }) => {
    await loginAs(page, "admin.mdn02@demo.test", /dashboard/);
    const id = uid();
    const email = `kasir.${id}@demo.test`;

    await page.goto("/users/new");
    await expect(page.getByLabel("Role")).toHaveCount(0); // Admin hanya bisa membuat kasir
    await page.getByLabel("Nama").fill(`Kasir Uji ${id}`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Kata sandi").fill("pendek");
    await page.getByRole("button", { name: "Buat akun" }).click();
    await expect(page.getByText("Kata sandi minimal 8 karakter.")).toBeVisible();
    await page.getByLabel("Kata sandi").fill("rahasia123");
    await page.getByLabel("PIN kasir").fill("4321");
    await page.getByRole("button", { name: "Buat akun" }).click();
    await expect(toast(page, `Akun Kasir Uji ${id} dibuat.`)).toBeVisible();
    await expect(page).toHaveURL(/\/users$/);
    await expect(page.getByRole("link", { name: new RegExp(email) })).toContainText("PIN diatur");

    // Kasir masuk di browser lain.
    const cashierCtx = await browser.newContext();
    const cashier = await cashierCtx.newPage();
    await login(cashier, email, "rahasia123");
    await expect(cashier).toHaveURL(/\/pos$/);

    // Admin menonaktifkan kasir.
    await page.getByRole("link", { name: new RegExp(email) }).click();
    await page.getByRole("checkbox", { name: /Akun aktif/ }).click();
    await page.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(toast(page, /Akun dinonaktifkan/)).toBeVisible();

    // Sesi kasir yang masih terbuka langsung berakhir, tanpa redirect loop.
    await cashier.reload();
    await expect(cashier).toHaveURL(/\/login$/);
    await login(cashier, email, "rahasia123");
    await expect(cashier.getByText("Akun ini sedang dinonaktifkan. Hubungi admin cabang.")).toBeVisible();
    await cashierCtx.close();
  });

  test("Admin tidak bisa membuka akun di cabang lain atau akunnya sendiri", async ({ page }) => {
    await loginAs(page, "admin.mdn01@demo.test", /dashboard/);
    await page.goto("/users");
    await expect(page.getByText("kasir1.mdn02@demo.test")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /admin\.mdn01@demo\.test/ })).toHaveCount(0);
    await expect(page.getByText("(Anda)")).toBeVisible();
  });

  test("Pemilik membuat admin untuk cabang tertentu", async ({ page }) => {
    await loginAs(page, "pemilik@demo.test", /dashboard/);
    const id = uid();
    await page.goto("/users/new");
    await page.getByLabel("Nama").fill(`Admin Uji ${id}`);
    await page.getByLabel("Email").fill(`admin.${id}@demo.test`);
    await page.getByLabel("Role").selectOption({ label: "Admin cabang" });
    await page.getByLabel("Cabang").selectOption({ label: "Toko Contoh Medan Baru" });
    await page.getByLabel("Kata sandi").fill("rahasia123");
    await page.getByRole("button", { name: "Buat akun" }).click();
    await expect(toast(page, `Akun Admin Uji ${id} dibuat.`)).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`admin.${id}`) })).toContainText("Admin cabang");
  });
});

test.describe("navigasi HP", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("menu dibuka, berpindah halaman, dan ditutup dengan Escape", async ({ page }) => {
    await loginAs(page, "pemilik@demo.test", /dashboard/);
    const menu = page.getByRole("button", { name: "Dashboard" });
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("link", { name: "Stok" }).click();
    await expect(page).toHaveURL(/\/stock/);
    const menu2 = page.getByRole("button", { name: "Stok" });
    await expect(menu2).toHaveAttribute("aria-expanded", "false");
    await menu2.click();
    await page.keyboard.press("Escape");
    await expect(menu2).toHaveAttribute("aria-expanded", "false");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBe(0);
  });
});

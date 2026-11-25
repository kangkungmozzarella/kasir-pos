import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "demo12345";

async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

test.describe("login per role", () => {
  test("pemilik masuk ke dashboard semua cabang", async ({ page }) => {
    await login(page, "pemilik@demo.test");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Semua cabang" })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: /Medan Kota/ })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: /Medan Baru/ })).toBeVisible();
  });

  test("admin hanya melihat cabangnya sendiri", async ({ page }) => {
    await login(page, "admin.mdn02@demo.test");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Toko Contoh Medan Baru" })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: /Medan Kota/ })).toHaveCount(0);
  });

  test("kasir masuk ke layar kasir dan tidak bisa membuka dashboard", async ({ page }) => {
    await login(page, "kasir1.mdn01@demo.test");
    await expect(page).toHaveURL(/\/pos$/);
    await expect(page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("link")).toHaveText(["Kasir"]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/pos$/);
  });
});

test("kata sandi salah menampilkan pesan yang jelas", async ({ page }) => {
  await login(page, "pemilik@demo.test", "salah");
  await expect(page.getByRole("alert").filter({ hasText: "Email atau kata sandi salah." })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("validasi email kosong", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByText("Format email belum benar.")).toBeVisible();
  await expect(page.getByText("Kata sandi wajib diisi.")).toBeVisible();
});

test("tombol Isi mengisi formulir dengan akun demo", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Isi formulir dengan akun Admin cabang Medan Kota/ }).click();
  await expect(page.getByLabel("Email")).toHaveValue("admin.mdn01@demo.test");
  await expect(page.getByLabel("Kata sandi")).toHaveValue(PASSWORD);
  await expect(page.getByLabel("Kata sandi")).toBeFocused();
});

test("halaman terlindungi mengarah ke login, dan keluar menghapus sesi", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);

  await login(page, "pemilik@demo.test");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("toggle tema mengganti mode terang dan gelap", async ({ page }) => {
  await page.goto("/login");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Ganti tema terang atau gelap" }).click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Ganti tema terang atau gelap" }).click();
  await expect(html).not.toHaveClass(/dark/);
});

test("formulir login bisa dipakai hanya dengan keyboard", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.type("kasir1.mdn02@demo.test");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Kata sandi")).toBeFocused();
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/pos$/);
});

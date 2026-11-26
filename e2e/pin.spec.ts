import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("ganti kasir dengan PIN: hanya akun cabang sendiri, salah memberi sisa percobaan, benar mengganti akun", async ({ page }) => {
  await loginAs(page, "kasir1.mdn02@demo.test", /\/pos$/);
  await expect(page.getByText("Kasir 1 Medan Baru", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Ganti kasir" }).click();
  const dialog = page.getByRole("dialog", { name: "Ganti kasir" });
  // Hanya akun cabang yang sama (Medan Baru) yang bisa dipilih di perangkat ini.
  await expect(dialog.getByRole("radio", { name: /Medan Kota/ })).toHaveCount(0);
  await dialog.getByRole("radio", { name: /Kasir 2 Medan Baru/ }).check();
  await expect(dialog.getByLabel("PIN")).toBeFocused();
  await page.keyboard.type("9999");
  await dialog.getByRole("button", { name: "Masuk sebagai Kasir 2 Medan Baru" }).click();
  await expect(dialog.getByText(/^PIN salah\. Sisa \d percobaan sebelum dikunci 5 menit\.$/)).toBeVisible();
  await expect(dialog.getByLabel("PIN")).toHaveValue("");

  await page.keyboard.type("2222");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByText("Kasir 2 Medan Baru", { exact: true })).toBeVisible();
  await expect(page.getByText("Kasir 1 Medan Baru", { exact: true })).toHaveCount(0);
});

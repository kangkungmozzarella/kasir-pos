import { expect, type Page } from "@playwright/test";

export const PASSWORD = "demo12345";

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

export async function loginAs(page: Page, email: string, expectedPath: RegExp) {
  await login(page, email);
  await expect(page).toHaveURL(expectedPath);
}

/** Akhiran unik supaya test bisa diulang tanpa reset database. */
export const uid = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

export function toast(page: Page, text: string | RegExp) {
  return page.locator("[data-sonner-toast]").filter({ hasText: text });
}

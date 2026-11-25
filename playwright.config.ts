import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } }],
  webServer: {
    // Uji build produksi, bukan dev server, supaya perilaku sama dengan deploy.
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    // Terminal EDC simulasi dipercepat supaya test kartu tidak menunggu 2 sampai 4 detik.
    env: { MOCK_TERMINAL_DELAY_MS: "300" },
    timeout: 180_000,
  },
});

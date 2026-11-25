import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://kasir:kasir@localhost:5433/kasir_pos_test";
process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.int.test.ts"],
    environment: "node",
    globalSetup: "./test/integration-setup.ts",
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      MOCK_WEBHOOK_SECRET: "rahasia-integration-test-cukup-panjang",
      MOCK_TERMINAL_DELAY_MS: "0",
    },
  },
});

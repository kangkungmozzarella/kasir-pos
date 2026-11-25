import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    // Integration test (butuh database) dijalankan terpisah: pnpm test:integration
    exclude: ["**/*.int.test.ts", "**/node_modules/**"],
    environment: "node",
  },
});

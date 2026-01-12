import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    name: "api",
    root: __dirname,
    globals: true,
    environment: "node",
    include: ["lib/__tests__/api/**/*.test.ts"],
    // Longer timeout for API tests
    testTimeout: 30000,
    // Run API tests sequentially to avoid race conditions
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    // Setup file for global hooks
    setupFiles: ["./lib/__tests__/api/vitest-setup.ts"],
  },
});

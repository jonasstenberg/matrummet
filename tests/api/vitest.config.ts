import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "api",
    root: __dirname,
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    // Longer timeout for API tests
    testTimeout: 30000,
    // Run API tests sequentially to avoid race conditions
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    // Setup file for global hooks
    setupFiles: ["./vitest-setup.ts"],
  },
});

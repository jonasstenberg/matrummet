import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "email-service",
    root: __dirname,
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.ts"],
  },
});

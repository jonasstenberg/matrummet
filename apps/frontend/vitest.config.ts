import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    name: "frontend",
    root: __dirname,
    globals: true,
    environment: "jsdom",
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    exclude: ["node_modules/**"],
    setupFiles: ["@recept/testing/setup/jsdom"],
  },
});

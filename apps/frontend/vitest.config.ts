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
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});

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
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx", "app/**/*.test.ts"],
    exclude: ["node_modules/**"],
    setupFiles: ["@matrummet/testing/setup/jsdom"],
    server: {
      deps: {
        inline: [/@matrummet\//],
      },
    },
  },
});

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "~": path.resolve(__dirname, "."),
    },
  },
  test: {
    name: "web",
    root: __dirname,
    globals: true,
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    exclude: ["node_modules/**"],
    setupFiles: ["@matrummet/testing/setup/jsdom"],
    server: {
      deps: {
        inline: [/@matrummet\//],
      },
    },
  },
});

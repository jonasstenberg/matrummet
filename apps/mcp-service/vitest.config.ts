import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "mcp-service",
    root: __dirname,
    globals: true,
    environment: "node",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.ts"],
    server: {
      deps: {
        inline: [/@matrummet\//],
      },
    },
  },
});

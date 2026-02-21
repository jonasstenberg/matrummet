import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "apps/frontend/vitest.config.ts",
      "apps/web/vitest.config.ts",
      "apps/email-service/vitest.config.ts",
    ],
  },
});

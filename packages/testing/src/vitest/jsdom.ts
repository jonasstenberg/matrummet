import { defineConfig } from "vitest/config";

export interface JsdomTestConfigOptions {
  setupFiles?: string[];
  include?: string[];
  exclude?: string[];
  coverage?: boolean;
  testTimeout?: number;
}

export function createJsdomTestConfig(options: JsdomTestConfigOptions = {}) {
  const {
    setupFiles = [],
    include = ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.spec.ts", "src/**/*.spec.tsx"],
    exclude = ["node_modules", "dist"],
    coverage = false,
    testTimeout = 10000,
  } = options;

  const config = defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      include,
      exclude,
      testTimeout,
      setupFiles: [...setupFiles],
    },
  });

  if (coverage && config.test) {
    config.test.coverage = {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    };
  }

  return config;
}

export default createJsdomTestConfig;

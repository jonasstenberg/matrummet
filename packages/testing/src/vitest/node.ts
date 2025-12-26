import { defineConfig } from "vitest/config";

export interface NodeTestConfigOptions {
  setupFiles?: string[];
  include?: string[];
  exclude?: string[];
  coverage?: boolean;
  testTimeout?: number;
}

export function createNodeTestConfig(options: NodeTestConfigOptions = {}) {
  const {
    setupFiles = [],
    include = ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude = ["node_modules", "dist"],
    coverage = false,
    testTimeout = 10000,
  } = options;

  const config = defineConfig({
    test: {
      environment: "node",
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
      exclude: ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"],
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

export default createNodeTestConfig;

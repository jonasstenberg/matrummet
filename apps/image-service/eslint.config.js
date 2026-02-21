import { backend } from "@matrummet/eslint";

export default [
  ...backend(),
  {
    ignores: ["vitest.config.ts"],
  },
];

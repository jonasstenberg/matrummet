import { backend } from "@recept/eslint";
export default [
  ...backend(),
  {
    ignores: ["vitest.config.ts"],
  },
];

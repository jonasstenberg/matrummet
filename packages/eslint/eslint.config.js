import js from "@eslint/js";
import importsPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export const createConfig = (options = {}) => {
  const { tsconfigPath = "./tsconfig.json" } = options;

  const base = [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...tseslint.configs.strict,
    { ignores: ["dist", "vitest.config.ts"] },
    {
      files: ["**/*.{ts,tsx}"],
      languageOptions: {
        ecmaVersion: 2020,
        parserOptions: {
          project: [tsconfigPath],
          tsconfigRootDir: process.cwd(),
        },
      },
      plugins: {
        typescript: tseslint,
        import: importsPlugin,
      },
      rules: {
        "@typescript-eslint/no-unsafe-argument": "error",
        "@typescript-eslint/no-unsafe-assignment": "error",
        "@typescript-eslint/no-unsafe-call": "error",
        "@typescript-eslint/no-unsafe-member-access": "error",
        "@typescript-eslint/no-unsafe-return": "error",
        "@typescript-eslint/no-unnecessary-condition": "error",
        "@typescript-eslint/no-misused-promises": "error",
      },
    },
  ];

  return { base };
};

export const frontend = (options = {}) => {
  const { base } = createConfig(options);

  return [
    ...base,
    {
      languageOptions: {
        globals: globals.browser,
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      plugins: {
        "react-hooks": reactHooks,
        "react-refresh": reactRefresh,
      },
      rules: {
        ...reactHooks.configs.recommended.rules,
        "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      },
    },
  ];
};

export const backend = (options = {}) => {
  const { base } = createConfig(options);

  return [
    ...base,
    {
      languageOptions: {
        globals: globals.node,
        ecmaVersion: 2022,
      },
      rules: {},
    },
  ];
};

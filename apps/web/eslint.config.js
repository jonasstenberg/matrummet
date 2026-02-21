import { frontend } from '@matrummet/eslint'

export default [
  ...frontend(),
  {
    ignores: ['src/routeTree.gen.ts', '.output/**', 'dist/**'],
  },
  {
    // Relax strict type-safety rules to match the original Next.js codebase.
    // The code was written against eslint-config-next which doesn't enforce these.
    // TODO: Gradually re-enable and fix these for better type safety.
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
]

import { frontend } from '@matrummet/eslint'

export default [
  ...frontend(),
  {
    languageOptions: {
      globals: {
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
  {
    ignores: ['.expo/', 'node_modules/', 'babel.config.js', 'metro.config.js'],
  },
]

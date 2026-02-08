# @matrummet/eslint

Shared ESLint config for matrummet monorepo (frontend & backend).

## Usage

### 1. Install dependencies

Make sure you have `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, and (for frontend) `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals` installed in your project.

### 2. Use in your app (flat config, ESM)

#### Frontend (React):

```js
// eslint.config.js
import { frontend } from '@matrummet/eslint';

// Use default configuration
export default frontend();

// Or with custom tsconfig path
export default frontend({ tsconfigPath: './tsconfig.app.json' });
```

#### Backend (Node):

```js
// eslint.config.js
import { backend } from '@matrummet/eslint';

// Use default configuration
export default backend();

// Or with custom tsconfig path
export default backend({ tsconfigPath: './tsconfig.build.json' });
```

### 3. Migrate from old config

- Remove old `.eslintrc` or `eslint.config.js` and replace with the above.
- Adjust `tsconfig` paths if needed.

---

- The `createConfig` function is for advanced use if you want to further customize.
- Update or extend rules as needed per project.

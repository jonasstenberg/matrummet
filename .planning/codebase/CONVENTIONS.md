# Coding Conventions

**Analysis Date:** 2026-01-27

## Naming Patterns

**Files:**
- Lowercase with hyphens: `header.tsx`, `recipe-import.ts`, `image-downloader.ts`
- React components: PascalCase component exports with matching filename: `HeaderNav.tsx` exports `HeaderNav`
- Test files use `__tests__` directory adjacent to source: `components/__tests__/instruction-editor.test.tsx`
- Server actions: `actions.ts` for page directory
- Utility modules: descriptive names like `utils.ts`, `api.ts`, `paths.ts`

**Functions:**
- camelCase for all functions: `downloadImage()`, `getImageUrl()`, `renderTemplate()`
- Exported functions: `export async function createRecipe()`, `export function cn()`
- Private helpers: start with underscore or remain unexported
- Boolean predicates: `is*` or `should*` prefix: `isAdmin()`, `shouldRender()`

**Variables:**
- camelCase: `imageUrl`, `userMenuOpen`, `mockPool`, `responseData`
- Constants: UPPERCASE_WITH_UNDERSCORES: `MAX_IMAGE_SIZE`, `COOKIE_NAME`, `EMAIL_BATCH_SIZE`, `POSTGREST_URL`
- Private module variables: lowercase: `jwtSecret`, `postgrestJwtSecret`
- State variables: camelCase: `userMenuOpen`, `retryCount`

**Types:**
- PascalCase for interfaces and types: `JWTPayload`, `TransactionalMessage`, `EmailTemplate`, `DownloadResult`
- `type` for type aliases: `type SendEmailFn = ...`
- `interface` for object contracts: `interface DbPool`, `interface QueueLogger`
- Generic function types: `QueryResult<T>`, `DbPool`

**Exports:**
- Named exports: `export function`, `export interface`, `export type`
- Barrel files: index.ts files re-export from sibling modules
- Path aliases via `@`: `@/lib/utils`, `@/components/ui/button`

## Code Style

**Formatting:**
- No explicit Prettier config detected in root; uses eslint-config-next defaults
- Single quotes in JavaScript/TypeScript: `'value'` not `"value"`
- Semicolons required at end of statements
- Arrow functions preferred: `const fn = () => {}`

**Linting:**
- ESLint with strict TypeScript rules enforced
- Configuration: `@recept/eslint` package with `frontend()` and `backend()` configs
- Strict mode enabled: `@typescript-eslint/strict` config applied
- Files: `apps/frontend/eslint.config.mjs`, `apps/email-service/eslint.config.js`

**Key ESLint Rules:**
- `@typescript-eslint/no-unsafe-*`: All unsafe operations flagged (argument, assignment, call, member-access, return)
- `@typescript-eslint/no-unnecessary-condition`: No redundant conditionals
- `@typescript-eslint/no-misused-promises`: Promises used correctly in async contexts
- React hooks: `react-hooks/exhaustive-deps` enforced
- React refresh: `react-refresh/only-export-components` warns on non-component exports from component files

## Import Organization

**Order:**
1. External packages (Node.js first): `import { join } from 'path'`
2. External libraries: `import { SignJWT } from 'jose'`, `import { describe, it } from 'vitest'`
3. Internal app imports (using `@`): `import { cn } from '@/lib/utils'`
4. Relative imports (for same-package): `import { config } from '../config.js'`
5. Type-only imports: `import type { ImageSize } from './image-processing'`

**Pattern Examples:**
```typescript
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getDataFilesDir } from '@/lib/paths'
import { generateImageVariants } from '@/lib/image-processing'
```

**Path Aliases:**
- `@/` maps to app root or current package root
- Used consistently: `@/lib/...`, `@/components/...`, `@/lib/recipe-import/...`

## Error Handling

**Patterns:**
- Try-catch blocks for async operations: used in `auth.ts`, `image-downloader.ts`
- Explicit error throwing: `throw new Error('message')`
- Error validation: detailed error messages with context
  ```typescript
  throw new Error(`Invalid ingredient "${i.name}" in ${context}: quantity must be a string`)
  ```
- Return objects with error field: `{ success: false, error: 'message' }` in some modules
- Promise rejection: explicit throws, no silent failures

**Error Messages:**
- Descriptive, include context: "Invalid URL protocol", "Template not found: nonexistent"
- Validation errors include the invalid value/field: `"Invalid response: Expected JSON object"`

## Logging

**Framework:** No centralized logging in frontend; backend uses object-based logger interface

**Backend Pattern (email-service):**
```typescript
interface QueueLogger {
  info: (obj: Record<string, unknown>, msg: string) => void
}
```
- Called as: `logger.info({ to: 'user@example.com' }, 'Sent email')`
- Context object first, message second

**Frontend:** No logging framework visible; relies on console when needed

## Comments

**When to Comment:**
- JSDoc for exported functions and interfaces: describe purpose, parameters, returns
- Inline comments for non-obvious logic: "Skip if it's a URL (external image)"
- Complex algorithms: explain the "why" not the "what"
- Avoid obvious comments: `// increment counter` is unnecessary

**JSDoc/TSDoc:**
- Used on public API functions and types
- Format: `/** description */`
  ```typescript
  /**
   * Get the URL for a recipe image at a specific size.
   * Images are served via /api/images/{id}/{size}
   */
  export function getImageUrl(image: string | null | undefined, size: ImageSize = 'full'): string | null
  ```
- Include parameter and return descriptions for complex functions
- Parameter validation shown in comments when relevant

**Code Comment Examples:**
```typescript
// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Validate the frontend token and extract the email
// Create a PostgREST-specific token with role: 'anon'
// Map the input to match PostgREST function parameters
```

## Function Design

**Size:**
- Prefer small, focused functions (most under 30 lines)
- Larger utility functions can be 50+ lines if they handle one concern
- Example: `downloadImage()` in `image-downloader.ts` is ~80 lines for complete download-validate-resize workflow

**Parameters:**
- Explicit parameters for main inputs
- Options objects for optional/configuration parameters: rarely used, prefer explicit params
- Database functions use typed generics: `pool.query<T>(sql, values)`

**Return Values:**
- Typed return values: `Promise<Template | undefined>`, `Result<string | null>`
- Success/failure objects: `{ success: boolean, filename?: string, error?: string }`
- Async functions return Promises with clear types
- No implicit `undefined` returns; explicitly return `null` or throw

## Module Design

**Exports:**
- Prefer named exports: `export function`, `export interface`
- One main export per file unless closely related (utility functions may have multiple)
- Public API functions exported at module level
- Private helpers not exported

**Barrel Files:**
- Found in `packages/testing/src/index.ts` and similar re-export patterns
- Used to simplify imports: `import { vitest } from '@recept/testing'`
- Not heavily used; prefer direct imports in most cases

**Example Barrel Pattern (packages/testing/src/index.ts):**
```typescript
export * from './setup/jsdom';
export * from './setup/node';
export * from './mocks';
```

## React-Specific Conventions

**Component Structure:**
- Functional components with hooks
- Server components by default in Next.js app directory (no `"use client"`)
- Client components marked explicitly: `"use client"` at top
- Props passed as typed interface or direct parameters

**Hooks:**
- `useState` for local state: `const [userMenuOpen, setUserMenuOpen] = useState(false)`
- `useEffect` for side effects with cleanup: event listeners unsubscribed
- `useRef` for DOM references: `const userMenuRef = useRef<HTMLDivElement>(null)`
- Custom hooks extracted to separate files when reused

**Dynamic Imports:**
- Used for code splitting and SSR avoidance
  ```typescript
  const MobileMenu = dynamic(() => import('./mobile-menu').then((m) => m.MobileMenu), {
    ssr: false,
    loading: () => <LoadingComponent />
  })
  ```

---

*Convention analysis: 2026-01-27*

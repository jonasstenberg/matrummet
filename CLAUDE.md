# CLAUDE.md

## What

Matrummet is a Swedish recipe management app. Monorepo with:

- `apps/web` — TanStack Start (Vite + Nitro SSR), React 19, Tailwind v4, Radix UI
- `apps/mobile` — React Native/Expo mobile app (shared API client)
- `apps/email-service` — Email notifications
- `apps/events-service` — Event processing
- `packages/types` — Shared TypeScript types and Zod schemas
- `packages/api-client` — Shared PostgREST client, auth (pure JS JWT via @noble/hashes)
- `packages/` — Shared configs (eslint, tsconfig, testing)
- PostgreSQL database with PostgREST REST API layer

## Why

Personal recipe collection with Swedish full-text search, JWT auth, and row-level security (RLS) ensuring users only modify their own data.

## How

### Quick Commands

```bash
pnpm dev                    # Start all apps
./start-postgrest.sh        # Start PostgREST API on port 4444
./start-nginx.sh            # Start nginx image server on port 4446
./flyway/run-flyway.sh info # Check migration status
./flyway/run-flyway.sh migrate  # Apply migrations (auto-backup)
```

### Local Services

| Service | Command | Port | Purpose |
|---------|---------|------|---------|
| TanStack Start | `pnpm dev` | 3000 | Frontend + email service |
| PostgREST | `./start-postgrest.sh` | 4444 | REST API layer |
| Nginx images | `./start-nginx.sh` | 4446 | Serves `/uploads/{id}/{size}.webp` |

Nginx mirrors production config — serves recipe images from `apps/web/public/uploads/`. Config: `nginx/dev.conf`, runtime conf generated to `/tmp/matrummet-nginx-dev.conf`.

### Build/Lint/Test (use check:* commands)

Always use the `check:*` commands for build, lint, and test. They minimize output on success (`✓ Lint`) and show full errors on failure, saving context tokens:

```bash
pnpm check                  # Lint + test (recommended after changes)
pnpm check:build            # Build all apps
pnpm check:lint             # Lint all packages
pnpm check:test             # Run unit tests
pnpm check:api              # Run API integration tests
```

Do NOT use raw `pnpm build`, `pnpm lint`, or `pnpm test` — their verbose output wastes context.

### API Integration Tests

Requires Docker test environment (PG on 5433, PostgREST on 4445):

```bash
docker-compose -f docker-compose.test.yml up -d  # Start test PG + PostgREST
pnpm test:api                                     # Run API contract tests
docker-compose -f docker-compose.test.yml down     # Teardown
```

After schema changes, recreate to pick up new migrations:
`docker-compose -f docker-compose.test.yml down -v && docker-compose -f docker-compose.test.yml up -d`

### Database

Migrations: `flyway/sql/V{version}__{description}.sql`
Seed data: `data/data.sql`
Backups: `flyway/run-flyway.sh backup|restore|list-backups`

### Infrastructure (`infra/`)

Production configs are version-controlled in `infra/` and deployed via CI.

**Nginx** (`infra/nginx/`) — auto-deployed when files change:

| File | Deploys to | Purpose |
|------|-----------|---------|
| `production.conf` | `/etc/nginx/sites-enabled/recept` | Main site (matrummet.se), 301 redirect from mat.stenberg.io |
| `shared-locations.conf` | `/etc/nginx/snippets/matrummet-locations.conf` | Shared location blocks (included by production.conf) |
| `api.conf` | `/etc/nginx/sites-enabled/api.matrummet.se` | Public PostgREST API with CORS |
| `proxy-cache.conf` | `/etc/nginx/conf.d/proxy-cache.conf` | Cache zone for static assets/images |

**PostgREST** (`infra/postgrest/`) — auto-deployed when files change, secrets via `envsubst`:

| File | Deploys to | Purpose |
|------|-----------|---------|
| `matrummet.conf` | `/etc/postgrest/matrummet.conf` | Connection, auth, pool settings (`${POSTGREST_DB_PASSWORD}`, `${POSTGREST_JWT_SECRET}`) |

**Systemd** (`infra/systemd/`) — reference copies, not auto-deployed:

| Service | Runtime | Purpose |
|---------|---------|---------|
| `matrummet.service` | Node.js | TanStack Start app (port 3001) |
| `matrummet-email.service` | Bun | Email notifications |
| `matrummet-events.service` | Bun | Event processing |
| `matrummet-image.service` | Bun | Image service |
| `postgrest-matrummet.service` | PostgREST | REST API (port 4444) |
| `backup-matrummet.service/.timer` | pg_dump | DB + photos backup every 4h (30-day retention) |
| `backup-matrummet-weekly.service/.timer` | pg_dump | Weekly DB backup Sundays 03:00 (6-month retention) |

Env files on server: `.matrummet.env`, `.email-service.env`, `.events-service.env`, `.image-service.env`, `.backup.env`.

## Architecture

### Separation of Concerns

Business logic lives in `lib/`, API routes are thin HTTP handlers.

**Server functions** (`lib/*-actions.ts`) use `createServerFn()`:
- Get PostgREST tokens via middleware (`actionAuthMiddleware`)
- Call business logic in lib
- Invalidate router cache via `router.invalidate()`
- Return `{ success, data }` or `{ error }` objects

**API routes** (`src/routes/api/**/*.ts`) handle only:
- Auth via route-level middleware (`apiAuthMiddleware`, `apiAdminMiddleware`)
- Request parsing
- Calling lib functions
- Formatting HTTP responses

**Pure lib modules** contain reusable business logic:
- `lib/auth-operations.ts` — Login, signup, password reset, account deletion (PostgREST + JWT)
- `lib/credits.ts` — Check/deduct/refund AI credits
- `lib/ingredient-matching.ts` — Match ingredients to food/unit database
- `lib/substitutions.ts` — AI ingredient substitution suggestions
- `lib/recipe-refinement.ts` — AI recipe refinement with Zod validation
- `lib/meal-plan/service.ts` — Meal plan generation, validation, enrichment, saving
- `lib/ai-review/food-normalization.ts` — AI food name normalization and review suggestions

### Environment Variables

`lib/env.ts` exports a lazy-validated `env` object with getters. Use `env.POSTGREST_URL`, `env.JWT_SECRET`, etc. — never `process.env.*` directly.

### Cookie Handling

Cookies via `setCookie()` / `deleteCookie()` from `@tanstack/react-start/server`.
`COOKIE_NAME` constant exported from `lib/cookie-utils.ts`.

### PostgREST Helpers

- `lib/action-utils.ts` — `postgrestHeaders(token, homeId?)`, `getCurrentUserEmail()`
- `lib/postgrest-helpers.ts` (pure) — `isDuplicateKeyError(errorText)`, `parsePostgrestError(errorText)`

### Auth

- `lib/auth.ts` — JWT signing/verification (`signToken`, `verifyToken`, `signPostgrestToken`, `getSession`)
- `lib/auth-operations.ts` — Pure auth business logic (`performLogin`, `performSignup`, `performChangePassword`, `performDeleteAccount`, `performRequestPasswordReset`)
- `lib/auth-actions.ts` — Server functions wrapping auth-operations + cookie manipulation
- `lib/middleware.ts` — Auth middleware (`authMiddleware`, `actionAuthMiddleware`, `apiAuthMiddleware`, `apiAdminMiddleware`)

### AI Integration

Uses Mistral AI via `@mistralai/mistralai`:
- `lib/ai-client.ts` — `createMistralClient()` factory, `MISTRAL_MODEL` constant (`mistral-medium-latest`)
- Pattern: `client.chat.complete()` with `responseFormat: { type: 'json_schema', jsonSchema: { name, schemaDefinition, strict: true } }`
- Zod v4: Use `toJSONSchema()` for schema definitions. Do NOT use `chat.parse()` (incompatible with Zod v4)
- Schemas defined as Zod schemas + exported `*_JSON_SCHEMA` constants

**AI-powered features:**
| Feature | Lib | API Route |
|---------|-----|-----------|
| Recipe generation (text + image) | `lib/recipe-parser/` | `src/routes/api/ai/generate.ts` |
| Meal plan generation | `lib/meal-plan/service.ts` | `src/routes/api/ai/meal-plan.ts` |
| Recipe refinement | `lib/recipe-refinement.ts` | `src/routes/api/admin/ai/refine.ts` |
| Ingredient restructuring | `lib/ingredient-restructure/` | `src/routes/api/admin/restructure/*.ts` |
| Ingredient substitutions | `lib/substitutions.ts` | `src/routes/api/substitutions.ts` |
| Food name AI review | `lib/ai-review/food-normalization.ts` | `src/routes/api/admin/ai-review/stream.ts`, `src/routes/api/admin/foods/ai-review.ts` |
| Recipe import from URL | `lib/recipe-import/` | `src/routes/api/recipes/import.ts` |

### Credit System

AI features cost credits (1 point each). Managed via `lib/credits.ts`:
- `checkCredits(token)` — Verify balance
- `deductCredit(token, description)` — Atomic deduction
- `refundCredit(email, description)` — Refund on failure
- Credits purchased via Stripe (`lib/stripe.ts`, `app/api/credits/*/route.ts`)

### Key Patterns

**RLS**: All tables use JWT email claim (`request.jwt.claims->>'email'`) for ownership. SELECT is public, INSERT/UPDATE/DELETE is owner-only.

**Atomic Operations**: Use `insert_recipe()` / `update_recipe()` functions — they handle categories, ingredients, and instructions together.

**Full-text Search**: Swedish text search via `recipes_and_categories` view's `full_tsv` column.

**Households**: Users can share recipe books and shopping lists within a household. `homeId` is passed via `X-Active-Home-Id` header (handled by `postgrestHeaders()`).

### Schema Overview

- `users` / `user_passwords` — Auth with bcrypt trigger
- `recipes` — Core data with `tsv` search vector
- `ingredients` — Measurements and quantities
- `instructions` — Recipe steps
- `categories` — Many-to-many via `recipe_categories`
- `category_groups` — 7 predefined groups for organizing categories
- `foods` / `units` — Canonical food and unit databases
- `ai_review_runs` / `ai_review_suggestions` — AI food review system
- `shopping_lists` / `shopping_list_items` — Shopping list management
- `meal_plans` / `meal_plan_entries` — Weekly meal planning
- `homes` / `home_members` — Household management
- `book_share_tokens` / `book_share_connections` — Recipe book sharing
- `user_credits` / `credit_transactions` — AI credit system

### Auth Functions (SQL)

`login()`, `signup()`, `signup_provider()`, `reset_password()`

### Mobile App

Expo/React Native app in `apps/mobile/`. Uses shared packages:
- `@matrummet/types` for types/schemas, `@matrummet/api-client` for PostgREST client + auth
- Auth uses pure JS JWT (HMAC-SHA256 via `@noble/hashes`) — no `crypto.subtle` needed for Hermes
- Images via `EXPO_PUBLIC_IMAGE_BASE_URL` (local: `http://localhost:4446/uploads`, prod: nginx)
- Dev: `cd apps/mobile && npx expo run:ios` (not `expo start` — needs dev build for native modules)
- Metro config: `unstable_enablePackageExports = true` required for `@noble/hashes` subpath imports

## apps/web — TanStack Start

### Stack & Entry Points

- **Framework**: TanStack Start (`@tanstack/react-start`) + TanStack Router (`@tanstack/react-router`)
- **Bundler**: Vite with `tanstackStart()` plugin (must come before `viteReact()`)
- **SSR**: Nitro — `src/ssr.tsx` → `createStartHandler(defaultStreamHandler)`
- **Client**: `src/client.tsx` → `hydrateRoot(document, <StartClient />)`
- **Router**: `src/router.tsx` → `getRouter()` with type registration via `declare module`
- **Dev port**: 3000 (production runs Nitro build on 3001)

### Routing (File-based)

Routes in `src/routes/`. Key conventions:
- `__root.tsx` — Root layout (`<html>`, `<HeadContent />`, `<Scripts />`)
- `_auth.tsx` / `_main.tsx` — Layout groups (pathless, wrap child routes)
- `$id/index.tsx` — Dynamic segments
- `api/**/*.ts` — Server route handlers (HTTP endpoints)

**Route configuration:**
```ts
export const Route = createFileRoute('/_main/')({
  validateSearch: zodSchema,           // Search param validation
  loaderDeps: ({ search }) => ({...}), // Deps that trigger refetch
  loader: ({ deps }) => serverFn({ data: deps }),
  head: ({ loaderData }) => ({ meta: [...] }),  // SEO/meta per route
  component: MyPage,
})
```

### Server Functions

```ts
const myFn = createServerFn({ method: 'POST' })
  .inputValidator(zodSchema)
  .middleware([actionAuthMiddleware])
  .handler(async ({ data, context }) => { ... })
```

- Defined in `lib/*-actions.ts`
- Use `createMiddleware({ type: 'function' }).server(...)` for server function middleware
- Middleware types: `authMiddleware` (throws redirect), `actionAuthMiddleware` (returns error objects)
- Auth helpers: `checkAuth()` / `checkAdminAuth()` for `beforeLoad`

### API Routes (HTTP handlers)

```ts
export const Route = createFileRoute('/api/my-endpoint')({
  server: {
    middleware: [apiAdminMiddleware],  // Route-level auth
    handlers: {
      GET: async ({ request, context }) => {
        const { postgrestToken } = context
        return Response.json({ ... })
      },
    },
  },
})
```

- Use `server.middleware` for shared auth across all handlers
- Cookies via `setCookie()` / `deleteCookie()` from `@tanstack/react-start/server`
- Middleware in `lib/middleware.ts`: `apiAuthMiddleware`, `apiAdminMiddleware`

## Server Functions Reference (apps/web)

| File | Purpose |
|------|---------|
| `lib/auth-actions.ts` | Login, signup, password reset, account deletion |
| `lib/recipe-actions.ts` | CRUD, copy, like, share, import recipes |
| `lib/admin-actions.ts` | Food/user management (admin-only) |
| `lib/shopping-list-actions.ts` | Shopping list CRUD, add/toggle/clear items |
| `lib/meal-plan-actions.ts` | List/get/swap meal plans, save to shopping list |
| `lib/home-actions.ts` | Household CRUD, member management |
| `lib/book-share-actions.ts` | Recipe book sharing (create link, accept, revoke) |
| `lib/settings-actions.ts` | Profile updates, API key management |
| `lib/ingredient-search-actions.ts` | Food/unit search, substitution suggestions |
| `lib/credits-actions.ts` | Credit balance, transaction history |

## User Story Workflow

User stories live in `user-stories/*.md`. Three skills work together:

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `/story-to-ship` | "new user story", "As a user I want..." | Create story → implement → validate |
| `/ship-it` | "ship it", "full pipeline" | 8-phase implementation with acceptance test |
| `/run-user-stories` | "run user stories US-AUTH-01" | Run browser acceptance tests |

### Full Pipeline Example

```
/story-to-ship As a user I want to filter recipes by cooking time
```

This will:
1. Parse feature → confirm area (RECIPE), user type, action
2. Generate `US-RECIPE-XX` with test steps and acceptance criteria
3. Append to `user-stories/02-recipe-management.md`
4. Invoke `ship-it` to implement (explore → plan → code → review → commit)
5. Run acceptance test via Playwright to validate

### Story Areas

| Area | File | Examples |
|------|------|----------|
| AUTH | 01-authentication.md | Login, register, OAuth |
| RECIPE | 02-recipe-management.md | CRUD, copy, like |
| SEARCH | 03-recipe-search.md | Search, filter, browse |
| SHARE | 04-recipe-sharing.md | Share links |
| PANTRY | 05-pantry-management.md | Pantry CRUD |
| SHOP | 06-shopping-list.md | Shopping lists |
| HOME | 07-household.md | Household management |
| IMPORT | 08-recipe-import.md | URL import, AI parsing |

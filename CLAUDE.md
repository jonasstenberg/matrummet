# CLAUDE.md

## What

Matrummet is a Swedish recipe management app. Monorepo with:

- `apps/frontend` — Next.js 16, React 19, Tailwind v4, Radix UI
- `apps/mobile` — React Native/Expo mobile app (shared API client)
- `apps/email-service` — Email notifications
- `packages/types` — Shared TypeScript types and Zod schemas
- `packages/api-client` — Shared PostgREST client, auth (pure JS JWT via @noble/hashes)
- `packages/` — Shared configs (eslint, tsconfig, testing)
- PostgreSQL database with PostgREST REST API layer

## Why

Personal recipe collection with Swedish full-text search, JWT auth, and row-level security (RLS) ensuring users only modify their own data.

## How

### Quick Commands

```bash
pnpm dev                    # Start all apps (frontend uses Turbopack)
./start-postgrest.sh        # Start PostgREST API on port 4444
./start-nginx.sh            # Start nginx image server on port 4446
./flyway/run-flyway.sh info # Check migration status
./flyway/run-flyway.sh migrate  # Apply migrations (auto-backup)
```

### Local Services

| Service | Command | Port | Purpose |
|---------|---------|------|---------|
| Next.js | `pnpm dev` | 3000 | Frontend + email service (Turbopack) |
| PostgREST | `./start-postgrest.sh` | 4444 | REST API layer |
| Nginx images | `./start-nginx.sh` | 4446 | Serves `/uploads/{id}/{size}.webp` |

Nginx mirrors production config — serves recipe images from `apps/frontend/public/uploads/`. Config: `nginx/dev.conf`, runtime conf generated to `/tmp/matrummet-nginx-dev.conf`.

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

### Key Patterns

**RLS**: All tables use JWT email claim (`request.jwt.claims->>'email'`) for ownership. SELECT is public, INSERT/UPDATE/DELETE is owner-only.

**Atomic Operations**: Use `insert_recipe()` / `update_recipe()` functions — they handle categories, ingredients, and instructions together.

**Full-text Search**: Swedish text search via `recipes_and_categories` view's `full_tsv` column.

### Schema Overview

- `users` / `user_passwords` — Auth with bcrypt trigger
- `recipes` — Core data with `tsv` search vector
- `ingredients` — Measurements and quantities
- `instructions` — Recipe steps
- `categories` — Many-to-many via `recipe_categories`

### Auth Functions

`login()`, `signup()`, `signup_provider()`, `reset_password()`

### Mobile App

Expo/React Native app in `apps/mobile/`. Uses shared packages:
- `@matrummet/types` for types/schemas, `@matrummet/api-client` for PostgREST client + auth
- Auth uses pure JS JWT (HMAC-SHA256 via `@noble/hashes`) — no `crypto.subtle` needed for Hermes
- Images via `EXPO_PUBLIC_IMAGE_BASE_URL` (local: `http://localhost:4446/uploads`, prod: nginx)
- Dev: `cd apps/mobile && npx expo run:ios` (not `expo start` — needs dev build for native modules)
- Metro config: `unstable_enablePackageExports = true` required for `@noble/hashes` subpath imports

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

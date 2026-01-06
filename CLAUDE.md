# CLAUDE.md

## What

Recept is a Swedish recipe management app. Monorepo with:

- `apps/frontend` — Next.js 16, React 19, Tailwind v4, Radix UI
- `apps/email-service` — Email notifications
- `packages/` — Shared configs (eslint, tsconfig, testing, shared utils)
- PostgreSQL database with PostgREST REST API layer

## Why

Personal recipe collection with Swedish full-text search, JWT auth, and row-level security (RLS) ensuring users only modify their own data.

## How

### Quick Commands

```bash
pnpm dev                    # Start all apps (frontend uses Turbopack)
pnpm build                  # Build all apps
pnpm lint                   # Lint all packages
pnpm test                   # Run all tests
./start-postgrest.sh        # Start PostgREST API on port 4444
./flyway/run-flyway.sh info # Check migration status
./flyway/run-flyway.sh migrate  # Apply migrations (auto-backup)
```

### Context-Efficient Commands

For build/lint/test, use the run-silent wrapper to minimize output on success:

```bash
.claude/hooks/run-silent.sh "Build" "pnpm build"
.claude/hooks/run-silent.sh "Lint" "pnpm lint"
.claude/hooks/run-silent.sh "Tests" "pnpm test --run"
```

Output: `✓ Build` on success, full error output on failure. Saves context tokens.

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

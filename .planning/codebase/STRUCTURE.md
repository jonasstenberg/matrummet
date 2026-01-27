# Codebase Structure

**Analysis Date:** 2026-01-27

## Directory Layout

```
recept/
├── apps/
│   ├── frontend/                # Next.js 16 app (React 19, TypeScript)
│   │   ├── app/                 # Next.js App Router structure
│   │   │   ├── layout.tsx        # Root layout
│   │   │   ├── (auth)/           # Auth route group (separate layout)
│   │   │   ├── (main)/           # Authenticated main routes (with header/footer)
│   │   │   └── api/              # API routes (Next.js server endpoints)
│   │   ├── components/           # React components (89 files)
│   │   ├── lib/                  # Shared utilities and server actions
│   │   ├── public/               # Static assets (images, uploads)
│   │   ├── .env.local            # Environment variables (not committed)
│   │   ├── next.config.ts        # Next.js configuration
│   │   ├── package.json          # Frontend dependencies
│   │   └── vitest.config.ts      # Frontend test configuration
│   └── email-service/            # Email notification service
├── packages/                     # Shared packages (monorepo)
│   ├── shared/                   # Shared utilities (JWT, config, errors)
│   ├── testing/                  # Shared testing utilities (Vitest setup)
│   ├── eslint/                   # ESLint configuration
│   └── tsconfig/                 # TypeScript configurations
├── tests/
│   └── api/                      # API integration tests (PostgREST contracts)
│       ├── contracts/            # API contract tests
│       ├── behavior/             # Business logic tests
│       ├── rls/                  # Row-level security tests
│       ├── snapshots/            # Schema snapshot tests
│       └── helpers.ts            # Test utilities
├── flyway/
│   ├── sql/                      # Database migrations (V1__baseline.sql, etc.)
│   └── run-flyway.sh            # Migration runner script
├── docs/
│   └── feature-specs/            # Feature specifications
├── scripts/                      # Utility scripts
├── data/
│   └── data.sql                  # Seed data for development
├── docker-compose.yml            # Local dev PostgreSQL
├── docker-compose.test.yml       # Test environment (PG + PostgREST)
├── pnpm-workspace.yaml           # Monorepo configuration
├── package.json                  # Root package (pnpm)
├── vitest.config.ts             # Root test configuration
└── CLAUDE.md                      # Project documentation
```

## Directory Purposes

**`apps/frontend/app/(main)/`:**
- Purpose: Authenticated user routes (homepage, recipes, pantry, settings, admin)
- Contains: Page components, layouts, error boundaries
- Key files:
  - `page.tsx`: Homepage
  - `recept/[id]/page.tsx`: Single recipe view
  - `recept/nytt/page.tsx`: Create recipe page
  - `admin/`: Admin-only pages (matvaror, kategorier, enheter, etc.)

**`apps/frontend/app/(auth)/`:**
- Purpose: Unauthenticated routes (login, signup, password reset)
- Contains: Auth form pages, separate layout
- Key files:
  - `login/page.tsx`: Login form
  - `registrera/page.tsx`: Sign-up form
  - `reset-password/[token]/page.tsx`: Password reset form

**`apps/frontend/app/api/`:**
- Purpose: Next.js route handlers (server-side endpoints)
- Contains: HTTP handlers for auth, recipes, shopping lists, images, webhooks
- Subdirectories:
  - `auth/`: Login, signup, logout, password reset endpoints
  - `recipes/`: Recipe import endpoint
  - `admin/`: Admin operations (food approval, category management)
  - `ai/`: AI credit system, Gemini integration
  - `upload/`: Image upload handling
  - `user/`: User profile, account deletion
  - `webhooks/`: Stripe webhook integration

**`apps/frontend/components/`:**
- Purpose: Reusable React components (89 total)
- Contains: UI components, feature-specific components, layout components
- Key subdirectories:
  - `ui/`: Base UI components (buttons, forms, dialogs from Radix UI + Tailwind)
  - `home/`: Home feature components (create dialog, invite, member list)
  - `my-pantry/`: Pantry feature components
  - `wizard-steps/`: Recipe creation wizard steps
  - `__tests__/`: Component tests

**`apps/frontend/lib/`:**
- Purpose: Utilities, server actions, API clients, types
- Contains: Non-React logic, API abstractions, authentication
- Key files:
  - `actions.ts`: Server actions for mutations (create/update/delete recipes, shopping lists)
  - `api.ts`: API client functions (fetch wrappers for PostgREST)
  - `auth.ts`: JWT signing, token verification, session management
  - `types.ts`: TypeScript interfaces (User, Recipe, Ingredient, etc.)
  - `schemas.ts`: Zod validation schemas
  - `recipe-import/`: Recipe import from URL logic
  - `recipe-parser/`: AI-powered recipe parsing
  - `ingredient-search-actions.ts`: Ingredient search and filtering
  - `hooks/`: React hooks (useMediaQuery, useWakeLock)

**`tests/api/`:**
- Purpose: Database and API contract testing
- Structure:
  - `contracts/`: Tests for API endpoints (auth, recipes, shopping lists, etc.)
  - `behavior/`: Business logic tests (recipe matching, pantry auto-add, scaling)
  - `rls/`: Row-level security enforcement tests
  - `snapshots/`: Database schema snapshot tests
  - `helpers.ts`: Test utilities (auth helpers, database setup)

**`flyway/sql/`:**
- Purpose: Database migration files (version-controlled schema)
- Contains: 57+ migrations (V1__baseline.sql through V57__ai_credits_system.sql)
- Pattern: Each file is a single migration with one version number
- Key migrations:
  - V1: Tables, indexes, RLS policies
  - V2-3: Ingredient groups, user roles
  - V12: Food approval workflow
  - V25: Recipe likes feature
  - V26: Shopping lists feature

**`packages/shared/src/`:**
- Purpose: Shared utilities used by frontend and backend
- Contains:
  - `jwt/`: JWT signing/verification utilities
  - `config/`: Configuration management
  - `logger/`: Logging utilities
  - `middleware/`: Common middleware
  - `errors/`: Custom error types

**`packages/testing/src/`:**
- Purpose: Shared testing setup and utilities
- Contains:
  - `vitest/`: Vitest configuration
  - `setup/`: Test environment setup
  - `mocks/`: Mock utilities

## Key File Locations

**Entry Points:**
- `apps/frontend/app/layout.tsx`: Root HTML layout, metadata, fonts
- `apps/frontend/app/(main)/layout.tsx`: Main app layout with user data, Header/Footer
- `apps/frontend/app/(main)/page.tsx`: Homepage (fetch recipes, render `RecipePageClient`)
- `apps/frontend/app/(auth)/layout.tsx`: Auth section layout

**Configuration:**
- `apps/frontend/.env.local`: Environment variables (POSTGREST_URL, etc.)
- `apps/frontend/next.config.ts`: Next.js config (Turbopack, TypeScript)
- `apps/frontend/tsconfig.json`: TypeScript compiler options
- `apps/frontend/components.json`: Shadcn/ui component registry
- `pnpm-workspace.yaml`: Monorepo workspace definition
- `vitest.config.ts`: Root Vitest config

**Core Logic:**
- `apps/frontend/lib/actions.ts`: Server mutations (create/update/delete recipes)
- `apps/frontend/lib/api.ts`: PostgREST client functions
- `apps/frontend/lib/auth.ts`: Authentication and token management
- `apps/frontend/components/create-recipe-wizard.tsx`: Main recipe creation component
- `apps/frontend/components/recipe-page-client.tsx`: Main recipe browsing component

**Testing:**
- `tests/api/contracts/recipes.test.ts`: Recipe API contract tests
- `tests/api/rls/recipes.test.ts`: RLS tests for recipes
- `tests/api/behavior/recipe-matching.test.ts`: Business logic tests
- `tests/api/helpers.ts`: Test utilities

**Database:**
- `flyway/sql/V1__baseline.sql`: Initial schema (users, recipes, ingredients)
- `flyway/sql/V26__shopping_lists.sql`: Shopping list feature schema
- `flyway/run-flyway.sh`: Migration runner script

## Naming Conventions

**Files:**
- Page files: `page.tsx` (Next.js App Router)
- Layout files: `layout.tsx` (Next.js App Router)
- API routes: `route.ts` (Next.js App Router)
- Components: `kebab-case.tsx` (e.g., `recipe-card.tsx`, `create-recipe-wizard.tsx`)
- Utilities: `kebab-case.ts` (e.g., `api.ts`, `actions.ts`, `auth.ts`)
- Types: `kebab-case.ts` (e.g., `types.ts`, `schemas.ts`)
- Tests: `kebab-case.test.ts` (e.g., `recipes.test.ts`, `auth.test.ts`)
- Migrations: `V{number}__{description}.sql` (e.g., `V1__baseline.sql`)

**Directories:**
- Feature-based: `mitt-skafferi/` (my pantry), `admin/` (admin tools)
- Route groups (Next.js): `(main)/` (authenticated), `(auth)` (public auth)
- Nested routes: `recept/[id]/redigera/` (edit recipe at `/recept/[id]/redigera`)
- Category-based: `components/`, `lib/`, `public/`
- CamelCase for most directories; kebab-case for route segments

**Functions:**
- Server actions (marked `'use server'`): `createRecipe()`, `updateRecipe()`, `deleteRecipe()`
- API helpers: `getRecipes()`, `getRecipe()`, `getCategories()`
- Hooks: `useMediaQuery()`, `useWakeLock()` (React convention)
- Utilities: `buildSystemInstruction()`, `validateParsedRecipe()`

**Variables:**
- camelCase: `recipe`, `pantryItems`, `isLoading`, `authorizedUsers`
- UPPER_CASE for constants: `POSTGREST_URL`, `GEMINI_MODEL`
- Prefixes: `_role` for internal variables, `p_` for procedure parameters

**Types:**
- PascalCase: `User`, `Recipe`, `Ingredient`, `CreateRecipeInput`
- Interfaces for objects: `interface User { ... }`
- Type unions for variants: `type Provider = 'email' | 'google'`

## Where to Add New Code

**New Feature (e.g., meal planning):**
- Primary code: `apps/frontend/app/(main)/meal-plan/` (page + components)
- Components: `apps/frontend/components/meal-plan/` (feature-specific components)
- Server actions: Add to `apps/frontend/lib/actions.ts` or `apps/frontend/lib/meal-plan-actions.ts`
- Types: Add to `apps/frontend/lib/types.ts`
- API routes: `apps/frontend/app/api/meal-plans/` if needed
- Database: Add migration in `flyway/sql/V{next}__meal_planning.sql`
- Tests: `tests/api/contracts/meal-plans.test.ts`

**New Component:**
- Implementation: `apps/frontend/components/` (organized by feature if complex)
- Tests: `apps/frontend/components/__tests__/ComponentName.test.tsx`
- Pattern: Use `'use client'` if interactive, no directive if Server Component
- Use Radix UI + Tailwind for styling (no custom CSS required)

**Utilities:**
- Shared utilities: `apps/frontend/lib/` (e.g., `quantity-utils.ts`, `utils.ts`)
- Feature-specific actions: `apps/frontend/lib/{feature}-actions.ts`
- Reusable across monorepo: `packages/shared/src/`

**API Endpoint:**
- Location: `apps/frontend/app/api/{resource}/{action}/route.ts`
- Pattern: Use `NextRequest`, `NextResponse` from Next.js
- Always verify authentication before returning user data
- Example: `apps/frontend/app/api/recipes/import/route.ts`

**Database Schema Change:**
- Create migration: `flyway/sql/V{next}__{description}.sql`
- Include RLS policies for new tables
- Update stored procedures if multi-table changes needed
- Add views for complex joins
- Test with `./flyway/run-flyway.sh migrate`

**Tests:**
- API contract tests: `tests/api/contracts/{resource}.test.ts`
- RLS tests: `tests/api/rls/{resource}.test.ts`
- Behavior tests: `tests/api/behavior/{feature}.test.ts`
- Use helpers from `tests/api/helpers.ts` for test setup

## Special Directories

**`apps/frontend/.next/`:**
- Purpose: Next.js build output (compiled code, cache)
- Generated: Yes
- Committed: No (in `.gitignore`)

**`apps/frontend/public/`:**
- Purpose: Static assets and user-uploaded images
- Contains: SVG icons, uploaded recipe images by UUID
- Committed: Icons and assets yes, user uploads no

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes
- Committed: No (in `.gitignore`)

**`flyway/`:**
- Purpose: Database migration management
- Contains: SQL migration files, Flyway configuration
- Important: Migrations are immutable; create new migrations for changes

**`.planning/codebase/`:**
- Purpose: Architecture and codebase documentation (this directory)
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, etc.
- Used by: GSD agents for code generation and planning

**`.claude/`:**
- Purpose: Claude-specific configuration and skills
- Contains: Agent definitions, GSD commands, hooks
- Used by: Claude Code for orchestration

---

*Structure analysis: 2026-01-27*

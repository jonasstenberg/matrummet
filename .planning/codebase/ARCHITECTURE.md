# Architecture

**Analysis Date:** 2026-01-27

## Pattern Overview

**Overall:** Client-server architecture with Next.js 16 frontend and PostgreSQL backend accessed via PostgREST REST API layer.

**Key Characteristics:**
- Server-side rendering with React Server Components for data fetching
- PostgREST REST API provides database abstraction with row-level security
- JWT-based authentication with httpOnly cookies
- Modular component library (89 React components) organized by feature
- Server Actions for mutations and server-side logic
- PostgreSQL with comprehensive row-level security policies enforcing user ownership
- Monorepo structure with shared packages for configuration and testing

## Layers

**Presentation Layer:**
- Purpose: Render UI and handle user interactions
- Location: `apps/frontend/components/` and `apps/frontend/app/`
- Contains: React components (TSX files), page layouts, client components with hooks
- Depends on: API client functions, server actions, Auth layer
- Used by: Browser/user interactions

**API Integration Layer:**
- Purpose: Communicate with PostgREST backend; abstract API calls and authentication
- Location: `apps/frontend/lib/api.ts`, `apps/frontend/lib/auth.ts`, `apps/frontend/lib/actions.ts`
- Contains: Fetch wrappers, token management, PostgREST RPC calls
- Depends on: Environment variables, JWT signing, PostgREST endpoints
- Used by: Server Components, Server Actions, Client Components

**Server Action Layer:**
- Purpose: Handle server-side mutations and business logic with security context
- Location: `apps/frontend/lib/actions.ts`, `apps/frontend/lib/home-actions.ts`, `apps/frontend/lib/ingredient-search-actions.ts`
- Contains: Mutations (create/update/delete), server-side processing, token generation
- Depends on: PostgREST API, authentication, file system for image processing
- Used by: Client components via form submissions and event handlers

**Authentication Layer:**
- Purpose: Manage session, JWT tokens, and authentication state
- Location: `apps/frontend/lib/auth.ts`, `apps/frontend/app/api/auth/`
- Contains: Token signing/verification, session retrieval, auth route handlers
- Depends on: `packages/shared` (JWT utilities), PostgREST auth functions
- Used by: All layers requiring user context

**Database/API Layer:**
- Purpose: Enforce business rules, security, and data consistency
- Location: PostgreSQL (Flyway migrations in `flyway/sql/`)
- Contains: Tables, views, RLS policies, stored procedures/functions
- Depends on: PostgREST for REST exposure
- Used by: Frontend via HTTP requests

**Testing Layer:**
- Purpose: Validate API contracts and row-level security
- Location: `tests/api/` with subdirectories: `contracts/`, `behavior/`, `rls/`
- Contains: Vitest tests, RLS validation, contract testing
- Depends on: Docker-based PostgreSQL + PostgREST for test environment
- Used by: CI/CD pipeline, developers

## Data Flow

**Recipe Creation Flow:**

1. User submits form in `create-recipe-wizard.tsx`
2. Component calls Server Action `createRecipe()` from `lib/actions.ts`
3. Server Action retrieves auth token from cookies, verifies it, generates PostgREST token
4. Calls PostgREST RPC function `insert_recipe()` with recipe data
5. Database applies RLS policy: checks owner email matches JWT claim
6. Trigger processes atomic insert of recipe, ingredients, instructions, categories
7. Server Action revalidates cache paths (`/recept`, `/`)
8. Client receives recipe ID and updates UI

**Recipe Retrieval Flow:**

1. Server Component `(main)/page.tsx` loads on route access
2. Fetches recipes via `getRecipes()` from `lib/api.ts`
3. API client calls PostgREST endpoint `/recipes_and_categories` with filters
4. PostgREST applies RLS: SELECT returns only visible recipes
5. Response includes computed fields (pantry match, likes) from views/functions
6. Server Component passes initial data to Client Component `RecipePageClient`
7. Client renders recipes; can filter/search further client-side

**Search Flow (Substring Matching):**

1. User enters search query in UI
2. Client calls `getRecipes({ search: "..." })`
3. API client uses PostgREST RPC function `search_recipes()` (Swedish full-text)
4. RPC returns recipes ranked by relevance using PostgreSQL `tsvector`
5. Client handles multiple category filtering (OR logic) post-RPC
6. Results update on page without full reload (revalidated cache tags)

**Authentication & Session Flow:**

1. User submits login form → `POST /api/auth/login`
2. Route handler calls PostgREST RPC `login(email, password)`
3. Database function validates password hash
4. If valid, route handler signs JWT token (claims: email, name, role)
5. Sets httpOnly cookie `auth-token` (7-day expiry, secure in production)
6. Response includes user object (id, name, email, etc.)
7. Client updates AuthContext with user data
8. Subsequent requests include auth token via `getPostgrestToken()`

**State Management:**

- **Auth State:** Stored in AuthProvider context (`auth-provider.tsx`), read from httpOnly cookie
- **User Pantry:** Fetched server-side in layout, passed to child components
- **Recipe Data:** Server-side fetched, passed to components, client-side state for UI toggles
- **Real-time Updates:** Cache revalidation via `revalidatePath()` after mutations
- **Shopping List:** Fetched on-demand with token, stored in component state

## Key Abstractions

**PostgREST as API Gateway:**
- Purpose: REST exposure of PostgreSQL with automatic RLS enforcement
- Examples: `/recipes_and_categories`, `/rpc/insert_recipe`, `/rpc/search_recipes`
- Pattern: All database access goes through PostgREST; frontend never touches database directly

**Server Actions as Mutation Handlers:**
- Purpose: Server-side logic with full context (headers, cookies, auth)
- Examples: `createRecipe()`, `updateRecipe()`, `likeRecipe()`
- Pattern: Always retrieve token from cookies, verify, then call PostgREST

**RLS Policies for Security:**
- Purpose: Enforce row-level access at database layer
- Examples: `users_policy_select`, `recipes_policy_select`, `pantry_policy_select`
- Pattern: All SELECT/INSERT/UPDATE/DELETE checked against `request.jwt.claims->>'email'`

**Stored Procedures for Atomic Operations:**
- Purpose: Multi-table changes as single transactions
- Examples: `insert_recipe()`, `update_recipe()`, `add_to_shopping_list()`
- Pattern: Map server action inputs to procedure parameters, execute via RPC

**Views for Computed Fields:**
- Purpose: Denormalize and compute complex fields without code logic
- Examples: `recipes_and_categories` (joins with categories), `liked_recipes` (with user's likes)
- Pattern: Query views instead of raw tables to get pre-joined data

**Component Patterns:**

**Server Components (SSR):**
- Location: `app/(main)/**/*.tsx`, `app/(auth)/**/*.tsx`
- Pattern: Fetch data server-side, pass as props to Client Components
- Examples: `(main)/layout.tsx` fetches user, `(main)/page.tsx` fetches recipes

**Client Components:**
- Location: Files with `'use client'` directive, mostly in `components/`
- Pattern: Handle UI state, form submission, real-time filtering
- Examples: `RecipePageClient`, `RecipeForm`, `CreateRecipeWizard`

**API Route Handlers:**
- Location: `app/api/**/*.ts`
- Pattern: Handle HTTP requests, validate input, call actions or PostgREST
- Examples: `app/api/auth/login/route.ts`, `app/api/upload/route.ts`

## Entry Points

**Web Application Entry Point:**
- Location: `apps/frontend/app/layout.tsx`
- Triggers: Browser navigation to root domain
- Responsibilities: Root HTML structure, metadata, font loading, global styles

**Authenticated Section Entry Point:**
- Location: `apps/frontend/app/(main)/layout.tsx`
- Triggers: Navigation within `/` (main layout group)
- Responsibilities: Fetch authenticated user, fetch home info, render Header/Footer

**Auth Flow Entry Point:**
- Location: `apps/frontend/app/(auth)/layout.tsx`
- Triggers: Navigation to `/login`, `/registrera`, `/reset-password`
- Responsibilities: Auth-specific layout (different from main)

**Home Page Entry Point:**
- Location: `apps/frontend/app/(main)/page.tsx`
- Triggers: `GET /`
- Responsibilities: Fetch recipes (owner's or all), categories, pantry; pass to `RecipePageClient`

**API Entry Points (for external requests):**
- Location: `apps/frontend/app/api/auth/**`, `apps/frontend/app/api/recipes/`, `apps/frontend/app/api/ai/`
- Triggers: Client-side fetch calls
- Responsibilities: Validate request, call server actions or PostgREST, return response

## Error Handling

**Strategy:** Try-catch at multiple layers with user-friendly messages

**Patterns:**

- **API Layer:** Catch fetch errors, log details, return structured error objects `{ error: string }`
- **Server Actions:** Wrap in try-catch, return `{ error: string }` on failure
- **Client Components:** Handle error states via error boundaries or error UI display
- **Database:** Postgres errors surfaced via PostgREST; route handlers translate to user messages (Swedish)
- **Auth:** Redirect to login on 401, show error message on 400

**Examples:**
- `lib/actions.ts`: `catch (error) { return { error: 'Kunde inte skapa receptet' } }`
- `lib/api.ts`: `if (!res.ok) throw new Error(...)`
- Route handlers: `if (!response.ok) { return NextResponse.json({ error: '...' }, { status: 401 }) }`

## Cross-Cutting Concerns

**Logging:** Console logging for errors and key operations; no structured logging framework

**Validation:**
- Frontend: Zod schemas in `lib/schemas.ts` for recipe/user input
- Database: CHECK constraints on columns, NOT NULL, UNIQUE
- API handlers: Manual validation of required fields

**Authentication:**
- httpOnly cookies with JWT
- Token verification on each server action
- PostgREST token generation for API calls
- RLS policies enforce ownership at database

**Rate Limiting:** Not explicitly implemented; PostgREST rate limiting can be configured

**Caching:**
- Next.js ISR: `revalidatePath()` after mutations
- Cache tags: `next: { tags: ['categories'] }` for granular invalidation
- PostgREST responses: `cache: 'no-store'` for auth-dependent queries, `revalidate: 60` for public data

---

*Architecture analysis: 2026-01-27*

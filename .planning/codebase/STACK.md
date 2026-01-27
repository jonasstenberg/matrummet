# Technology Stack

**Analysis Date:** 2026-01-27

## Languages

**Primary:**
- TypeScript 5.8.3 - All source code in frontend, email-service, and shared packages
- SQL (PostgreSQL) - Database schema and migrations via Flyway

**Secondary:**
- JavaScript - Handlebars templates in `apps/email-service/src/templates/`
- Bash - Build and database scripts (`start-postgrest.sh`, `flyway/run-flyway.sh`)

## Runtime

**Environment:**
- Node.js (version not specified in package.json, inferred as LTS compatible)

**Package Manager:**
- pnpm 10.26.0 (enforced in root `package.json`)
- Monorepo workspace using pnpm workspaces (defined in `pnpm-workspace.yaml`)
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- Next.js 16.1.1 - Frontend framework (`apps/frontend`)
  - Runs with Turbopack in dev (`next dev --turbopack`)
  - Built with webpack for production (`next build --webpack`)
  - Configured for standalone output mode in `apps/frontend/next.config.ts`
- React 19.2.3 - UI library for Next.js
- React DOM 19.2.3 - React renderer for web
- Express 5.1.0 - HTTP server for email service (`apps/email-service`)

**Testing:**
- Vitest 4.0.15 - Test runner for all packages (root-level and per-app configs)
- Testing Library React 16.3.0 - Component testing utilities
- Playwright 1.57.0 - Browser automation and E2E testing
- JSDOM 26.1.0 - DOM implementation for Node.js tests

**Build/Dev:**
- TypeScript 5.8.3 - Compilation and type checking
- ESLint 9.28.0 (frontend), 9.22.0+ (email-service) - Linting
- Tailwind CSS 4.1.8 - Utility-first CSS framework
- PostCSS 4.1.8 - CSS transformation tool
- Zod 4.2.1 - Schema validation library
- tsx 4.19.3 - TypeScript execution (email-service dev)

## Key Dependencies

**Critical:**
- PostgREST API - REST layer over PostgreSQL (external binary, v14.3 in test, configured in `postgrest.cfg`)
- PostgreSQL 18 - Database (running in Docker for development/testing)
- Flyway 11 - Database migration tool (running in Docker, migrations in `flyway/sql/`)

**UI Components & Styling:**
- @radix-ui/* - Unstyled, accessible component library (accordion, checkbox, dialog, label, select, separator, slider, slot, switch, tabs)
- Tailwind CSS plugins:
  - @tailwindcss/postcss 4.1.8 - CSS-in-JS PostCSS plugin
  - @tailwindcss/typography 0.5.16 - Typography styles
- class-variance-authority 0.7.1 - Component variant management
- clsx 2.1.1 - Conditional class names
- lucide-react 0.513.0 - SVG icon library
- tailwind-merge 3.3.0 - Tailwind CSS class deduplication

**Data & HTTP:**
- jose 6.0.10 - JWT signing and verification (root and frontend)
- stripe 20.2.0 - Payment processing SDK
- @google/genai 1.34.0 - Google Gemini AI API client
- @tanstack/react-table 8.21.3 - Headless table library

**Content Parsing & Processing:**
- cheerio 1.1.2 - jQuery-like syntax for server-side HTML parsing
- sharp 0.34.5 - Image processing (resize, format conversion to WebP)
- zod 4.2.1 - Runtime schema validation

**Email:**
- nodemailer 6.10.0 - SMTP email sender
- handlebars 4.7.8 - Email template rendering

**Database:**
- pg 8.14.1 - PostgreSQL driver (email-service)

**Auth & Security:**
- jose 6.0.10 - JWT handling for Next.js and PostgREST

## Configuration

**Environment:**
- Zod schema validation in `apps/frontend/lib/env.ts` - validates all required env vars at startup
- Required vars:
  - `POSTGREST_URL` - API endpoint (e.g., `http://localhost:4444`)
  - `JWT_SECRET` - Next.js session token (32+ chars)
  - `POSTGREST_JWT_SECRET` - PostgREST token signing key (32+ chars)
- Optional vars:
  - `GEMINI_API_KEY` - Google Gemini API key
  - `RECIPE_IMPORT_API_KEY` - Internal recipe import webhook key
  - `RECIPE_IMPORT_EMAIL` - Email for imported recipes
  - `GOOGLE_CLIENT_ID`, `GOOGLE_SECRET` - OAuth credentials
  - `APP_URL` - Public app URL
  - `CRON_SECRET` - Secret for cron endpoints
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` - Payment processing

**Build:**
- TypeScript config: `apps/frontend/tsconfig.json`, `apps/email-service/tsconfig.json`
- Next.js config: `apps/frontend/next.config.ts` (standalone output, image optimization)
- PostCSS config: `apps/frontend/postcss.config.js`
- ESLint config: `apps/frontend/eslint.config.mjs`, `apps/email-service/.eslintrc.js`
- Vitest config: `vitest.config.ts` (root), `apps/frontend/vitest.config.ts`, `apps/email-service/vitest.config.ts`, `tests/api/vitest.config.ts`

## Platform Requirements

**Development:**
- Node.js runtime with pnpm
- Docker & Docker Compose (PostgreSQL, Flyway, PostgREST for testing)
- Homebrew-installable tools:
  - postgrest CLI (for local PostgREST dev server)
  - Inbucket (for email testing, Docker image or local)

**Production:**
- Node.js runtime
- PostgreSQL 18+ database
- PostgREST API server
- External services:
  - Google Gemini API (optional, for AI recipe parsing)
  - Stripe (optional, for credit system)
  - Google OAuth (optional, for authentication)
  - SMTP server for email delivery

**Database:**
- PostgreSQL 18-alpine (Docker image in `docker-compose.test.yml`)
- Minimum 1 database named `recept`, role `recept` with password
- PostgREST requires role-based access control and RLS policies

---

*Stack analysis: 2026-01-27*

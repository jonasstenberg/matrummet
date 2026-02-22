# Matrummet

A Swedish recipe management application built with TanStack Start, PostgreSQL, and PostgREST.

## Features

- Recipe management with ingredients, instructions, and categories
- Swedish full-text search
- Recipe sharing via tokenized links
- Shopping lists with recipe ingredient sourcing
- Pantry inventory tracking
- Household management with invitations
- AI-powered recipe import, generation, and refinement
- JWT-based authentication with row-level security
- Image optimization with multiple size variants
- Queue-based email notifications

## Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/installation) 10+
- [PostgreSQL](https://www.postgresql.org/download/) 18+
- [PostgREST](https://postgrest.org/en/stable/install.html)
- [Docker](https://docs.docker.com/get-docker/) (for integration tests)

## Project Structure

```
matrummet/
├── apps/
│   ├── web/               # TanStack Start web application
│   └── email-service/     # Email notification service
├── packages/
│   ├── shared/            # Shared utilities (JWT, config, logger)
│   ├── eslint/            # ESLint configuration
│   ├── tsconfig/          # TypeScript configuration
│   └── testing/           # Vitest configuration
├── flyway/
│   └── sql/               # Database migrations
├── tests/
│   └── api/               # API contract and RLS tests
└── data/                  # Seed data
```

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Run migrations

```bash
./flyway/run-flyway.sh migrate
```

### 3. Start PostgREST

```bash
./start-postgrest.sh
```

### 4. Start all services

```bash
pnpm dev
```

The frontend runs on http://localhost:3000, PostgREST on http://localhost:4444.

## Environment Variables

### Web App (`apps/web/.env.local`)

```bash
POSTGREST_URL=http://localhost:4444
JWT_SECRET=your-secret-key-min-32-chars
POSTGREST_JWT_SECRET=same-as-jwt-secret
```

### Email Service (`apps/email-service/.env.local`)

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/matrummet
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@example.com
PORT=4004
```

## Development

### Commands

```bash
pnpm dev           # Start all apps with hot reload
pnpm check         # Run lint + tests
pnpm check:build   # Build all apps
pnpm check:lint    # Lint all packages
pnpm check:test    # Run unit tests
pnpm check:api     # Run API integration tests
```

### API Integration Tests

Requires a Docker test environment (PostgreSQL on 5433, PostgREST on 4445):

```bash
docker-compose -f docker-compose.test.yml up -d    # Start test environment
pnpm test:api                                       # Run API contract tests
docker-compose -f docker-compose.test.yml down       # Teardown
```

After schema changes, recreate the test database:

```bash
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
```

## Database

### Migrations

Migrations live in `flyway/sql/` using the naming convention `V{version}__{description}.sql`.

```bash
./flyway/run-flyway.sh info         # Check migration status
./flyway/run-flyway.sh migrate      # Apply pending migrations (auto-backup)
./flyway/run-flyway.sh backup       # Create database backup
./flyway/run-flyway.sh restore      # Restore from backup
./flyway/run-flyway.sh list-backups # List available backups
```

### Creating a Migration

Create a new file in `flyway/sql/` with the next version number:

```sql
-- flyway/sql/V18__add_cooking_time.sql

ALTER TABLE recipes ADD COLUMN cooking_time_minutes integer;
```

Test locally before submitting:

```bash
./flyway/run-flyway.sh migrate
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` / `user_passwords` | User accounts with bcrypt auth |
| `recipes` | Recipe data with full-text search vector |
| `ingredients` / `ingredient_groups` | Recipe ingredients with quantities |
| `instructions` / `instruction_groups` | Recipe steps |
| `categories` / `category_groups` | Recipe tags via `recipe_categories` |
| `recipe_likes` | User favorites |
| `recipe_share_tokens` | Shareable recipe links |
| `homes` / `home_invitations` | Household management |
| `shopping_lists` / `shopping_list_items` | Shopping lists |
| `user_pantry` | Pantry inventory |
| `foods` / `units` | Ingredient reference data |
| `user_credits` / `credit_transactions` | Credit system |
| `email_messages` / `email_templates` | Email queue |

### Row-Level Security

All tables use RLS policies with JWT email claims (`request.jwt.claims->>'email'`) for ownership. Write operations require ownership; read access varies by table.

## Architecture

### Authentication Flow

1. User logs in via `login()` database function
2. Server generates JWT with user email claim
3. Token stored in httpOnly secure cookie
4. PostgREST validates JWT and applies RLS policies

### API Pattern

PostgREST exposes the database as a REST API. Complex operations use stored procedures:

- `insert_recipe()` / `update_recipe()` -- Atomic recipe CRUD with categories, ingredients, and instructions
- `login()`, `signup()`, `reset_password()` -- Auth operations

### Image Handling

Images are optimized at upload time into multiple variants (thumb, small, medium, large, full) and served statically from `/public/uploads/`.

## Shared Packages

### @matrummet/shared

Common utilities for Node.js services: configuration management, JWT handling, and logging.

```typescript
import { getOptionalEnv, getRequiredEnv, generateToken } from "@matrummet/shared";
```

### @matrummet/eslint

Shared ESLint configurations with frontend and backend presets:

```js
// Frontend
import { frontend } from "@matrummet/eslint";
export default frontend();

// Backend
import { backend } from "@matrummet/eslint";
export default backend();
```

### @matrummet/tsconfig

Shared TypeScript configurations: `base.json`, `node.json`, `web.json`.

```json
{
  "extends": "@matrummet/tsconfig/node.json"
}
```

### @matrummet/testing

Shared Vitest configuration and test setup with exports for both `node` and `jsdom` environments.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) handles automated deployment on push to `main` or via manual workflow dispatch:

- **Database migrations** with automatic backups before applying
- **Web app** build and deployment
- **Email service** Docker deployment

Each component can be toggled independently via workflow dispatch inputs.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style guidelines, and pull request process.

## License

This project is licensed under the [MIT License](LICENSE).

---
name: build-update-tests
version: 1.0.0
description: Evaluate test coverage and create appropriate tests based on risk assessment. Use when user says "build tests", "update tests", "add test coverage", "write tests for this", or "improve test coverage".
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
context: fork
---

# Build/Update Tests

> Evaluate test coverage and create appropriate tests based on risk assessment.

<when_to_use>

## When to Use

Invoke when user says:

- "build tests"
- "update tests"
- "add test coverage"
- "write tests for this"
- "improve test coverage"
- "what tests do we need"
- "test this feature"

</when_to_use>

<workflow>

## Workflow

| Phase | Action                              | Gate              |
| ----- | ----------------------------------- | ----------------- |
| 1     | Identify changed/new code           | -                 |
| 2     | Assess risk level                   | -                 |
| 3     | Check existing coverage             | -                 |
| 4     | Determine test types needed         | User approval     |
| 5     | Generate tests                      | -                 |
| 6     | Verify tests pass                   | Tests must pass   |

</workflow>

<risk_matrix>

## Risk Matrix

| Risk Level | Code Type                           | Required Tests                    |
| ---------- | ----------------------------------- | --------------------------------- |
| Critical   | Auth, security, RLS policies        | Unit + API contract + RLS tests   |
| High       | Mutations, data modifications       | Unit + API contract tests         |
| Medium     | Queries, data fetching              | Unit tests + edge cases           |
| Low        | Utils, formatters, pure functions   | Unit tests                        |

### Critical Code Patterns (Recept)
- `login()`, `signup()`, password handling
- RLS policies in migrations
- JWT claim extraction
- `insert_recipe()`, `update_recipe()` atomic operations

### High Risk Patterns
- Any INSERT, UPDATE, DELETE operations
- State mutations
- Form submissions
- API route handlers

</risk_matrix>

<test_types>

## Test Types

### Unit Tests (vitest)
**Location**: Same directory as source, `*.test.ts`
**Use for**: Pure functions, utilities, components, hooks

```typescript
// Example: apps/web/lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatRecipeTime } from './utils'

describe('formatRecipeTime', () => {
  it('formats minutes correctly', () => {
    expect(formatRecipeTime(90)).toBe('1h 30min')
  })

  it('handles zero', () => {
    expect(formatRecipeTime(0)).toBe('0min')
  })
})
```

### API Contract Tests
**Location**: `tests/api/*.test.ts`
**Use for**: PostgREST endpoints, RLS verification

```typescript
// Example: tests/api/recipes.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createTestClient } from '../helpers'

describe('GET /recipes', () => {
  it('returns public recipes without auth', async () => {
    const client = createTestClient()
    const response = await client.get('/recipes')
    expect(response.status).toBe(200)
    expect(Array.isArray(response.data)).toBe(true)
  })
})
```

### RLS Tests
**Location**: `tests/api/rls/*.test.ts`
**Use for**: Row-level security policy verification

```typescript
// Example: tests/api/rls/recipes-rls.test.ts
describe('recipes RLS', () => {
  it('prevents users from modifying others recipes', async () => {
    const userA = createTestClient({ email: 'a@test.com' })
    const userB = createTestClient({ email: 'b@test.com' })

    // Create recipe as user A
    const recipe = await userA.post('/recipes', { title: 'Test' })

    // User B cannot delete
    const response = await userB.delete(`/recipes?id=eq.${recipe.id}`)
    expect(response.status).toBe(404) // RLS hides it
  })
})
```

### Behavior Tests
**Location**: Component test files
**Use for**: User interactions, form submissions

```typescript
// Example: components/recipe-form.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { RecipeForm } from './recipe-form'

describe('RecipeForm', () => {
  it('validates required fields', async () => {
    render(<RecipeForm />)
    fireEvent.click(screen.getByText('Save'))
    expect(await screen.findByText('Title is required')).toBeInTheDocument()
  })
})
```

</test_types>

<execution>

## Phase 1: Identify Changed Code

```bash
# Find modified files
git diff --name-only HEAD

# Find recently added files
git diff --name-only --diff-filter=A HEAD~5

# Focus on source files
git diff --name-only HEAD | grep -E '\.(ts|tsx)$' | grep -v '\.test\.'
```

## Phase 2: Assess Risk Level

For each changed file:
1. Read the file content
2. Identify code patterns (see Risk Matrix)
3. Assign risk level

## Phase 3: Check Existing Coverage

```bash
# Find existing tests for a file
# Source: apps/web/lib/utils.ts
# Test:   apps/web/lib/utils.test.ts

# Check if test file exists
ls -la [source-path].test.ts 2>/dev/null || echo "No test file"

# Check API tests
grep -r "[function-or-endpoint-name]" tests/api/
```

## Phase 4: Determine Test Types Needed

Based on risk and existing coverage:

| Scenario                          | Action                              |
| --------------------------------- | ----------------------------------- |
| Critical code, no tests           | Create all required test types      |
| High risk, partial coverage       | Add missing test types              |
| Medium risk, no unit tests        | Add unit tests                      |
| Low risk, no tests                | Add basic unit tests                |
| Existing tests, code changed      | Update tests to match new behavior  |

Present plan to user for approval.

## Phase 5: Generate Tests

Follow project patterns:
- Use vitest (`describe`, `it`, `expect`)
- Use existing test helpers from `tests/helpers/`
- Match file naming: `[source].test.ts`
- Co-locate unit tests with source

## Phase 6: Verify Tests Pass

```bash
# Run new tests (use raw command for specific file)
pnpm test --run [test-file-path]

# Run full suite to check for regressions
pnpm check:test
```

</execution>

<recept_patterns>

## Recept Testing Patterns

### Test Environment Setup
```bash
# API tests require test Docker environment
docker-compose -f docker-compose.test.yml up -d
pnpm check:api
```

### Common Test Helpers
- `createTestClient(jwt?)` — HTTP client for API tests
- `seedTestData()` — Insert test fixtures
- `cleanupTestData()` — Remove test data after run

### Mocking
- Mock `fetch` for external API calls
- Mock `cookies()` for auth in server components
- Use MSW for complex API mocking if needed

### Assertions
- PostgREST returns arrays by default
- Check `Content-Range` header for pagination
- RLS may return 404 instead of 403

</recept_patterns>

<quick_reference>

## Quick Reference

```bash
# Run all unit tests
pnpm check:test

# Run specific test file (use raw command)
pnpm test --run [test-file-path]

# Run API tests (requires test Docker)
docker-compose -f docker-compose.test.yml up -d
pnpm check:api

# Find existing tests
ls -la **/*.test.ts tests/api/
```

</quick_reference>

<approval_gates>

## Approval Gates

| Gate        | Phase | Question                                              |
| ----------- | ----- | ----------------------------------------------------- |
| Test plan   | 4     | "Create these tests? [list test types per file]"      |
| Test pass   | 6     | "All tests pass. Commit with changes?"                |

</approval_gates>

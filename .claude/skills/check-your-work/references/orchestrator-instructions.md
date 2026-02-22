# Orchestrator Instructions — check-your-work

## Severity Classification

| Level | Meaning                                        | Action                              |
| ----- | ---------------------------------------------- | ----------------------------------- |
| P0    | Critical (security, data corruption, outage)   | Fix immediately                     |
| P1    | High (logic errors, performance, workflows)    | Recommend fixing before commit      |
| P2    | Medium (duplications, antipatterns, spec gaps) | Safe to commit, track issues        |
| P3    | Low (style, minor improvements)                | Optional improvements               |

## Critical Rule: Report ALL Bugs

Report ALL bugs found in reviewed files regardless of when they were introduced. A bug discovered today that was written months ago is still a bug. Classify by severity based on impact, not origin. Let the user decide which to fix.

## Phase 2: Agent Prompts (6 Parallel)

Launch ALL 6 agents in a single message with multiple Task calls (`subagent_type: "general-purpose"`). Provide each agent the file contents, recept patterns below, and instruction to output findings as: `{severity: P0-P3, file, line, description, evidence}`.

**duplicate-detector**: "Search the codebase for existing utilities, helpers, or patterns that duplicate logic in the changed files. Check `packages/shared/`, `apps/web/lib/`, and `apps/email-service/src/` for existing implementations."

**user-intent**: "Read the git diff and recent conversation context. Verify the implementation matches what was requested. Check for missing requirements, partial implementations, or misunderstood specifications."

**deep-bug-hunter**: "Analyze the changed code for logic errors, race conditions, off-by-one errors, unhandled edge cases, null/undefined issues, and incorrect assumptions. Pay attention to recipe operations using `insert_recipe()`/`update_recipe()` and PostgREST API calls."

**security-reviewer**: "Check for RLS bypass (missing JWT email claim checks), SQL injection in migrations, XSS in React components, exposed secrets, improper auth token handling, and PostgREST query parameter injection."

**performance**: "Check for unnecessary re-renders, missing React memo/useMemo/useCallback where appropriate, N+1 PostgREST queries, large bundle imports, and memory leaks in useEffect cleanup."

**correctness**: "Verify logic correctness: proper null checks, correct async/await usage, proper error handling, correct TypeScript types, and adherence to Recept schema (recipes -> ingredients/instructions/categories relationships)."

## Phase 3: Severity Validation

For each severity level (P0, P1, P2) that has findings, spawn a validation agent:

"You are a validator. Review these findings against the actual codebase. For each finding, determine: CONFIRMED (real issue), DOWNGRADED (lower severity), or DISMISSED (false positive). Provide evidence for your decision."

Only spawn agents for severity levels that have findings.

## Recept-Specific Checks

### Security (Critical)

- **RLS bypass**: All tables use `request.jwt.claims->>'email'` for ownership. INSERT/UPDATE/DELETE must be owner-only.
- **JWT handling**: Auth via `login()`, `signup()`, `signup_provider()`, `reset_password()` functions.
- **PostgREST injection**: Check for unsanitized query parameters passed to PostgREST REST API calls.
- **SQL injection in migrations**: Flyway migrations (`flyway/sql/V*__.sql`) must use parameterized queries.

### Correctness

- **Atomic operations**: Recipe mutations must use `insert_recipe()` / `update_recipe()` functions — never direct table inserts for recipes with categories/ingredients/instructions.
- **Swedish text search**: Full-text search via `recipes_and_categories` view's `full_tsv` column with Swedish configuration.
- **Schema relationships**: `ingredients` and `instructions` belong to `recipes`; `recipe_categories` is many-to-many junction table.

### Architecture

- **Monorepo structure**: Frontend in `apps/web`, email service in `apps/email-service`, shared packages in `packages/`.
- **API layer**: PostgREST on port 4444, plus TanStack Start server functions and API routes for auth and AI features.
- **Database migrations**: Flyway versioned migrations in `flyway/sql/V{version}__{description}.sql`.

## Scope Guidelines

| Size       | Lines     | Recommendation               |
| ---------- | --------- | ---------------------------- |
| Ideal      | 200-1000  | Fast, thorough               |
| Acceptable | 1000-2000 | May be slower                |
| Large      | >2000     | Warn user, suggest splitting |

**Include**: Changed files, related files, test files
**Exclude**: node_modules, .next, build artifacts, generated files

## Post-Review

After completing the review, touch the marker file to prevent the Stop hook from re-triggering:

```bash
touch .claude/.last-review
```

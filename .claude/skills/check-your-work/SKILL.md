---
name: check-your-work
description: Orchestrates 6 quality agents in parallel (duplicate-detector, user-intent, deep-bug-hunter, security, performance, correctness) with severity validation. Use when user says "check your work", "review what we wrote", "quality check", or after writing new features.
allowed-tools: Task, Read, Glob, Grep, Bash, AskUserQuestion
context: fork
---

# Check Your Work

> Orchestrate specialized agents to detect bugs, security issues, and quality problems in code changes.

<when_to_use>

## When to Use

Invoke when user says:

- "check your work"
- "review what we wrote"
- "quality check the new code"
- "check for bugs in [files/feature]"
- After completing feature implementation
- Before committing significant changes
</when_to_use>

<workflow>

## Workflow Overview

| Phase | Agents        | Action                                                               |
| ----- | ------------- | -------------------------------------------------------------------- |
| 1     | -             | Scope Discovery (identify files)                                     |
| 2     | 6 parallel    | All Checks (duplicate-detector, user-intent, deep-bug-hunter, security, performance, correctness) |
| 3     | up to 3       | Severity Validation (one agent per P0/P1/P2 level with findings)     |
| 4     | -             | Consolidated Report + User Decision                                  |

</workflow>

<agents>

## Agent Summary

### Phase 2 (6 Parallel)

| Agent              | Focus                                             |
| ------------------ | ------------------------------------------------- |
| duplicate-detector | Reimplemented utilities, duplicated logic          |
| user-intent        | Did we build what was requested?                   |
| deep-bug-hunter    | Logic errors, race conditions, edge cases          |
| security-reviewer  | SQL injection, RLS bypass, XSS, JWT issues         |
| performance        | Memory leaks, N+1 queries, unnecessary re-renders  |
| correctness        | Logic errors, null handling, async issues           |

### Phase 3 (up to 3 Parallel)

| Agent        | Focus                                          |
| ------------ | ---------------------------------------------- |
| p0-validator | Validates P0 findings against codebase context |
| p1-validator | Validates P1 findings against codebase context |
| p2-validator | Validates P2 findings against codebase context |

Only spawn agents for severity levels that have findings.

</agents>

<severity>

## Severity Classification

| Level | Meaning                                        | Action                              |
| ----- | ---------------------------------------------- | ----------------------------------- |
| P0    | Critical (security, data corruption, outage)   | Fix immediately                     |
| P1    | High (logic errors, performance, workflows)    | Recommend fixing before commit      |
| P2    | Medium (duplications, antipatterns, spec gaps) | Safe to commit, track issues        |
| P3    | Low (style, minor improvements)                | Optional improvements               |

</severity>

<recept_patterns>

## Recept-Specific Checks

Each agent should verify against these project patterns:

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

- **Monorepo structure**: Frontend in `apps/frontend`, email service in `apps/email-service`, shared packages in `packages/`.
- **API layer**: PostgREST on port 4444, not custom API routes (except Next.js server actions/API routes for auth).
- **Database migrations**: Flyway versioned migrations in `flyway/sql/V{version}__{description}.sql`.

</recept_patterns>

<scope>

## Scope Guidelines

| Size       | Lines     | Recommendation               |
| ---------- | --------- | ---------------------------- |
| Ideal      | 200-1000  | Fast, thorough               |
| Acceptable | 1000-2000 | May be slower                |
| Large      | >2000     | Warn user, suggest splitting |

**Include**: Changed files, related files, test files
**Exclude**: node_modules, .next, build artifacts, generated files

</scope>

<critical_rule>

## Critical Rule: Report ALL Bugs

Report ALL bugs found in reviewed files regardless of when they were introduced. A bug discovered today that was written months ago is still a bug.

**Invalid reasoning:**
- "This is pre-existing code unrelated to the current feature"
- "I didn't introduce this bug in this session"

**Correct approach:**
- Report ALL bugs found in the reviewed files
- Classify by severity (P0-P3) based on impact, not origin
- Let the user decide which to fix

</critical_rule>

<execution>

## Phase 1: Scope Discovery

1. Use `git diff --name-only HEAD` to identify modified files
2. Filter to .ts, .tsx, .sql files (exclude generated types, node_modules)
3. Count total lines
4. If >2000 lines, use AskUserQuestion to confirm scope

## Phase 2: All Checks (6 Parallel)

Launch ALL 6 agents in a single message with multiple Task calls (`subagent_type: "general-purpose"`).

Provide each agent:
- List of files to review (read the actual file contents)
- Recept-specific patterns from the section above
- Instruction to output findings as: `{severity: P0-P3, file, line, description, evidence}`

### Agent Prompts

**duplicate-detector**: "Search the codebase for existing utilities, helpers, or patterns that duplicate logic in the changed files. Check `packages/shared/`, `apps/frontend/lib/`, and `apps/email-service/src/` for existing implementations."

**user-intent**: "Read the git diff and recent conversation context. Verify the implementation matches what was requested. Check for missing requirements, partial implementations, or misunderstood specifications."

**deep-bug-hunter**: "Analyze the changed code for logic errors, race conditions, off-by-one errors, unhandled edge cases, null/undefined issues, and incorrect assumptions. Pay attention to recipe operations using `insert_recipe()`/`update_recipe()` and PostgREST API calls."

**security-reviewer**: "Check for RLS bypass (missing JWT email claim checks), SQL injection in migrations, XSS in React components, exposed secrets, improper auth token handling, and PostgREST query parameter injection."

**performance**: "Check for unnecessary re-renders, missing React memo/useMemo/useCallback where appropriate, N+1 PostgREST queries, large bundle imports, and memory leaks in useEffect cleanup."

**correctness**: "Verify logic correctness: proper null checks, correct async/await usage, proper error handling, correct TypeScript types, and adherence to Recept schema (recipes → ingredients/instructions/categories relationships)."

## Phase 3: Severity Validation

For each severity level (P0, P1, P2) that has findings, spawn a validation agent:

"You are a validator. Review these findings against the actual codebase. For each finding, determine: CONFIRMED (real issue), DOWNGRADED (lower severity), or DISMISSED (false positive). Provide evidence for your decision."

## Phase 4: Report + User Decision

Present findings grouped by severity (P0, P1, P2, P3) and use AskUserQuestion:

```typescript
{
  questions: [{
    question: "What would you like to do with these findings?",
    header: "Action",
    options: [
      { label: "Fix P0 now", description: "Fix critical issues immediately" },
      { label: "Fix P0+P1", description: "Fix critical and high issues" },
      { label: "Report only", description: "Note findings without fixing" }
    ],
    multiSelect: false
  }]
}
```

</execution>

<approval_gates>

## Approval Gates

| Gate        | Phase | Question                                               |
| ----------- | ----- | ------------------------------------------------------ |
| Scope       | 1     | "Confirm files to review?" (if >2000 lines)            |
| Remediation | 4     | "Fix P0 now / Fix P0+P1 / Report only?"                |

</approval_gates>

<limitations>

## Post-Review

After completing the review, touch the marker file to prevent the Stop hook from re-triggering:

```bash
touch .claude/.last-review
```

</post_review>

<limitations>

## What This Skill Does NOT Check

- Runtime behavior (use manual testing)
- Business logic correctness (requires domain knowledge)
- Test coverage (use test runner)
- Build errors (use `pnpm build`)
- Database migrations (test with Flyway)

</limitations>

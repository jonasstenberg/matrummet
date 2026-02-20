# Orchestrator Instructions — check-your-code

## Severity Classification

| Level | Meaning                                        | Action                |
| ----- | ---------------------------------------------- | --------------------- |
| P0    | Critical quality (major pattern violations)    | Fix before commit     |
| P1    | High (architecture violations, poor structure) | Recommend fixing      |
| P2    | Medium (readability, minor pattern deviations) | Safe to commit, track |
| P3    | Low (style preferences, optional improvements) | Optional              |

Quality P0s are less urgent than bug P0s. A quality P0 means "this is very poorly written" not "this will break production."

## Critical Rule: Report ALL Issues

Report ALL quality issues found in reviewed files regardless of when they were introduced. A pre-existing pattern violation is still a pattern violation. Classify by severity based on impact, not origin. Let the user decide which to address.

## Phase 2: Agent Prompts (5 Parallel)

Launch ALL 5 agents in a single message with multiple Task calls (`subagent_type: "general-purpose"`). Provide each agent the file contents, recept patterns below, and CLAUDE.md conventions.

**pattern-enforcer**: "Check code against Recept project conventions: PostgREST API usage, recipe mutations via insert_recipe()/update_recipe(), Flyway migration naming, RLS patterns with JWT email claims, Swedish text search configuration, monorepo workspace imports. Read CLAUDE.md for full conventions."

**react-quality**: "Review React component quality: proper use of React 19 features, appropriate component decomposition, correct hook usage, proper prop typing with TypeScript, Radix UI component integration, Tailwind v4 styling consistency."

**architecture**: "Evaluate separation of concerns: Is business logic properly separated from UI? Are module boundaries clear? Is there appropriate use of the monorepo structure (shared packages vs app-specific code)? Are database concerns properly isolated?"

**readability**: "Apply the 30-second rule: Can each function be understood within 30 seconds? Check naming quality, cyclomatic complexity, nesting depth, function length, and whether code is self-documenting."

**ai-smell-detector**: "Detect AI over-engineering: unnecessary abstractions for one-time operations, premature generalization, over-complex type hierarchies, wrapper functions that add no value, configuration for things that won't change, unused flexibility."

## Phase 3: Red Team Challenge

Launch 1 agent to challenge ALL findings from Phase 2:

"You are a devil's advocate. Challenge every finding from the quality review. For each, determine: CONFIRMED (real quality issue), DOWNGRADED (lower severity than claimed), DISMISSED (false positive or acceptable tradeoff), or UPGRADED (worse than initially assessed). Provide evidence."

## Recept-Specific Quality Checks

### Pattern Adherence

| Pattern                    | Correct Usage                                                    |
| -------------------------- | ---------------------------------------------------------------- |
| Recipe mutations           | Use `insert_recipe()` / `update_recipe()`, never direct inserts  |
| API calls                  | Use PostgREST REST API via fetch, not custom API routes          |
| Auth                       | JWT via PostgREST `login()`/`signup()` functions                 |
| Database migrations        | Flyway `V{version}__{description}.sql` naming convention         |
| Search                     | Swedish `to_tsvector('swedish', ...)` for full-text search       |
| RLS policies               | `request.jwt.claims->>'email'` for ownership checks              |
| Monorepo imports           | Use workspace packages (`@recept/shared`, `@recept/testing`)     |

### Architecture

| Principle                  | Application in Recept                                            |
| -------------------------- | ---------------------------------------------------------------- |
| Frontend structure         | Next.js 16 App Router with React 19                              |
| Styling                    | Tailwind v4 + Radix UI components                                |
| State management           | React 19 patterns (use, server components where appropriate)     |
| API layer                  | PostgREST (port 4444) — no ORM, no custom API layer              |
| Shared code                | `packages/` for cross-app utilities                              |

### Readability

- Functions should be understandable within 30 seconds
- Prefer descriptive names over comments
- Keep components focused on single responsibility
- Avoid deep nesting (max 3 levels)

## Scope Guidelines

| Size       | Lines     | Recommendation               |
| ---------- | --------- | ---------------------------- |
| Ideal      | 200-1000  | Fast, thorough               |
| Acceptable | 1000-2000 | Acceptable                   |
| Large      | >2000     | Warn user, suggest splitting |

**Include**: Changed files, related files
**Exclude**: node_modules, .next, build artifacts, test files, generated types

## Post-Review

After completing the review, touch the marker file to prevent the Stop hook from re-triggering:

```bash
touch .claude/.last-review
```

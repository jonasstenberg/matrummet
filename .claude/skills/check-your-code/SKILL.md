---
name: check-your-code
description: Reviews code quality, pattern adherence, and architecture with red-team validation. Use when user says "check your code", "code quality review", "is this well-written", or "review code quality". Different from check-your-work which finds bugs.
allowed-tools: Task, Read, Glob, Grep, Bash, AskUserQuestion
context: fork
---

# Check Your Code

> Review code quality, pattern adherence, and architecture — focused on "Is this well-written?" not "Will this break?"

<when_to_use>

## When to Use

Invoke when user says:

- "check your code"
- "code quality review"
- "is this well-written"
- "review code quality"
- "did you follow the patterns"

**Different from check-your-work**: check-your-work finds bugs and security issues. check-your-code evaluates code quality (pattern adherence, architecture, readability).
</when_to_use>

<workflow>

## Workflow Overview

| Phase | Agents     | Action                                           |
| ----- | ---------- | ------------------------------------------------ |
| 1     | -          | Scope Discovery (identify files)                 |
| 2     | 5 parallel | Quality Review (all agents at once)              |
| 3     | 1          | Red Team - Challenge Findings (devil's advocate) |
| 4     | -          | Report + User Decision                           |

</workflow>

<agents>

## Agent Summary

### Phase 2 (5 Parallel)

| Agent             | Focus                                             |
| ----------------- | ------------------------------------------------- |
| pattern-enforcer  | CLAUDE.md and project convention compliance        |
| react-quality     | Component design, hooks, state management          |
| architecture      | Separation of concerns, module boundaries          |
| readability       | 30-second rule, naming, complexity                 |
| ai-smell-detector | Over-engineering, unnecessary abstractions         |

### Phase 3 (Red Team)

| Agent          | Focus                                          |
| -------------- | ---------------------------------------------- |
| devil-advocate | Challenge all findings, reduce false positives |

</agents>

<severity>

## Severity Classification

| Level | Meaning                                        | Action                |
| ----- | ---------------------------------------------- | --------------------- |
| P0    | Critical quality (major pattern violations)    | Fix before commit     |
| P1    | High (architecture violations, poor structure) | Recommend fixing      |
| P2    | Medium (readability, minor pattern deviations) | Safe to commit, track |
| P3    | Low (style preferences, optional improvements) | Optional              |

Quality P0s are less urgent than bug P0s. A quality P0 means "this is very poorly written" not "this will break production."
</severity>

<recept_patterns>

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

</recept_patterns>

<scope>

## Scope Guidelines

| Size       | Lines     | Recommendation               |
| ---------- | --------- | ---------------------------- |
| Ideal      | 200-1000  | Fast, thorough               |
| Acceptable | 1000-2000 | Acceptable                   |
| Large      | >2000     | Warn user, suggest splitting |

**Include**: Changed files, related files
**Exclude**: node_modules, .next, build artifacts, test files, generated types

</scope>

<critical_rule>

## Critical Rule: Report ALL Issues

Report ALL quality issues found in reviewed files regardless of when they were introduced.

**Invalid reasoning:**
- "This is pre-existing code unrelated to the current feature"
- "I didn't write this code in this session"

**Correct approach:**
- Report ALL quality issues found in the reviewed files
- Classify by severity (P0-P3) based on impact, not origin
- Let the user decide which to address

</critical_rule>

<execution>

## Phase 1: Scope Discovery

1. Use `git diff --name-only` to identify modified files
2. Filter to .ts, .tsx, .sql files (exclude generated types)
3. Count total lines
4. If >2000 lines, use AskUserQuestion to confirm scope

## Phase 2: Quality Review (5 Parallel)

Launch ALL 5 agents in a single message with multiple Task calls (`subagent_type: "general-purpose"`).

Provide each agent:
- List of files to review (read the actual file contents)
- Recept patterns from the section above
- CLAUDE.md content for project conventions

### Agent Prompts

**pattern-enforcer**: "Check code against Recept project conventions: PostgREST API usage, recipe mutations via insert_recipe()/update_recipe(), Flyway migration naming, RLS patterns with JWT email claims, Swedish text search configuration, monorepo workspace imports. Read CLAUDE.md for full conventions."

**react-quality**: "Review React component quality: proper use of React 19 features, appropriate component decomposition, correct hook usage, proper prop typing with TypeScript, Radix UI component integration, Tailwind v4 styling consistency."

**architecture**: "Evaluate separation of concerns: Is business logic properly separated from UI? Are module boundaries clear? Is there appropriate use of the monorepo structure (shared packages vs app-specific code)? Are database concerns properly isolated?"

**readability**: "Apply the 30-second rule: Can each function be understood within 30 seconds? Check naming quality, cyclomatic complexity, nesting depth, function length, and whether code is self-documenting."

**ai-smell-detector**: "Detect AI over-engineering: unnecessary abstractions for one-time operations, premature generalization, over-complex type hierarchies, wrapper functions that add no value, configuration for things that won't change, unused flexibility."

## Phase 3: Red Team Challenge

Launch 1 agent to challenge ALL findings from Phase 2:

"You are a devil's advocate. Challenge every finding from the quality review. For each, determine: CONFIRMED (real quality issue), DOWNGRADED (lower severity than claimed), DISMISSED (false positive or acceptable tradeoff), or UPGRADED (worse than initially assessed). Provide evidence."

## Phase 4: Report + User Decision

Present findings grouped by severity and use AskUserQuestion:

```typescript
{
  questions: [{
    question: "What would you like to do with these findings?",
    header: "Action",
    options: [
      { label: "Improve now", description: "Fix the quality issues before committing" },
      { label: "Accept as-is", description: "Proceed without changes" },
      { label: "Discuss findings", description: "Review specific issues in detail" }
    ],
    multiSelect: false
  }]
}
```

</execution>

<approval_gates>

## Approval Gates

| Gate   | Phase | Question                                         |
| ------ | ----- | ------------------------------------------------ |
| Scope  | 1     | "Review these files?" (if >2000 lines)           |
| Action | 4     | "Improve now / Accept as-is / Discuss findings?" |

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

- Bugs and correctness (use check-your-work)
- Security vulnerabilities (use check-your-work)
- Test coverage (use test runner)
- Build errors (use `pnpm build`)
- Runtime behavior (use manual testing)

For comprehensive quality: Run check-your-code + check-your-work + `pnpm build` + `pnpm test`
</limitations>

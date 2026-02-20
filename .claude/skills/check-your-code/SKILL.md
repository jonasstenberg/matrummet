---
name: check-your-code
version: 1.0.0
description: Reviews code quality, pattern adherence, and architecture with red-team validation. Use when user says "check your code", "code quality review", "is this well-written", or "review code quality". Different from check-your-work which finds bugs.
allowed-tools: Task, Read, Glob, Grep, Bash, AskUserQuestion
context: fork
---

# Check Your Code

> Review code quality, pattern adherence, and architecture — focused on "Is this well-written?" not "Will this break?"

**Different from check-your-work**: check-your-work finds bugs and security issues. check-your-code evaluates code quality.

<when_to_use>

## When to Use

Invoke when user says:

- "check your code"
- "code quality review"
- "is this well-written"
- "review code quality"
- "is this clean code"

</when_to_use>

<workflow>

## Workflow

| Phase | Action                              | Gate              |
| ----- | ----------------------------------- | ----------------- |
| 1     | Identify modified files             | -                 |
| 2     | Spawn 5 parallel quality reviewers  | -                 |
| 3     | Run red team challenge              | -                 |
| 4     | Present findings with severity      | User decision     |

</workflow>

<execution>

## Execution

### Phase 1: Scope Discovery

1. Use `git diff --name-only` to identify modified files
2. Filter to .ts, .tsx, .sql files (exclude generated types)
3. Count total lines; if >2000, use AskUserQuestion to confirm scope

### Phase 2-3: Spawn Orchestrator Agent

Launch a single Task agent (`subagent_type: "general-purpose"`) with this prompt:

> Read `.claude/skills/check-your-code/references/orchestrator-instructions.md` for severity rules, agent prompts, recept patterns, and critical rules. Then execute Phase 2 (5 parallel quality reviewers) and Phase 3 (red team challenge). Return all findings with severity levels.

Provide the agent: list of files with contents, and CLAUDE.md path.

### Phase 4: Report + User Decision

Present findings grouped by severity. Touch `.claude/.last-review`. Use AskUserQuestion:

- **Improve now** — Fix the quality issues before committing
- **Accept as-is** — Proceed without changes
- **Discuss findings** — Review specific issues in detail

</execution>

<quick_reference>

## Quick Reference

```bash
# Find modified files
git diff --name-only

# Run linter
pnpm check:lint

# Run type check
pnpm check:build
```

</quick_reference>

<references>

## References

- [references/orchestrator-instructions.md](references/orchestrator-instructions.md) — Agent prompts, severity rules, recept patterns

</references>

<approval_gates>

## Approval Gates

| Gate     | Phase | Question                                          |
| -------- | ----- | ------------------------------------------------- |
| Scope    | 1     | "Reviewing >2000 lines. Proceed?"                 |
| Decision | 4     | "Improve now / Accept as-is / Discuss findings?"  |

</approval_gates>

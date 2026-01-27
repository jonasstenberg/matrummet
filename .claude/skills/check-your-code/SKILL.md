---
name: check-your-code
description: Reviews code quality, pattern adherence, and architecture with red-team validation. Use when user says "check your code", "code quality review", "is this well-written", or "review code quality". Different from check-your-work which finds bugs.
allowed-tools: Task, Read, Glob, Grep, Bash, AskUserQuestion
context: fork
---

# Check Your Code

> Review code quality, pattern adherence, and architecture — focused on "Is this well-written?" not "Will this break?"

**Different from check-your-work**: check-your-work finds bugs and security issues. check-your-code evaluates code quality.

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

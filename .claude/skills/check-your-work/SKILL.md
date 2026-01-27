---
name: check-your-work
description: Orchestrates 6 quality agents in parallel (duplicate-detector, user-intent, deep-bug-hunter, security, performance, correctness) with severity validation. Use when user says "check your work", "review what we wrote", "quality check", or after writing new features.
allowed-tools: Task, Read, Glob, Grep, Bash, AskUserQuestion
context: fork
---

# Check Your Work

> Orchestrate specialized agents to detect bugs, security issues, and quality problems in code changes.

## Execution

### Phase 1: Scope Discovery

1. Use `git diff --name-only HEAD` to identify modified files
2. Filter to .ts, .tsx, .sql files (exclude generated types, node_modules)
3. Count total lines; if >2000, use AskUserQuestion to confirm scope

### Phase 2-3: Spawn Orchestrator Agent

Launch a single Task agent (`subagent_type: "general-purpose"`) with this prompt:

> Read `.claude/skills/check-your-work/references/orchestrator-instructions.md` for severity rules, agent prompts, recept-specific checks, and critical rules. Then execute Phase 2 (6 parallel reviewers) and Phase 3 (severity validation for P0/P1/P2 levels with findings). Return all findings with severity levels.

Provide the agent: list of files with contents, git diff output, and CLAUDE.md path.

### Phase 4: Report + User Decision

Present findings grouped by severity. Touch `.claude/.last-review`. Use AskUserQuestion:

- **Fix P0 now** — Fix critical issues immediately
- **Fix P0+P1** — Fix critical and high issues
- **Report only** — Note findings without fixing

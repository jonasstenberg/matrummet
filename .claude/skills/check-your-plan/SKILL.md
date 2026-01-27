---
name: check-your-plan
description: Validates AI implementation plans before execution. Use when user says "check your plan", "validate this plan", "review the plan", or "is this plan good". Launches 5 parallel validators + devil's advocate.
allowed-tools: Task, Read, Glob, Grep, AskUserQuestion
context: fork
---

# Check Your Plan

> Validate AI-generated implementation plans before execution to catch hallucinations, pattern violations, and scope creep.

<when_to_use>

## When to Use

Invoke when user says:

- "check your plan"
- "validate this plan"
- "review the plan"
- "is this plan good"
- After Claude presents an implementation plan
- Before starting significant implementation work

**Different from check-your-code/check-your-work**: Those skills review written code. check-your-plan reviews the PLAN before code is written.
</when_to_use>

<workflow>

## Workflow Overview

| Phase | Agents     | Action                                        |
| ----- | ---------- | --------------------------------------------- |
| 1     | -          | Plan Discovery (locate plan, extract content) |
| 2     | 5 parallel | Plan Validation (specialized reviewers)       |
| 3     | 1          | Devil's Advocate (challenge all findings)     |
| 4     | -          | Report + User Decision                        |

</workflow>

<agents>

## Agent Summary

### Phase 2 (5 Parallel)

| Agent                      | Focus                                                            |
| -------------------------- | ---------------------------------------------------------------- |
| completeness-checker       | All requirements addressed? Vague steps? Missing details?        |
| pattern-compliance-checker | CLAUDE.md rules? PostgREST patterns? Flyway conventions?         |
| feasibility-checker        | Hallucinated APIs? Real file paths? Valid dependencies?           |
| risk-assessor              | Security gaps? Missing error handling? Rollback plan?            |
| scope-discipline-checker   | Over-engineering? Scope creep? Simplest solution?                |

### Phase 3 (Devil's Advocate)

| Agent          | Focus                                          |
| -------------- | ---------------------------------------------- |
| devil-advocate | Challenge all findings, reduce false positives |

</agents>

<severity>

## Severity Classification

| Level | Meaning                 | Example                                                |
| ----- | ----------------------- | ------------------------------------------------------ |
| P0    | Plan will fail          | Hallucinated API, wrong file path, missing dependency  |
| P1    | Major pattern violation | Direct table insert instead of insert_recipe(), wrong migration naming |
| P2    | Could be better         | Minor pattern deviation, missing edge case             |
| P3    | Suggestion              | Over-engineering detected, style preference            |

P0 requires evidence: "File X doesn't exist" not just "might be wrong"
</severity>

<recept_checks>

## Recept-Specific Validation

### Pattern Compliance

| Check                          | Expected                                                    |
| ------------------------------ | ----------------------------------------------------------- |
| Recipe mutations               | Plan uses `insert_recipe()` / `update_recipe()`, not direct table inserts |
| API approach                   | PostgREST REST API calls, not custom API routes for data    |
| Migration format               | `flyway/sql/V{version}__{description}.sql`                  |
| Auth approach                  | JWT via PostgREST auth functions                            |
| Search implementation          | Swedish `to_tsvector` via `full_tsv` column                 |
| RLS awareness                  | Plan accounts for row-level security on mutations           |
| Monorepo structure             | Code goes in correct app/package location                   |

### Feasibility (Hallucination Detection)

- Do referenced files actually exist? (Use Glob/Grep to verify)
- Do referenced functions have correct signatures?
- Are PostgREST endpoints real? (Check against schema)
- Are npm/pnpm packages referenced actually in package.json?

### Scope Discipline

- Does plan stay focused on original request?
- Signs of over-engineering (abstractions for one-time operations)?
- Signs of scope creep (unrelated "improvements")?
- Is this the simplest solution that works?

</recept_checks>

<execution>

## Phase 1: Plan Discovery

1. Locate the plan to validate:
   - Check for plan file path in conversation context
   - Look in `.claude/plans/` for recent plan files
   - If no plan file, check if plan was stated inline in conversation

2. Extract plan content and metadata:
   - Files to be modified
   - Steps/tasks count
   - Dependencies mentioned

3. If plan >50 lines, use AskUserQuestion to confirm scope

## Phase 2: Plan Validation (5 Parallel)

Launch ALL 5 agents in a single message with multiple Task calls (`subagent_type: "general-purpose"`).

Provide each agent:
- Full plan content
- Original user request (from conversation context)
- CLAUDE.md content for project conventions

### Agent Prompts

**completeness-checker**: "Check if the plan addresses ALL requirements from the user's request. Look for vague steps like 'implement the logic' or 'handle edge cases'. Are hard parts (error handling, edge cases, testing) as detailed as easy parts? Is the plan specific enough to implement without guessing?"

**pattern-compliance-checker**: "Verify plan follows Recept conventions: PostgREST API usage (not custom routes), insert_recipe()/update_recipe() for recipe mutations, Flyway migration naming (V{version}__{description}.sql), RLS with JWT email claims, Swedish text search config, proper monorepo structure (apps/ vs packages/). Read CLAUDE.md for conventions."

**feasibility-checker**: "Verify all referenced files exist (use Glob). Check that referenced functions have correct signatures (use Grep). Verify PostgREST endpoints match the actual schema. Check that package dependencies exist in package.json. Flag any hallucinated APIs, paths, or types."

**risk-assessor**: "Evaluate: Are there security gaps (RLS bypass, XSS, injection)? Is error handling planned for failure scenarios? Are database migrations reversible? Is there a testing strategy? Could this break existing functionality?"

**scope-discipline-checker**: "Check for over-engineering: unnecessary abstractions, premature generalization, excessive configuration. Check for scope creep: unrelated 'improvements', cleaning up code not related to the task. Is this the simplest approach that satisfies the requirements?"

## Phase 3: Devil's Advocate

Launch 1 agent to challenge ALL findings from Phase 2:

"Challenge every finding from the plan validators. For each, determine: CONFIRMED, DOWNGRADED, DISMISSED, or UPGRADED. Provide evidence for your decision."

## Phase 4: Report + User Decision

Present findings grouped by severity and use AskUserQuestion:

```typescript
{
  questions: [{
    question: "How would you like to proceed with this plan?",
    header: "Action",
    options: [
      { label: "Revise plan", description: "Update plan to address P0/P1 findings" },
      { label: "Proceed as-is", description: "Accept the plan and start implementation" },
      { label: "Start over", description: "Request a completely new plan approach" }
    ],
    multiSelect: false
  }]
}
```

</execution>

<approval_gates>

## Approval Gates

| Gate   | Phase | Question                                    |
| ------ | ----- | ------------------------------------------- |
| Scope  | 1     | "Review this plan?" (if plan >50 lines)     |
| Action | 4     | "Revise plan / Proceed as-is / Start over?" |

</approval_gates>

<limitations>

## What This Skill Does NOT Check

- Runtime behavior (requires execution)
- Actual code quality (use check-your-code after implementation)
- Bug detection (use check-your-work after implementation)
- Test coverage (use test runner)
- Build errors (use `pnpm build`)

For comprehensive quality: check-your-plan (before) + check-your-code + check-your-work (after)
</limitations>

# Orchestrator Instructions — check-your-plan

## Severity Classification

| Level | Meaning                 | Example                                                |
| ----- | ----------------------- | ------------------------------------------------------ |
| P0    | Plan will fail          | Hallucinated API, wrong file path, missing dependency  |
| P1    | Major pattern violation | Direct table insert instead of insert_recipe(), wrong migration naming |
| P2    | Could be better         | Minor pattern deviation, missing edge case             |
| P3    | Suggestion              | Over-engineering detected, style preference            |

P0 requires evidence: "File X doesn't exist" not just "might be wrong"

## Phase 2: Agent Prompts (5 Parallel)

Launch ALL 5 agents in a single message with multiple Task calls (`subagent_type: "general-purpose"`). Provide each agent the full plan content, original user request, and CLAUDE.md conventions.

**completeness-checker**: "Check if the plan addresses ALL requirements from the user's request. Look for vague steps like 'implement the logic' or 'handle edge cases'. Are hard parts (error handling, edge cases, testing) as detailed as easy parts? Is the plan specific enough to implement without guessing?"

**pattern-compliance-checker**: "Verify plan follows Recept conventions: PostgREST API usage (not custom routes), insert_recipe()/update_recipe() for recipe mutations, Flyway migration naming (V{version}__{description}.sql), RLS with JWT email claims, Swedish text search config, proper monorepo structure (apps/ vs packages/). Read CLAUDE.md for conventions."

**feasibility-checker**: "Verify all referenced files exist (use Glob). Check that referenced functions have correct signatures (use Grep). Verify PostgREST endpoints match the actual schema. Check that package dependencies exist in package.json. Flag any hallucinated APIs, paths, or types."

**risk-assessor**: "Evaluate: Are there security gaps (RLS bypass, XSS, injection)? Is error handling planned for failure scenarios? Are database migrations reversible? Is there a testing strategy? Could this break existing functionality?"

**scope-discipline-checker**: "Check for over-engineering: unnecessary abstractions, premature generalization, excessive configuration. Check for scope creep: unrelated 'improvements', cleaning up code not related to the task. Is this the simplest approach that satisfies the requirements?"

## Phase 3: Devil's Advocate

Launch 1 agent to challenge ALL findings from Phase 2:

"Challenge every finding from the plan validators. For each, determine: CONFIRMED, DOWNGRADED, DISMISSED, or UPGRADED. Provide evidence for your decision."

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

## What This Skill Does NOT Check

- Runtime behavior (requires execution)
- Actual code quality (use check-your-code after implementation)
- Bug detection (use check-your-work after implementation)
- Test coverage (use test runner)
- Build errors (use `pnpm build`)

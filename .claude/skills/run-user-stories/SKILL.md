---
name: run-user-stories
version: 1.1.0
description: Run user story acceptance tests using Playwright browser automation. Executes test steps from user-stories/*.md files and reports pass/fail status with reasons. Use when user says "run user stories", "test user stories", "acceptance test", or "run e2e tests".
allowed-tools: Task, Read, Glob, Grep, Bash, AskUserQuestion, ToolSearch, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_fill_form, mcp__playwright__browser_press_key, mcp__playwright__browser_tabs, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_evaluate, mcp__playwright__browser_console_messages, mcp__playwright__browser_wait_for, mcp__playwright__browser_hover, mcp__playwright__browser_select_option
context: fork
model: sonnet
---

# Run User Stories

> Run acceptance tests from user-stories/\*.md files in a browser and report pass/fail results.

<when_to_use>

## When to Use

Invoke when user says:

- "run user stories" — runs all tests (or prompts for scope)
- "run user stories AUTH" — runs all authentication tests
- "run user stories US-AUTH-01" — runs single story by ID
- "test user stories"
- "acceptance test"
- "run e2e tests"
- "verify user stories"
- "qa test"

</when_to_use>

<arguments>

## Arguments

The skill accepts optional arguments to specify scope directly:

| Argument     | Example                                   | Description                 |
| ------------ | ----------------------------------------- | --------------------------- |
| (none)       | `/run-user-stories`                       | Prompts for scope selection |
| Story ID     | `/run-user-stories US-AUTH-01`            | Run single story            |
| Area code    | `/run-user-stories AUTH`                  | Run all stories in area     |
| Multiple IDs | `/run-user-stories US-AUTH-01 US-AUTH-02` | Run specific stories        |

Valid area codes: `AUTH`, `RECIPE`, `SEARCH`, `SHARE`, `PANTRY`, `SHOP`, `HOME`, `IMPORT`

</arguments>

<workflow>

## Workflow

| Phase | Action                      | Gate        |
| ----- | --------------------------- | ----------- |
| 1     | Select test scope           | User choice |
| 2     | Parse selected user stories | -           |
| 3     | Setup browser session       | -           |
| 4     | Execute tests sequentially  | -           |
| 5     | Generate summary report     | -           |

</workflow>

<execution>

## Execution

**IMPORTANT: Use the Playwright MCP tools (`mcp__playwright__*`) for all browser automation. Do NOT use Claude-in-Chrome tools.**

Read `.claude/skills/run-user-stories/references/runner-instructions.md` for detailed execution instructions, then execute.

### Quick Start

1. **Scope Selection**: Check arguments first, then prompt if none provided:
   - `/run-user-stories US-AUTH-01` — runs single story directly
   - `/run-user-stories AUTH` — runs all stories in an area
   - `/run-user-stories` — prompts for scope selection

2. **Environment**: Tests run against `http://localhost:3000` by default. Ensure:
   - `pnpm dev` is running
   - Database is seeded with test data
   - PostgREST is running (`postgrest postgrest.cfg`)

3. **Authentication**: Many tests require login. The runner will:
   - Use test credentials: `test@example.com` / `password123`
   - Login once at the start if auth tests are included
   - Maintain session across tests

### Single Story Example

To run just the user registration test:

```
/run-user-stories US-AUTH-01
```

This will:

1. Parse `user-stories/01-authentication.md`
2. Extract only `US-AUTH-01: User Registration`
3. Execute the test steps in the browser via Playwright
4. Report pass/fail with reason

</execution>

<test_areas>

## Test Areas

| Area ID | File                    | Stories | Description              |
| ------- | ----------------------- | ------- | ------------------------ |
| AUTH    | 01-authentication.md    | 5       | Login, register, logout  |
| RECIPE  | 02-recipe-management.md | 6       | CRUD, copy, like recipes |
| SEARCH  | 03-recipe-search.md     | 5       | Search, filter, browse   |
| SHARE   | 04-recipe-sharing.md    | 5       | Share links, anonymous   |
| PANTRY  | 05-pantry-management.md | 5       | Pantry CRUD, matching    |
| SHOP    | 06-shopping-list.md     | 6       | Shopping list features   |
| HOME    | 07-household.md         | 6       | Household management     |
| IMPORT  | 08-recipe-import.md     | 5       | URL import, AI parsing   |

</test_areas>

<result_format>

## Result Format

Results are presented in a structured summary:

```
## Test Results Summary

**Passed**: 12 | **Failed**: 3 | **Skipped**: 2

### Failed Tests

| Story ID     | Title              | Reason                           |
| ------------ | ------------------ | -------------------------------- |
| US-AUTH-02   | User Login         | Password field not found         |
| US-RECIPE-01 | Create New Recipe  | Save button disabled             |

### Passed Tests

| Story ID     | Title              |
| ------------ | ------------------ |
| US-AUTH-01   | User Registration  |
| US-AUTH-05   | Logout             |
...

### Skipped Tests

| Story ID     | Title              | Reason                           |
| ------------ | ------------------ | -------------------------------- |
| US-AUTH-03   | Google OAuth       | Requires manual OAuth flow       |
```

</result_format>

<skip_criteria>

## Skip Criteria

Some tests are automatically skipped:

- **OAuth tests** (US-AUTH-03): Require manual Google flow
- **Email tests** (US-AUTH-04): Require email delivery verification
- **AI parsing tests** (US-IMPORT-03): Require AI credits
- **Household shared tests**: Require multiple browser sessions

Mark these as "Skipped" with reason in the report.

</skip_criteria>

<references>

## References

- [references/runner-instructions.md](references/runner-instructions.md) — Detailed test execution logic
- [user-stories/README.md](../../../user-stories/README.md) — User story format documentation

</references>

<approval_gates>

## Approval Gates

| Gate  | Phase | Question                                        |
| ----- | ----- | ----------------------------------------------- |
| Scope | 1     | "Which tests to run? All / Area / Single story" |

</approval_gates>

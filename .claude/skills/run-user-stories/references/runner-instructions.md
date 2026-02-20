# User Story Test Runner Instructions

Execute user story acceptance tests using Playwright browser automation.

**CRITICAL: Use the Playwright MCP tools (`mcp__playwright__*`) for all browser interactions. Do NOT use Claude-in-Chrome or any other browser automation tools.**

## Phase 1: Scope Selection

### Check for Arguments First

If the skill was invoked with arguments, parse them to determine scope:

1. **Story ID pattern** (e.g., `US-AUTH-01`): Run that single story
2. **Area code** (e.g., `AUTH`, `RECIPE`): Run all stories in that area
3. **Multiple arguments**: Run each specified story/area
4. **No arguments**: Prompt user for scope selection

Valid area codes: `AUTH`, `RECIPE`, `SEARCH`, `SHARE`, `PANTRY`, `SHOP`, `HOME`, `IMPORT`

### Argument Parsing Examples

| Input                          | Scope                                    |
| ------------------------------ | ---------------------------------------- |
| `US-AUTH-01`                   | Single story: US-AUTH-01                 |
| `AUTH`                         | All 5 stories in 01-authentication.md    |
| `US-AUTH-01 US-AUTH-02`        | Two specific stories                     |
| `AUTH RECIPE`                  | All AUTH + all RECIPE stories            |
| (empty)                        | Prompt user                              |

### Prompt if No Arguments

Use `AskUserQuestion` only if no arguments provided:

```
Which user stories should I run?

Options:
1. All stories (full regression - ~43 tests)
2. Specific area
3. Single story by ID
```

If "Specific area", follow up with:
```
Which area?

Options:
- AUTH (Authentication - 5 tests)
- RECIPE (Recipe Management - 6 tests)
- SEARCH (Recipe Search - 5 tests)
- SHARE (Recipe Sharing - 5 tests)
- PANTRY (Pantry Management - 5 tests)
- SHOP (Shopping Lists - 6 tests)
- HOME (Household - 6 tests)
- IMPORT (Recipe Import - 5 tests)
```

## Phase 2: Parse User Stories

1. Read the appropriate user-stories/*.md files based on scope
2. Extract each story using this pattern:

```
## US-[AREA]-[NUM]: [Title]

**As a** [user type]
**I want to** [action]
**So that** [benefit]

### Preconditions
- [conditions]

### Test Steps
1. [steps]

### Expected Outcome
- [outcomes]

### Acceptance Criteria
- [ ] [criteria]
```

3. Build a test queue with structure:
```typescript
interface TestCase {
  id: string;           // US-AUTH-01
  title: string;        // User Registration
  area: string;         // AUTH
  preconditions: string[];
  steps: string[];
  expectedOutcome: string[];
  acceptanceCriteria: string[];
  skipReason?: string;  // If auto-skipped
}
```

## Phase 3: Setup Browser Session

Use ToolSearch to load the Playwright MCP tools. Search for `+playwright` to find tools like `mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_click`, etc.

1. Open the app at `http://localhost:3000`
2. Verify the page loads correctly
3. Check that no console errors appear

## Phase 4: Execute Tests

### Test Credentials
- Email: `test@example.com`
- Password: `password123`

### Auto-Skip Rules

Mark these stories as SKIPPED before execution:

| Story ID      | Reason                                    |
| ------------- | ----------------------------------------- |
| US-AUTH-03    | Google OAuth requires manual flow         |
| US-AUTH-04    | Password reset requires email verification|
| US-PANTRY-04  | Household pantry requires multiple users  |
| US-HOME-03    | Join household requires second user       |
| US-HOME-04    | View members requires multiple users      |
| US-HOME-06    | Share recipes requires multiple users     |
| US-IMPORT-03  | AI parsing requires credits               |

### Execution Loop

For each test case:

1. Log: "Running [test.id]: [test.title]"
2. Check skip rules - if skipped, record status and continue
3. Set up preconditions (login if needed, create test data if needed)
4. Execute test steps by interacting with the browser
5. Verify expected outcomes by checking page content
6. Record PASS or FAIL with reason

### Swedish UI Text

The app is in Swedish. Common button/link text:
- "Registrera" = Register
- "Logga in" = Login
- "Logga ut" = Logout
- "Spara" = Save
- "Radera" = Delete
- "Redigera" = Edit
- "Sök" = Search
- "Lägg till" = Add
- "Dela" = Share
- "Kopiera" = Copy

### Login Flow

When a test requires authentication:

1. Go to the login page at /login
2. Enter `test@example.com` in the email field
3. Enter `password123` in the password field
4. Click the login button
5. Wait for redirect to /mina-recept
6. Confirm the user menu is visible in the header

### Logout Flow

1. Click the user menu in the header
2. Click "Logga ut" in the dropdown
3. Confirm redirect to login page

### Creating a Test Recipe

When a test needs an existing recipe:

1. Go to /recept/nytt
2. Enter a recipe name like "Testrecept"
3. Add at least one ingredient
4. Add at least one instruction step
5. Click "Spara"
6. Note the recipe ID from the URL

## Phase 5: Generate Summary Report

After all tests complete, generate report:

```markdown
## Test Results Summary

**Run**: [timestamp]
**Scope**: [All | Area: X | Story: US-X-XX]
**Base URL**: http://localhost:3000

---

**Passed**: X | **Failed**: Y | **Skipped**: Z | **Total**: N

### Failed Tests

| Story ID | Title | Step Failed | Reason |
| -------- | ----- | ----------- | ------ |
| US-X-XX  | ...   | Step N      | ...    |

### Passed Tests

| Story ID | Title |
| -------- | ----- |
| US-X-XX  | ...   |

### Skipped Tests

| Story ID | Title | Reason |
| -------- | ----- | ------ |
| US-X-XX  | ...   | ...    |

---

### Recommendations

[If failures exist, provide actionable suggestions]
```

## Error Handling

- **Element not found**: Wait briefly, try alternative ways to find it, then fail with clear description
- **Page timeout**: Allow reasonable time for load, then fail with URL
- **Unexpected state**: Take a screenshot, describe what's wrong
- **Console errors**: Check for JavaScript errors and include critical ones in failure reason

## Test Data Requirements

The following test data should exist in the database:

- User: `test@example.com` with password `password123`
- At least one recipe owned by test user
- At least one category (e.g., "Middag")
- Ingredient database populated

If test data is missing, report as precondition failure, not test failure.

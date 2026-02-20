# Story Phases — story-to-ship

## Phase 1: Parse Feature Description

If arguments provided, extract intent. Otherwise ask user to describe the feature.

Use AskUserQuestion to confirm:

1. **Feature Area** — Which area does this belong to?
   - AUTH (authentication)
   - RECIPE (recipe management)
   - SEARCH (search and browse)
   - SHARE (sharing features)
   - PANTRY (pantry management)
   - SHOP (shopping lists)
   - HOME (household management)
   - IMPORT (recipe import)

2. **User Type** — Who is the user? (e.g., "registered user", "household member", "anonymous visitor")

3. **Core Action** — What do they want to do?

4. **Benefit** — Why do they want to do it?

5. **Preconditions** — What must be true before the test?

## Phase 2: Create User Story

### Determine Story ID

Read the target file in `user-stories/` to find the next available story number.

Example: If `01-authentication.md` has US-AUTH-01 through US-AUTH-05, the next story is US-AUTH-06.

### File Mapping

| Area   | File                        |
| ------ | --------------------------- |
| AUTH   | 01-authentication.md        |
| RECIPE | 02-recipe-management.md     |
| SEARCH | 03-recipe-search.md         |
| SHARE  | 04-recipe-sharing.md        |
| PANTRY | 05-pantry-management.md     |
| SHOP   | 06-shopping-list.md         |
| HOME   | 07-household.md             |
| IMPORT | 08-recipe-import.md         |

### Generate Story

Use this exact template:

```markdown
---

## US-[AREA]-[NUMBER]: [Title]

**As a** [user type]
**I want to** [action]
**So that** [benefit]

### Preconditions
- [Precondition 1]
- [Precondition 2]

### Test Steps
1. [Step 1 - actionable, specific]
2. [Step 2]
3. [Continue until complete flow]

### Expected Outcome
- [What should happen when steps complete]

### Acceptance Criteria
- [ ] [Specific, testable requirement 1]
- [ ] [Specific, testable requirement 2]
- [ ] [Continue until all requirements covered]
```

### Present for Approval

Show the generated user story to the user via AskUserQuestion:
- "Approve" — Save and continue
- "Edit" — Let user provide corrections, regenerate
- "Cancel" — Stop the skill

### Save Story

Append the story to the appropriate file in `user-stories/` using Edit tool.

**IMPORTANT**: Always append at the end of the file. The story separator is `---` on its own line.

Record the story ID (e.g., `US-AUTH-06`) for use in Phase 4.

## Phase 3: Implement via ship-it

Invoke the ship-it skill:

```
Skill: ship-it
```

Pass context: "Implement user story [STORY-ID]: [Title]"

The ship-it skill will:
1. Explore codebase
2. Plan implementation
3. Validate plan
4. Implement changes
5. Check work
6. Check code
7. **Validate** (test + lint + acceptance test) — fix loop until all pass
8. **Commit** — only after validation passes

**IMPORTANT**: Pass the `STORY_ID` in the context so ship-it knows which story to validate in Phase 7. The acceptance test runs BEFORE commit, ensuring every commit represents validated, working code.

Thread the user story content through to ship-it so it has full context of requirements.

## Phase 4: Completion

ship-it now handles both validation AND commit. When ship-it completes:

- Phase 7 has already run the acceptance test via `Skill: run-user-stories [STORY-ID]`
- Phase 8 has committed the validated code

### Results

If ship-it completes successfully:
- Acceptance test passed
- Code is committed
- Feature is complete and shipped
- Report success to user

If ship-it exits with validation failures (user chose to skip):
- Warn user that the feature may not work as specified
- Document the gap in the user story or as a known issue

## Context Management

1. **Story ID is key** — Thread the story ID through all phases for validation
2. **ship-it is self-contained** — It manages its own phases and context
3. **Summarize between phases** — Keep cross-phase context lean
4. **Validation output** — run-user-stories returns structured pass/fail, use that for decisions

## Error Handling

| Error                          | Action                                      |
| ------------------------------ | ------------------------------------------- |
| File doesn't exist             | Create new area file with header            |
| Story ID conflict              | Re-read file, recalculate next ID           |
| ship-it fails mid-pipeline     | Let user decide: resume, restart, or cancel |
| Validation times out           | Retry once, then ask user                   |
| Browser automation unavailable | Skip validation, warn user                  |

## Guidelines

- **Test steps must be browser-automatable** — Use specific selectors, URLs, visible text
- **Acceptance criteria must be verifiable** — Each item should be checkable in browser state
- **Don't over-specify** — Keep stories focused on one user goal
- **Thread context** — ship-it and run-user-stories need the story ID and content

# Phase 01 Plan 03: Home Page UX Redesign Summary

---
phase: 01-extract-hemmet-to-standalone-page
plan: 03
subsystem: frontend-ui
status: complete
tags: [ui, ux, card-layout, form-ux, home-management]
requires: [01-01]
provides: [card-separated-layout, clear-invite-methods]
affects: [03-01]

tech-stack:
  added: []
  patterns: [card-section-separation, help-text-pattern]

key-files:
  created: []
  modified:
    - apps/frontend/components/home/home-settings.tsx
    - apps/frontend/components/home/home-invite-section.tsx

decisions:
  - id: "01-03-card-separation"
    what: "Split single monolithic Card into 4 separate Cards"
    why: "SC-03 requires 'clearly separated sections' - Card boundaries provide better visual hierarchy than inline Separators"
    impact: "Each section now has clear title+description, easier to scan, better information architecture"

  - id: "01-03-invite-order"
    what: "Put join link first, email invite second (opposite of previous order)"
    why: "Join link is simpler flow (just generate and share), email requires exact address and triggers notification"
    impact: "Users see easier option first, reducing cognitive load"

  - id: "01-03-remove-eller"
    what: "Remove 'eller' divider between invite methods"
    why: "REQ-07 requires 'not confusing users about which method to use' - 'eller' implies mutual exclusion when both can be used"
    impact: "Clearer that both methods are available simultaneously, not either/or choice"

metrics:
  tasks: 2
  commits: 2
  files_modified: 2
  duration: 2min
  completed: 2026-01-27
---

**One-liner:** Redesigned home settings from single dense Card to 4 clear sections, reordered invite methods (link-first), and added descriptive help text for each action.

## What Changed

### Layout Restructure (Task 1)

**Before:** Single Card with all content (home info, members, invites, danger zone) separated by horizontal Separator dividers.

**After:** 4 separate Cards, each with descriptive CardHeader:

1. **Hemmet** - Name and basic info
2. **Medlemmar ({count})** - Member list with inline count
3. **Bjud in medlem** - Invite flow with e-post and delningslänk options
4. **Farozon** - Danger zone with destructive styling (red title, red border)

**Key improvements:**
- Clear visual hierarchy through Card boundaries instead of inline dividers
- Descriptive subtitles explain each section's purpose
- Member count in title provides instant context
- Destructive styling on danger zone signals risk
- Removed all Separator components (no longer needed)

### Invite Flow Simplification (Task 2)

**Before:**
- Email form labeled "Via e-post" (first)
- "eller" divider with horizontal line
- Join link labeled "Dela denna länk" (second)
- No help text explaining methods

**After:**
- Join link section first with heading "Inbjudningslänk"
- Help text: "Skapa en länk som du kan skicka till den du vill bjuda in. Länken är giltig i 7 dagar."
- Email section second with heading "Bjud in via e-post"
- Help text: "Skicka en inbjudan direkt till en e-postadress. Mottagaren får ett mejl med instruktioner."
- No divider (eliminates false mutual exclusion)

**Key improvements:**
- Simpler method (link) comes first
- Descriptive headings replace vague labels
- Help text explains WHAT and HOW for each method
- Removed confusing "eller" divider
- Increased spacing (space-y-8) for better visual separation
- Bolder headings (font-semibold) for clarity

## Why This Matters

**Problem solved:** The original layout was dense and hard to scan. Users had to parse a single large Card with inline dividers. The invite flow had vague labels ("Via e-post", "Dela denna länk") and a confusing "eller" divider that suggested mutual exclusivity.

**User impact:**
- Users can now quickly scan 4 distinct sections with clear titles
- Instant visibility of household member count
- Users understand what each invite method does before using it
- No confusion about whether they can use both invite methods
- Danger zone visually signals risk (red styling)

**Technical impact:**
- Cleaner component structure (4 Cards vs 1 Card with Separators)
- Better semantic HTML (CardHeader/CardTitle/CardDescription vs inline h3 tags)
- Consistent with Radix UI Card component patterns
- Easier to add/remove sections in future without disrupting layout

## Technical Details

### Files Modified

**apps/frontend/components/home/home-settings.tsx** (Task 1)
- Removed Separator import and all usage
- Replaced single Card with 4 separate Cards
- Each Card has CardHeader with CardTitle and CardDescription
- Member count interpolated in title: `Medlemmar ({home.members.length})`
- Farozon Card has `className="text-destructive"` on CardTitle
- Farozon Card has `className="border-destructive/20"` for subtle red border
- All handler functions unchanged (business logic preserved)

**apps/frontend/components/home/home-invite-section.tsx** (Task 2)
- Removed Label import (replaced by h4 headings)
- Swapped method order: join link first, email second
- Removed "eller" divider (entire div with border/text)
- Added h4 headings with `className="text-sm font-semibold"`
- Added descriptive help text with `className="text-sm text-muted-foreground"`
- Changed outer spacing from `space-y-6` to `space-y-8`
- All state management unchanged (email, isLoading, error, success)
- handleSendInvite function unchanged

### Commits

| Commit | Type | Description |
|--------|------|-------------|
| 1f408a7 | refactor | Redesign HomeSettings with 4 separate Card sections |
| 9b19fa4 | refactor | Simplify invite flow with clear method separation |

## Requirements Met

✅ **SC-03 (Clearly separated sections):** 4 distinct Cards with clear titles, not crammed together
✅ **REQ-07 (Clear invite methods):** Descriptive headings, help text, no confusing divider
✅ **Must-have: Card components for sections:** Each section wrapped in Card with CardTitle
✅ **Must-have: Invite methods with clear headings:** "Inbjudningslänk" and "Bjud in via e-post" with help text

## Testing Notes

**Build & Lint:** Both passed cleanly after each task.

**Manual verification needed:**
1. Visit `/hemmet` (or `/installningar/hemmet` before Plan 01-01)
2. Verify 4 separate Cards display vertically
3. Check Card titles: "Hemmet", "Medlemmar (N)", "Bjud in medlem", "Farozon"
4. Verify Farozon title is red and Card has subtle red border
5. Check invite section order: join link first, email second
6. Verify help text appears under each invite method heading
7. Test both invite methods work (functionality unchanged)
8. Test member removal, home name edit, leave home (all unchanged)

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Phase 1 completion blockers:** None from this plan.

**Concerns for Phase 2:**
- Card components used here will need similar pattern in settings sidebar navigation (Phase 2)
- Consider establishing Card layout pattern as reusable convention

**Concerns for Phase 3:**
- This establishes baseline UX that Phase 3 polish will build upon
- Help text pattern here could be template for other forms

## Session Notes

**Execution pattern:** Fully autonomous (no checkpoints).

**Performance:** 2min execution (under 3min target). Both tasks were straightforward refactors with no business logic changes.

**Code quality:** Clean refactor - removed complexity (Separators, vague labels, confusing divider), added clarity (Cards, descriptive text, logical ordering). Zero build/lint issues.

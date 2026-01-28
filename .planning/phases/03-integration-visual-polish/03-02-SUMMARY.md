---
phase: 03
plan: 02
subsystem: settings
tags: [ui, card-components, typography, refactor]
dependencies:
  requires: [02-02]
  provides: [unified-card-structure, clean-typography-hierarchy]
  affects: [03-03]
tech-stack:
  added: []
  patterns: [card-component-structure, responsive-padding]
key-files:
  created: []
  modified:
    - apps/frontend/app/(main)/installningar/page.tsx
    - apps/frontend/app/(main)/installningar/sakerhet/page.tsx
    - apps/frontend/app/(main)/installningar/api-nycklar/page.tsx
    - apps/frontend/app/(main)/installningar/konto/page.tsx
    - apps/frontend/components/profile-form.tsx
    - apps/frontend/components/security-form.tsx
    - apps/frontend/components/api-key-manager.tsx
    - apps/frontend/components/account-deletion-form.tsx
decisions:
  - context: Remove redundant h2 headings
    decision: Remove all page-level h2 headings from settings sub-pages
    rationale: The sidebar active state and card titles already provide sufficient context. Duplicate headings are semantically wrong and visually repetitive.
    impact: Cleaner typography hierarchy (layout h1 -> Card titles only)
  - context: Standardize to Card components
    decision: Convert all raw div.bg-card wrappers to proper Card/CardHeader/CardContent structure
    rationale: Creates visual consistency with Hemmet sub-pages (which already use Card components) and follows established component patterns.
    impact: All settings forms now have consistent structure and responsive padding
  - context: API key manager button placement
    decision: Place "Skapa ny nyckel" button inside CardHeader using flexbox layout
    rationale: Keeps action near the title/description while maintaining clean Card structure (alternative of placing outside Card would break visual unity)
    impact: Button is shrink-0 to prevent flex collapse on narrow screens
metrics:
  duration: 9min
  completed: 2026-01-28
---

# Phase 03 Plan 02: Settings Visual Unification Summary

**One-liner:** Removed redundant h2 headings and standardized all settings forms to use Card/CardHeader/CardContent structure with consistent responsive padding.

## What Was Implemented

### Task 1: Remove redundant h2 headings from settings page files
- Removed duplicate "Profil" h2 from `installningar/page.tsx`
- Removed duplicate "Säkerhet" h2 from `installningar/sakerhet/page.tsx`
- Removed duplicate "API-nycklar" h2 from `installningar/api-nycklar/page.tsx`
- Removed duplicate "Konto" h2 and description paragraph from `installningar/konto/page.tsx`
- All four settings pages now render their form components directly (minimal wrappers)

**Typography hierarchy is now:**
- Layout level: `<h1>` "Installningar" (in layout.tsx)
- Card level: `<CardTitle>` (inside each form component)

### Task 2: Standardize form components to use Card structure
- **ProfileForm:** Converted to Card with CardHeader ("Profil" / "Uppdatera ditt namn") and CardContent
- **SecurityForm:** Converted to Card with CardHeader ("Lösenord" / "Byt ditt lösenord") and CardContent
- **ApiKeyManager:** Converted to Card with flex layout in CardHeader (title/description + button) and CardContent
- **AccountDeletionForm:** Converted to Card with `border-destructive/50` className and CardHeader with `text-destructive` title

**Card component padding:**
- CardHeader: `p-6` (default)
- CardContent: `p-6 pt-0` (default)
- Responsive mobile reduction not needed (standard padding works well)

## Technical Implementation

### Before (old pattern):
```tsx
<div className="bg-card border border-border rounded-lg p-6">
  <h2 className="text-xl font-semibold mb-4">Profil</h2>
  <form>...</form>
</div>
```

### After (Card pattern):
```tsx
<Card>
  <CardHeader>
    <CardTitle>Profil</CardTitle>
    <CardDescription>Uppdatera ditt namn</CardDescription>
  </CardHeader>
  <CardContent>
    <form>...</form>
  </CardContent>
</Card>
```

### Special case (ApiKeyManager with action button):
```tsx
<Card>
  <CardHeader>
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1.5">
        <CardTitle>API-nycklar</CardTitle>
        <CardDescription>...</CardDescription>
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button className="shrink-0">...</Button>
        </DialogTrigger>
      </Dialog>
    </div>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

## Decisions Made

### 1. Remove redundant h2 headings entirely
**Context:** Settings pages had duplicate headings (sidebar active + page h2 + card h2)

**Decision:** Remove page-level h2 completely, rely on sidebar active state and card titles

**Rationale:**
- User feedback: "we have the h2 showing 'Profile' and within the card we have another h2 showing 'Profile', this is semantically wrong"
- Sidebar pill styling already indicates active section
- Card titles provide sufficient context

**Alternatives considered:**
- Keep page h2, remove card titles → Rejected (cards would lack headers)
- Use different wording for page vs card → Rejected (still redundant)

### 2. Standardize all forms to Card components
**Context:** Settings forms used raw `div.bg-card` while Hemmet pages already used Card components

**Decision:** Convert all to Card/CardHeader/CardContent structure

**Rationale:**
- Visual consistency across entire app
- Follows established component pattern
- Easier maintenance (one Card implementation)

**Impact:** All settings forms now have identical visual rhythm to Hemmet pages

## Deviations from Plan

None - plan executed exactly as written.

## Testing & Verification

### Build Verification
```bash
✓ pnpm build - All packages compiled successfully
✓ pnpm lint - No syntax or style errors
```

### Visual Verification (expected at checkpoint plan):
- [ ] No duplicate h2 headings visible on any settings page
- [ ] All forms render with Card borders and proper header/content sections
- [ ] Profile editing works (name save)
- [ ] Password change works
- [ ] API key create/revoke works
- [ ] Account deletion dialog works

## Next Phase Readiness

**Ready for:** Plan 03-03 (visual polish verification checkpoint)

**Blockers:** None

**Dependencies delivered:**
- Unified Card structure across all settings forms
- Clean typography hierarchy (no redundant headings)
- Consistent responsive padding pattern

**Notes for future work:**
- Card component responsive padding (p-6 on all sizes) works well. Only adjust if checkpoint verification identifies specific mobile issues.
- ApiKeyManager button placement pattern (flex in CardHeader) can be reused for other "header + action" scenarios

## Files Modified

### Settings Page Files (4 files)
- `apps/frontend/app/(main)/installningar/page.tsx` - Removed h2, direct render of ProfileForm
- `apps/frontend/app/(main)/installningar/sakerhet/page.tsx` - Removed h2, direct render of SecurityForm
- `apps/frontend/app/(main)/installningar/api-nycklar/page.tsx` - Removed h2, direct render of ApiKeyManager
- `apps/frontend/app/(main)/installningar/konto/page.tsx` - Removed h2 and description, direct render of AccountDeletionForm

### Form Component Files (4 files)
- `apps/frontend/components/profile-form.tsx` - Converted to Card structure with title "Profil" and description "Uppdatera ditt namn"
- `apps/frontend/components/security-form.tsx` - Converted to Card structure with title "Lösenord" and description "Byt ditt lösenord"
- `apps/frontend/components/api-key-manager.tsx` - Converted to Card structure with flex header layout and "Skapa ny nyckel" button
- `apps/frontend/components/account-deletion-form.tsx` - Converted to Card structure with destructive styling and title "Radera konto"

## Commits

| Commit | Message | Files |
|--------|---------|-------|
| f62c286 | refactor(03-02): remove redundant h2 headings from settings pages | 4 page files |
| 5036da7 | refactor(03-02): standardize settings forms to use Card components | 4 component files |

**Total:** 2 commits, 8 files modified, 9min duration

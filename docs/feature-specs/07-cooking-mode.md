# Cooking Mode

## Overview

A focused, step-by-step interface for following a recipe while cooking. Large text, one instruction at a time, ingredients visible on demand, and screen wake-lock to prevent the device from sleeping.

**Value Proposition:**
- Hands-free-friendly interface for use in the kitchen
- Reduces scrolling and squinting at small text while cooking
- Keeps screen on without manual intervention
- Leverages existing instruction and ingredient group data

## User Stories

1. Enter cooking mode from any recipe page
2. See one instruction step at a time with large, readable text
3. Swipe or tap to advance between steps
4. View ingredients for the current group/section
5. Screen stays on while cooking mode is active
6. Track progress through the recipe (step 3/8)
7. Quickly jump to any step via overview
8. Exit cooking mode and return to recipe

## UI/UX

### Layout
```
┌─────────────────────────────┐
│  ← Pasta Carbonara    3/8  │  ← header: back button, name, progress
├─────────────────────────────┤
│                             │
│                             │
│   Stek guancialen i en     │  ← large text, centered
│   torr stekpanna på        │
│   medelvärme tills den     │
│   är knaprig, ca 5 min.   │
│                             │
│                             │
├─────────────────────────────┤
│  🧾 Ingredienser (tap)     │  ← expandable ingredient panel
│  ┌─────────────────────┐   │
│  │ 200 g guanciale     │   │
│  │ 1 msk olivolja      │   │
│  └─────────────────────┘   │
├─────────────────────────────┤
│   ◀ Föregående   Nästa ▶   │  ← navigation buttons
│         ● ● ●○○○○○         │  ← step dots
└─────────────────────────────┘
```

### Mobile Gestures
- Swipe left: next step
- Swipe right: previous step
- Tap center: toggle ingredient panel
- Tap step dots: jump to step

### Desktop
- Arrow keys for navigation
- Same layout, wider content area

### Visual Design
- Dark background option to reduce glare in kitchen
- Minimum 24px body text
- High contrast for readability
- No unnecessary chrome or navigation

## Technical Implementation

### Screen Wake Lock API
```typescript
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    return await navigator.wakeLock.request('screen');
  }
  return null;
}
```
Release on exit or page visibility change. Re-acquire when page becomes visible again.

### Component Structure
```
CookingMode/
├── CookingModeProvider   — state management (current step, wake lock)
├── StepView              — displays current instruction
├── IngredientPanel       — collapsible ingredient list
├── StepNavigation        — prev/next buttons + dots
├── StepOverview          — modal with all steps for jumping
└── CookingModeToggle     — entry button on recipe page
```

### Route
`/recept/[id]/laga` — dedicated route for cooking mode, or rendered as a full-screen overlay on the recipe page.

### Data Mapping
Existing data model already supports this:
- `instructions` table has `sort_order` and `instruction_group_id`
- `instruction_groups` provides section headers
- `ingredients` has `ingredient_group_id` for grouping with instruction sections

Group ingredients by their `ingredient_group_id` and show the relevant group for each instruction section.

## Edge Cases

1. **No Wake Lock support**: Show a notice, suggest adjusting device settings
2. **Single instruction recipe**: Show the one step without navigation
3. **Very long step text**: Scroll within the step, maintain large font
4. **Browser tab switch**: Release wake lock, re-acquire on return
5. **Landscape mode**: Adapt layout (ingredients sidebar instead of bottom panel)

## Success Metrics

- Usage: % of recipe views that enter cooking mode
- Completion: % of cooking mode sessions that reach the last step
- Retention: Users who use cooking mode more than once per week

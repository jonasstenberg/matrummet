# AI Meal Planning Feature Specification

## Overview

AI-powered weekly meal plan generation from user's recipe collection. Users generate plans weekly, with drag-drop reorganization and single-day regeneration.

**Value Proposition:**
- Eliminates daily "what should I cook?" decision fatigue
- Encourages use of full recipe collection
- Supports recurring weekly planning workflow
- Reduces food waste through coordinated ingredient usage

## User Stories

1. Generate weekly meal plan from saved recipes
2. Specify dietary restrictions (vegetarian, gluten-free, etc.)
3. Drag and drop meals between days
4. Regenerate single day's suggestion
5. Adjust portion sizes per meal
6. Generate shopping list from meal plan
7. Save and view past meal plans

## Database Schema

```sql
CREATE TABLE meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    title TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    default_servings INTEGER DEFAULT 4,
    dietary_preferences TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    ai_context JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE meal_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    planned_date DATE NOT NULL,
    meal_type TEXT DEFAULT 'dinner' CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    servings INTEGER DEFAULT 4,
    sort_order INTEGER DEFAULT 0,
    is_locked BOOLEAN DEFAULT false,
    ai_reasoning TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (meal_plan_id, planned_date, meal_type, sort_order)
);

CREATE TABLE user_dietary_preferences (
    user_email TEXT PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
    preferences TEXT[] DEFAULT '{}',
    excluded_ingredients TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

## API Endpoints

### Generate Meal Plan
`POST /api/meal-plans/generate`
```json
{
  "startDate": "2025-02-03",
  "mealsPerDay": 1,
  "servings": 4,
  "dietaryPreferences": ["vegetariskt"],
  "excludedRecipeIds": [12, 45]
}
```

### Regenerate Single Day
`POST /api/meal-plans/:id/regenerate-day`
```json
{
  "date": "2025-02-05",
  "mealType": "dinner",
  "excludeRecipeId": 23
}
```

### Get Shopping List
`GET /api/meal-plans/:id/shopping-list`

## UI/UX

### Desktop Layout (7-column grid)
```
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Mån │ Tis │ Ons │ Tor │ Fre │ Lör │ Sön │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│[IMG]│[IMG]│[IMG]│[IMG]│[IMG]│[IMG]│[IMG]│
│Pasta│ Wok │Soppa│Tacos│Pizza│Gryta│Stek │
│30min│25min│45min│40min│60min│50min│35min│
│ 4🍽 │ 4🍽 │ 4🍽 │ 6🍽 │ 4🍽 │ 4🍽 │ 4🍽 │
│[Byt]│[Byt]│[Byt]│[Byt]│[Byt]│[Byt]│[Byt]│
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘
```

### Key Components
- **MealPlanGenerator** - Settings modal for generation
- **WeekView** - Grid with drag-drop (use @dnd-kit/core)
- **MealCard** - Recipe preview with actions
- **ServingAdjuster** - +/- buttons
- **RecipeSwapModal** - Alternative suggestions

## AI Integration

### System Prompt
```
Du är en måltidsplanerare för svenska hem. Skapa balanserad veckomeny.

Principer:
- Variera proteintyper under veckan
- Blanda snabba vardagsrätter med tidskrävande helgrätter
- Undvik samma huvudingrediens två dagar i rad
- Enklare rätter på vardagar, avancerade på helgen
```

### Expected Response
```json
{
  "meals": [
    {
      "date": "2025-02-03",
      "recipeId": 23,
      "mealType": "dinner",
      "reasoning": "Snabb vardagsrätt för måndagen"
    }
  ]
}
```

## Edge Cases

1. **< 7 recipes**: Allow repetition with warning
2. **No dietary matches**: Show error before generation
3. **Recipe deleted mid-week**: Show placeholder, prompt replacement
4. **AI unavailable**: Fallback to random selection with variety rules

## Success Metrics

- Adoption: 30% of active users generate at least one plan
- Retention: Users generating plans 3+ weeks in a row
- Completion: % of planned meals marked as cooked

# Smart Shopping List Feature Specification

> **Note**: Basic shopping list tables already exist in `V26__shopping_lists.sql`. This spec covers enhancements for intelligent merging, AI categorization, and meal plan integration.

## Overview

Generate shopping lists from selected recipes or meal plans with intelligent ingredient merging and store-section categorization.

**Primary Goal:** Reduce shopping friction by eliminating manual list creation and duplicate entries.

## User Stories

1. Generate list from multiple recipes with merged ingredients
2. Intelligent unit conversion (1 dl + 5 msk = 1.5 dl)
3. Category-based organization (mejeri, grönsaker, kött)
4. Check off items while shopping
5. Add custom items not in recipes
6. Share shopping list via link
7. Adjust quantities for items already at home

## Database Enhancements

### Food Categories Table

```sql
CREATE TABLE food_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    name_sv TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    icon TEXT
);

INSERT INTO food_categories (name, name_sv, sort_order, icon) VALUES
    ('produce', 'Frukt & Grönt', 1, '🥬'),
    ('dairy', 'Mejeri', 2, '🥛'),
    ('meat', 'Kött & Chark', 3, '🥩'),
    ('fish', 'Fisk & Skaldjur', 4, '🐟'),
    ('bread', 'Bröd', 5, '🍞'),
    ('frozen', 'Fryst', 6, '🧊'),
    ('pantry', 'Skafferi', 7, '🫙'),
    ('spices', 'Kryddor', 8, '🌿'),
    ('other', 'Övrigt', 99, '📦');

-- Add category to foods table
ALTER TABLE foods ADD COLUMN category_id INTEGER REFERENCES food_categories(id);
```

### Unit Conversions

```sql
CREATE TABLE unit_conversions (
    from_unit_id INTEGER REFERENCES units(id),
    to_unit_id INTEGER REFERENCES units(id),
    multiplier DECIMAL(10, 4) NOT NULL,
    PRIMARY KEY (from_unit_id, to_unit_id)
);

-- Volume conversions (Swedish measures)
INSERT INTO unit_conversions VALUES
    (3, 2, 100),    -- dl to ml
    (5, 2, 15),     -- msk to ml
    (6, 2, 5),      -- tsk to ml
    (12, 11, 1000); -- kg to g
```

## API Endpoints

### Create from Recipes
`POST /rpc/create_shopping_list`
```json
{
    "name": "Veckans inköp",
    "recipe_ids": ["uuid-1", "uuid-2"],
    "servings_multipliers": [1.0, 2.0]
}
```

### Create from Meal Plan
`POST /rpc/create_shopping_list_from_meal_plan`
```json
{
    "meal_plan_id": "uuid",
    "date_range": ["2025-02-03", "2025-02-09"]
}
```

### Share List
`POST /rpc/generate_share_link`
```json
{
    "shopping_list_id": "uuid",
    "is_collaborative": false,
    "expires_in_days": 7
}
```

### Export as Text
`GET /rpc/export_shopping_list?shopping_list_id=uuid`
```
📋 Veckans inköp

🥬 Frukt & Grönt
☐ 3 st morötter
☐ 1 kg potatis

🥛 Mejeri
☐ 2 l mjölk
☐ 200 g smör
```

## UI/UX

### Active Shopping List View
```
Header: List name + Progress (12/24 klart)
├── Category sections (collapsible)
│   ├── Item: checkbox + quantity + name
│   └── Swipe: left=delete, right=check
├── Checked items (bottom/hidden)
└── FAB: "+ Lägg till vara"
```

### Gestures
- Pull down: Refresh
- Swipe right: Quick check
- Swipe left: Delete
- Long press: Edit details

## AI Integration

### Smart Categorization
For ingredients without `category_id`:
```
Kategorisera ingrediensen i en av dessa kategorier:
produce, dairy, meat, fish, pantry, spices, other

Ingrediens: "tahini"
```

### Suggesting Forgotten Staples
```
Dessa recept ska lagas: [recipes]
Inköpslistan innehåller: [items]

Vilka basvaror glöms ofta? Max 3 förslag.
```

## Ingredient Merging Algorithm

1. Group by food_id + compatible unit
2. Convert to base unit (ml for volume, g for weight)
3. Sum quantities
4. Convert back to display unit (1500g → 1.5 kg)
5. Track source recipes for transparency

## Edge Cases

1. **Conflicting units** (2 dl mjölk + 200 g mjölk): Keep separate with notes
2. **Vague quantities** ("lite salt"): Display without quantity, don't merge
3. **Large quantities**: Auto-convert (1500g → 1.5 kg)
4. **Recipe removed**: Recalculate, prompt for affected items
5. **Offline**: Cache list, queue operations for sync

# Recipe Scaling

## Overview

Adjust a recipe's serving size and have all ingredient quantities recalculate proportionally. Pure frontend feature with no database changes needed.

**Value Proposition:**
- Solves a common cooking need (halving/doubling recipes)
- Zero backend work — leverages existing quantity and unit data
- Improves shopping list accuracy when adding scaled recipes

## User Stories

1. Adjust serving count with +/- buttons
2. See all ingredient quantities update in real-time
3. Quantities display in sensible units (not "0.25 msk")
4. Reset to original recipe yield
5. Scaled quantities carry through to shopping list when adding

## UI/UX

### Serving Adjuster
```
Portioner: [ - ]  6  [ + ]    (Original: 4)
                               [Återställ]
```

Placed next to the recipe yield, above the ingredient list.

### Scaled Ingredients Display
```
Ingredienser (6 portioner):
  600 g   spaghetti          ← was 400g for 4 portions
  300 g   guanciale          ← was 200g
  6 st    äggulor            ← was 4
  1.5 dl  pecorino, riven    ← was 1 dl
```

Changed quantities highlighted subtly (e.g., slightly different text weight).

## Scaling Logic

```typescript
function scaleQuantity(
  originalQty: number,
  originalYield: number,
  newYield: number
): number {
  return (originalQty / originalYield) * newYield;
}

function formatQuantity(qty: number): string {
  // Round to reasonable precision
  if (qty >= 100) return Math.round(qty).toString();
  if (qty >= 10) return (Math.round(qty * 2) / 2).toString();  // nearest 0.5
  if (qty >= 1) return (Math.round(qty * 4) / 4).toString();   // nearest 0.25
  return qty.toFixed(1);
}
```

### Smart Unit Conversion
When scaling produces awkward quantities, convert to a more natural unit:

| Scaled Result | Display As |
|---------------|------------|
| 0.5 msk | 1.5 tsk |
| 15 msk | 2.25 dl |
| 1500 g | 1.5 kg |
| 1000 ml | 1 l |
| 0.25 dl | 2.5 cl or 25 ml |

Conversion table (Swedish measures):
```typescript
const VOLUME_CONVERSIONS = {
  krm: 1,      // base: ml equivalent
  tsk: 5,
  msk: 15,
  dl: 100,
  l: 1000,
};
```

## Integration with Shopping List

When adding a scaled recipe to the shopping list:
- Pass the scale factor along with the recipe ID
- Shopping list items use the scaled quantities
- Display note: "Skalat: 6 portioner (original 4)"

## Component Structure

```typescript
function useRecipeScaling(recipe: Recipe) {
  const [servings, setServings] = useState(recipe.yield_count);
  const scaleFactor = servings / recipe.yield_count;

  const scaledIngredients = recipe.ingredients.map(ing => ({
    ...ing,
    scaledQuantity: ing.quantity ? scaleQuantity(ing.quantity, recipe.yield_count, servings) : null,
    displayQuantity: ing.quantity ? formatQuantity(scaleQuantity(ing.quantity, recipe.yield_count, servings)) : null,
  }));

  return { servings, setServings, scaleFactor, scaledIngredients, isScaled: servings !== recipe.yield_count };
}
```

## Edge Cases

1. **No yield specified**: Hide scaling controls
2. **Ingredients without quantities** ("lite salt"): Display unchanged
3. **Scaling to 0**: Minimum 1 serving
4. **Very large scale factors** (10x): Allow but show a notice
5. **Non-linear scaling**: Some ingredients (baking powder, salt) don't scale linearly. Out of scope for v1, but could add per-ingredient scale hints later.
6. **Fractional original yield** ("4-6 portioner"): Use the first number as base

## Success Metrics

- Usage: % of recipe views where scaling is used
- Common adjustments: Track most frequent scale factors (2x, 0.5x)

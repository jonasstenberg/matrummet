import type { RecipeMatchData } from '@/components/recipe-card'
import type { Recipe } from '@/lib/types'
import type { PantryItem } from '@/lib/ingredient-search-types'
import { getRecipeMatchStats } from '@/lib/ingredient-search-actions'

/**
 * Builds a map of recipe match data from pantry items and recipes.
 * This is a server-side helper to avoid code duplication across pages.
 */
export async function buildRecipeMatchDataMap(
  pantryResult: PantryItem[] | { error: string },
  recipes: Recipe[]
): Promise<Record<string, RecipeMatchData>> {
  const pantryItems = Array.isArray(pantryResult) ? pantryResult : []
  const matchDataMap: Record<string, RecipeMatchData> = {}

  if (pantryItems.length === 0 || recipes.length === 0) {
    return matchDataMap
  }

  const foodIds = pantryItems.map((p) => p.food_id)
  const recipeIds = recipes.map((r) => r.id)
  const matchStats = await getRecipeMatchStats(foodIds, recipeIds)

  if ('error' in matchStats) {
    return matchDataMap
  }

  for (const stat of matchStats) {
    matchDataMap[stat.recipe_id] = {
      percentage: stat.match_percentage,
      matchingIngredients: stat.matching_ingredients,
      totalIngredients: stat.total_ingredients,
      missingFoodNames: stat.missing_food_names,
    }
  }

  return matchDataMap
}

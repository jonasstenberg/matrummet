'use server'

import { revalidatePath } from 'next/cache'
import { env } from '@/lib/env'
import { getPostgrestToken } from './action-utils'
import { createRecipe } from './recipe-actions'
import type { MealPlan, MealPlanSummary, SuggestedRecipe } from './meal-plan/types'
import type { CreateRecipeInput } from './types'

export async function listMealPlans(homeId?: string): Promise<MealPlanSummary[]> {
  try {
    const token = await getPostgrestToken()
    if (!token) return []

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
    if (homeId) {
      headers['X-Active-Home-Id'] = homeId
    }

    const response = await fetch(`${env.POSTGREST_URL}/rpc/list_meal_plans`, {
      method: 'POST',
      headers,
      body: '{}',
      cache: 'no-store',
    })

    if (!response.ok) return []

    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Error listing meal plans:', error)
    return []
  }
}

export async function getMealPlan(
  planId?: string,
  homeId?: string,
): Promise<MealPlan | null> {
  try {
    const token = await getPostgrestToken()
    if (!token) return null

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
    if (homeId) {
      headers['X-Active-Home-Id'] = homeId
    }

    const response = await fetch(`${env.POSTGREST_URL}/rpc/get_meal_plan`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_plan_id: planId || null }),
      cache: 'no-store',
    })

    if (!response.ok) return null

    const data = await response.json()
    if (!data) return null

    // Flatten nested recipe objects into entry-level fields
    interface RawEntry {
      id: string
      day_of_week: number
      meal_type: string
      recipe_id: string | null
      suggested_name: string | null
      suggested_description: string | null
      suggested_recipe?: SuggestedRecipe | null
      servings: number
      sort_order: number
      recipe?: {
        name: string
        image: string | null
        thumbnail: string | null
        prep_time: number | null
        cook_time: number | null
        recipe_yield: number | null
        categories: string[] | null
      } | null
    }

    return {
      ...data,
      entries: (data.entries || []).map((e: RawEntry) => ({
        id: e.id,
        day_of_week: e.day_of_week,
        meal_type: e.meal_type,
        recipe_id: e.recipe_id,
        suggested_name: e.suggested_name,
        suggested_description: e.suggested_description,
        suggested_recipe: e.suggested_recipe || null,
        servings: e.servings,
        sort_order: e.sort_order,
        recipe_name: e.recipe?.name,
        recipe_image: e.recipe?.image,
        recipe_thumbnail: e.recipe?.thumbnail,
        recipe_prep_time: e.recipe?.prep_time,
        recipe_cook_time: e.recipe?.cook_time,
        recipe_yield: e.recipe?.recipe_yield,
        recipe_categories: e.recipe?.categories || [],
      })),
    } as MealPlan
  } catch (error) {
    console.error('Error fetching meal plan:', error)
    return null
  }
}

export async function swapMealPlanEntry(
  entryId: string,
  recipeId: string | null,
  suggestedName: string | null,
  suggestedDescription: string | null,
  suggestedRecipe?: SuggestedRecipe | null,
): Promise<{ success: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()
    if (!token) return { error: 'Du måste vara inloggad' }

    const response = await fetch(
      `${env.POSTGREST_URL}/rpc/swap_meal_plan_entry`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_entry_id: entryId,
          p_recipe_id: recipeId,
          p_suggested_name: suggestedName,
          p_suggested_description: suggestedDescription,
          p_suggested_recipe: suggestedRecipe ?? null,
        }),
      },
    )

    if (!response.ok) {
      return { error: 'Kunde inte byta recept. Försök igen.' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error swapping meal plan entry:', error)
    return { error: 'Ett fel uppstod. Försök igen.' }
  }
}

interface RecipeIngredientData {
  id: string
  ingredients: Array<{
    id: string
    name: string
    quantity: string
    measurement: string
    form?: string
    in_pantry?: boolean
    sort_order?: number
  }>
}

export async function getRecipeIngredientsByIds(
  recipeIds: string[],
  homeId?: string,
): Promise<RecipeIngredientData[]> {
  try {
    const token = await getPostgrestToken()
    if (!token || recipeIds.length === 0) return []

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!recipeIds.every((id) => uuidRegex.test(id))) {
      console.error('Invalid recipe ID format detected')
      return []
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    }
    if (homeId) {
      headers['X-Active-Home-Id'] = homeId
    }

    const idsParam = `(${recipeIds.join(',')})`
    const response = await fetch(
      `${env.POSTGREST_URL}/user_recipes?id=in.${idsParam}&select=id,ingredients`,
      { headers, cache: 'no-store' },
    )

    if (!response.ok) return []
    return response.json()
  } catch {
    return []
  }
}

export async function addMealPlanToShoppingList(
  planId: string,
  shoppingListId?: string,
  homeId?: string,
): Promise<{ added_count: number; list_id: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()
    if (!token) return { error: 'Du måste vara inloggad' }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
    if (homeId) {
      headers['X-Active-Home-Id'] = homeId
    }

    const response = await fetch(
      `${env.POSTGREST_URL}/rpc/add_meal_plan_to_shopping_list`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_plan_id: planId,
          p_shopping_list_id: shoppingListId || null,
        }),
      },
    )

    if (!response.ok) {
      return { error: 'Kunde inte lägga till i inköpslistan. Försök igen.' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error adding meal plan to shopping list:', error)
    return { error: 'Ett fel uppstod. Försök igen.' }
  }
}

function suggestedRecipeToCreateInput(recipe: SuggestedRecipe): CreateRecipeInput {
  // Flatten ingredient_groups into the [{group:"..."}, {name,measurement,quantity}] format
  const ingredients: CreateRecipeInput['ingredients'] = []
  for (const group of recipe.ingredient_groups) {
    if (group.group_name) {
      ingredients.push({ group: group.group_name })
    }
    for (const ing of group.ingredients) {
      ingredients.push({
        name: ing.name,
        measurement: ing.measurement,
        quantity: ing.quantity,
      })
    }
  }

  // Flatten instruction_groups similarly
  const instructions: CreateRecipeInput['instructions'] = []
  for (const group of recipe.instruction_groups) {
    if (group.group_name) {
      instructions.push({ group: group.group_name })
    }
    for (const inst of group.instructions) {
      instructions.push({ step: inst.step })
    }
  }

  // Parse recipe_yield — AI may return a number or string like "4 portioner"
  let recipeYield: string | null = null
  if (recipe.recipe_yield != null) {
    const parsed = typeof recipe.recipe_yield === 'number'
      ? recipe.recipe_yield
      : parseInt(String(recipe.recipe_yield), 10)
    if (!isNaN(parsed)) recipeYield = String(parsed)
  }

  return {
    recipe_name: recipe.recipe_name,
    description: recipe.description,
    recipe_yield: recipeYield,
    prep_time: recipe.prep_time ?? null,
    cook_time: recipe.cook_time ?? null,
    categories: recipe.categories ?? [],
    ingredients,
    instructions,
  }
}

export async function saveEntryAsRecipe(
  entryId: string,
  recipe: SuggestedRecipe,
): Promise<{ recipe_id: string } | { error: string }> {
  try {
    const input = suggestedRecipeToCreateInput(recipe)
    const result = await createRecipe(input)

    if ('error' in result) {
      return result
    }

    // Link entry to the new recipe and clear suggestion data
    const swapResult = await swapMealPlanEntry(
      entryId,
      result.id,
      null,
      null,
      null,
    )

    if ('error' in swapResult) {
      return swapResult
    }

    revalidatePath('/matplan')

    return { recipe_id: result.id }
  } catch (error) {
    console.error('Error saving entry as recipe:', error)
    return { error: 'Kunde inte spara receptet. Försök igen.' }
  }
}

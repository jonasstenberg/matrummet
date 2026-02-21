import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { RecipeMatch, PantryItem, SubstitutionResponse, CommonPantryItem } from './ingredient-search-types'
import { getCurrentUserEmail, postgrestHeaders } from '@/lib/action-utils'
import { actionAuthMiddleware } from './middleware'
import { env } from '@/lib/env'
import { getSubstitutionSuggestions as getSubstitutionSuggestionsLib } from '@/lib/substitutions'

// ============================================================================
// Server Functions
// ============================================================================

const findRecipesByIngredientsFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({
    foodIds: z.array(z.string()),
    options: z.object({
      minMatchPercentage: z.number().optional(),
      onlyOwnRecipes: z.boolean().optional(),
      limit: z.number().optional(),
    }).optional(),
    homeId: z.string().optional(),
  }))
  .handler(async ({ data, context }): Promise<RecipeMatch[] | { error: string }> => {
    const { postgrestToken } = context

    try {
      if (data.foodIds.length === 0) {
        return []
      }

      const userEmail = data.options?.onlyOwnRecipes ? await getCurrentUserEmail() : null

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (postgrestToken) {
        headers.Authorization = `Bearer ${postgrestToken}`
        if (data.homeId) {
          headers['X-Active-Home-Id'] = data.homeId
        }
      }

      const response = await fetch(`${env.POSTGREST_URL}/rpc/find_recipes_by_ingredients`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_food_ids: data.foodIds,
          p_user_email: userEmail,
          p_min_match_percentage: data.options?.minMatchPercentage ?? 50,
          p_limit: data.options?.limit ?? 20,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to find recipes by ingredients:', errorText)
        return { error: 'Kunde inte hitta recept. Försök igen.' }
      }

      const results: RecipeMatch[] = await response.json()
      return results
    } catch (error) {
      console.error('Error finding recipes by ingredients:', error)
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const getUserPantryFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<PantryItem[] | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att se ditt skafferi' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/get_user_pantry`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to get user pantry:', errorText)
        return { error: 'Kunde inte hämta ditt skafferi' }
      }

      const items: PantryItem[] = await response.json()
      return items
    } catch (error) {
      console.error('Error getting user pantry:', error)
      return { error: 'Ett oväntat fel uppstod' }
    }
  })

const addToPantryFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ foodIds: z.array(z.string()), expiresAt: z.string().nullable().optional(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ success: boolean } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att spara till skafferiet' }
    }

    try {
      if (data.foodIds.length === 0) {
        return { error: 'Inga ingredienser att spara' }
      }

      const headers = await postgrestHeaders(postgrestToken, data.homeId)

      for (const foodId of data.foodIds) {
        const body: Record<string, string> = { p_food_id: foodId }
        if (data.expiresAt) {
          body.p_expires_at = data.expiresAt
        }

        const response = await fetch(`${env.POSTGREST_URL}/rpc/add_to_pantry`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          console.error('Failed to add to pantry:', await response.text())
          return { error: 'Kunde inte spara till skafferiet' }
        }
      }

      return { success: true }
    } catch (error) {
      console.error('Error adding to pantry:', error)
      return { error: 'Ett oväntat fel uppstod' }
    }
  })

const updatePantryItemExpiryFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ foodId: z.string(), expiresAt: z.string().nullable(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ success: boolean } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/add_to_pantry`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({
          p_food_id: data.foodId,
          p_expires_at: data.expiresAt,
        }),
      })

      if (!response.ok) {
        console.error('Failed to update pantry item expiry:', await response.text())
        return { error: 'Kunde inte uppdatera utgångsdatum' }
      }

      return { success: true }
    } catch (error) {
      console.error('Error updating pantry item expiry:', error)
      return { error: 'Ett oväntat fel uppstod' }
    }
  })

const removeFromPantryFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ foodId: z.string(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ success: boolean } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/remove_from_pantry`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({
          p_food_id: data.foodId,
        }),
      })

      if (!response.ok) {
        console.error('Failed to remove from pantry:', await response.text())
        return { error: 'Kunde inte ta bort från skafferiet' }
      }

      return { success: true }
    } catch (error) {
      console.error('Error removing from pantry:', error)
      return { error: 'Ett oväntat fel uppstod' }
    }
  })

const deductFromPantryFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({
    deductions: z.array(z.object({ food_id: z.string(), amount: z.number() })),
    homeId: z.string().optional(),
  }))
  .handler(async ({ data, context }): Promise<{ success: boolean; count: number } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      if (data.deductions.length === 0) {
        return { error: 'Inga avdrag att göra' }
      }

      const response = await fetch(`${env.POSTGREST_URL}/rpc/deduct_from_pantry`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({
          p_deductions: data.deductions,
        }),
      })

      if (!response.ok) {
        console.error('Failed to deduct from pantry:', await response.text())
        return { error: 'Kunde inte uppdatera skafferiet' }
      }

      const count: number = await response.json()
      return { success: true, count }
    } catch (error) {
      console.error('Error deducting from pantry:', error)
      return { error: 'Ett oväntat fel uppstod' }
    }
  })

const getSubstitutionSuggestionsFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ recipeId: z.string(), missingFoodIds: z.array(z.string()), availableFoodIds: z.array(z.string()) }))
  .handler(async ({ data, context }): Promise<SubstitutionResponse | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att se ersättningsförslag' }
    }

    try {
      const result = await getSubstitutionSuggestionsLib({
        recipe_id: data.recipeId,
        missing_food_ids: data.missingFoodIds,
        available_food_ids: data.availableFoodIds,
      })

      if ('error' in result) {
        console.error('Failed to get substitution suggestions:', result.error)
        return { error: result.error }
      }

      return result
    } catch (error) {
      console.error('Error getting substitution suggestions:', error)
      return { error: 'Ett oväntat fel uppstod' }
    }
  })

const searchFoodsWithIdsFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ query: z.string(), limit: z.number().optional() }))
  .handler(async ({ data, context }): Promise<Array<{ id: string; name: string }>> => {
    const { postgrestToken } = context

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (postgrestToken) {
        headers.Authorization = `Bearer ${postgrestToken}`
      }

      const response = await fetch(`${env.POSTGREST_URL}/rpc/search_foods`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_query: data.query,
          p_limit: data.limit ?? 10,
        }),
      })

      if (!response.ok) {
        return []
      }

      const results: Array<{ id: string; name: string; rank: number }> = await response.json()
      return results.map((food) => ({ id: food.id, name: food.name }))
    } catch (error) {
      console.error('Error searching foods with IDs:', error)
      return []
    }
  })

const getCommonPantryItemsFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<CommonPantryItem[]> => {
    const { postgrestToken } = context

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (postgrestToken) {
        headers.Authorization = `Bearer ${postgrestToken}`
        if (data.homeId) {
          headers['X-Active-Home-Id'] = data.homeId
        }
      }

      const response = await fetch(`${env.POSTGREST_URL}/rpc/get_common_pantry_items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        console.error('Failed to get common pantry items')
        return []
      }

      const items: CommonPantryItem[] = await response.json()
      return items
    } catch (error) {
      console.error('Error getting common pantry items:', error)
      return []
    }
  })

// ============================================================================
// Exported wrappers (preserve existing call signatures)
// ============================================================================

export async function findRecipesByIngredients(
  foodIds: string[],
  options?: { minMatchPercentage?: number; onlyOwnRecipes?: boolean; limit?: number },
  homeId?: string
): Promise<RecipeMatch[] | { error: string }> {
  return findRecipesByIngredientsFn({ data: { foodIds, options, homeId } })
}

export async function getUserPantry(
  homeId?: string
): Promise<PantryItem[] | { error: string }> {
  return getUserPantryFn({ data: { homeId } })
}

export async function addToPantry(
  foodIds: string[],
  expiresAt?: string | null,
  homeId?: string
): Promise<{ success: boolean } | { error: string }> {
  return addToPantryFn({ data: { foodIds, expiresAt, homeId } })
}

export async function updatePantryItemExpiry(
  foodId: string,
  expiresAt: string | null,
  homeId?: string
): Promise<{ success: boolean } | { error: string }> {
  return updatePantryItemExpiryFn({ data: { foodId, expiresAt, homeId } })
}

export async function removeFromPantry(
  foodId: string,
  homeId?: string
): Promise<{ success: boolean } | { error: string }> {
  return removeFromPantryFn({ data: { foodId, homeId } })
}

export async function deductFromPantry(
  deductions: Array<{ food_id: string; amount: number }>,
  homeId?: string
): Promise<{ success: boolean; count: number } | { error: string }> {
  return deductFromPantryFn({ data: { deductions, homeId } })
}

export async function getSubstitutionSuggestions(
  recipeId: string,
  missingFoodIds: string[],
  availableFoodIds: string[]
): Promise<SubstitutionResponse | { error: string }> {
  return getSubstitutionSuggestionsFn({ data: { recipeId, missingFoodIds, availableFoodIds } })
}

export async function searchFoodsWithIds(
  query: string,
  limit: number = 10
): Promise<Array<{ id: string; name: string }>> {
  return searchFoodsWithIdsFn({ data: { query, limit } })
}

export async function getCommonPantryItems(
  homeId?: string
): Promise<CommonPantryItem[]> {
  return getCommonPantryItemsFn({ data: { homeId } })
}

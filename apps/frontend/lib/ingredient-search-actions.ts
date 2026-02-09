'use server'

import { cookies } from 'next/headers'
import { verifyToken, signPostgrestToken } from '@/lib/auth'
import type { RecipeMatch, PantryItem, SubstitutionResponse, CommonPantryItem } from './ingredient-search-types'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:4444'

async function getPostgrestToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return null
  }

  const payload = await verifyToken(authToken)
  if (!payload?.email) {
    return null
  }

  return signPostgrestToken(payload.email)
}

async function getUserEmail(): Promise<string | null> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return null
  }

  const payload = await verifyToken(authToken)
  return payload?.email ?? null
}

export async function findRecipesByIngredients(
  foodIds: string[],
  options?: {
    minMatchPercentage?: number
    onlyOwnRecipes?: boolean
    limit?: number
  }
): Promise<RecipeMatch[] | { error: string }> {
  try {
    if (foodIds.length === 0) {
      return []
    }

    const token = await getPostgrestToken()
    const userEmail = options?.onlyOwnRecipes ? await getUserEmail() : null

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/find_recipes_by_ingredients`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_food_ids: foodIds,
        p_user_email: userEmail,
        p_min_match_percentage: options?.minMatchPercentage ?? 50,
        p_limit: options?.limit ?? 20,
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
}

export async function getUserPantry(): Promise<PantryItem[] | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att se ditt skafferi' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/get_user_pantry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
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
}

export async function addToPantry(
  foodIds: string[],
  expiresAt?: string | null
): Promise<{ success: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att spara till skafferiet' }
    }

    if (foodIds.length === 0) {
      return { error: 'Inga ingredienser att spara' }
    }

    // Add each food to pantry
    for (const foodId of foodIds) {
      const body: Record<string, string> = { p_food_id: foodId }
      if (expiresAt) {
        body.p_expires_at = expiresAt
      }

      const response = await fetch(`${POSTGREST_URL}/rpc/add_to_pantry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
}

export async function updatePantryItemExpiry(
  foodId: string,
  expiresAt: string | null
): Promise<{ success: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/add_to_pantry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_food_id: foodId,
        p_expires_at: expiresAt,
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
}

export async function removeFromPantry(
  foodId: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/remove_from_pantry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_food_id: foodId,
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
}

export async function deductFromPantry(
  deductions: Array<{ food_id: string; amount: number }>
): Promise<{ success: boolean; count: number } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    if (deductions.length === 0) {
      return { error: 'Inga avdrag att göra' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/deduct_from_pantry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_deductions: deductions,
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
}

export async function getSubstitutionSuggestions(
  recipeId: string,
  missingFoodIds: string[],
  availableFoodIds: string[]
): Promise<SubstitutionResponse | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att se ersättningsförslag' }
    }

    // Call internal API endpoint that handles AI integration
    const response = await fetch(`${process.env.APP_URL || 'http://localhost:3000'}/api/substitutions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        recipe_id: recipeId,
        missing_food_ids: missingFoodIds,
        available_food_ids: availableFoodIds,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to get substitution suggestions:', errorText)
      return { error: 'Kunde inte hämta ersättningsförslag' }
    }

    const result: SubstitutionResponse = await response.json()
    return result
  } catch (error) {
    console.error('Error getting substitution suggestions:', error)
    return { error: 'Ett oväntat fel uppstod' }
  }
}

export async function searchFoodsWithIds(
  query: string,
  limit: number = 10
): Promise<Array<{ id: string; name: string }>> {
  try {
    const token = await getPostgrestToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/search_foods`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_query: query,
        p_limit: limit,
      }),
    })

    if (!response.ok) {
      return []
    }

    const data: Array<{ id: string; name: string; rank: number }> = await response.json()
    return data.map((food) => ({ id: food.id, name: food.name }))
  } catch (error) {
    console.error('Error searching foods with IDs:', error)
    return []
  }
}

export async function getCommonPantryItems(): Promise<CommonPantryItem[]> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    const token = await getPostgrestToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/get_common_pantry_items`, {
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
}


'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { CreateRecipeInput, UpdateRecipeInput, ApiKey, ShoppingList } from '@/lib/types'
import { verifyToken, signPostgrestToken } from '@/lib/auth'
import { extractJsonLdRecipe, mapJsonLdToRecipeInput } from '@/lib/recipe-import'
import { downloadImage } from '@/lib/recipe-import/image-downloader'
import { deleteImageVariants } from './image-processing'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:4444'

async function getPostgrestToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return null
  }

  // Verify the frontend token and extract the email
  const payload = await verifyToken(authToken)
  if (!payload?.email) {
    return null
  }

  // Create a PostgREST-specific token with role: 'anon'
  return signPostgrestToken(payload.email)
}

export async function createRecipe(
  data: CreateRecipeInput
): Promise<{ id: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att skapa recept' }
    }

    // Map the input to match PostgREST function parameters
    const payload = {
      p_name: data.recipe_name,
      p_author: data.author || null,
      p_description: data.description,
      p_url: data.url || null,
      p_recipe_yield: data.recipe_yield || null,
      p_recipe_yield_name: data.recipe_yield_name || null,
      p_prep_time: data.prep_time || null,
      p_cook_time: data.cook_time || null,
      p_cuisine: data.cuisine || null,
      p_image: data.image || null,
      p_thumbnail: data.thumbnail || null,
      p_categories: data.categories || [],
      p_ingredients: data.ingredients || [],
      p_instructions: data.instructions || [],
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/insert_recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to create recipe:', errorText)
      return { error: 'Kunde inte skapa receptet. Försök igen.' }
    }

    const result = await response.json()

    // Revalidate relevant paths
    revalidatePath('/recept')
    revalidatePath('/')

    return { id: result }
  } catch (error) {
    console.error('Error creating recipe:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function updateRecipe(
  id: string,
  data: UpdateRecipeInput
): Promise<{ success: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att uppdatera recept' }
    }

    // Map the input to match PostgREST function parameters
    const payload = {
      p_recipe_id: id,
      p_name: data.recipe_name,
      p_author: data.author,
      p_description: data.description,
      p_url: data.url,
      p_recipe_yield: data.recipe_yield,
      p_recipe_yield_name: data.recipe_yield_name,
      p_prep_time: data.prep_time,
      p_cook_time: data.cook_time,
      p_cuisine: data.cuisine,
      p_image: data.image,
      p_thumbnail: data.thumbnail,
      p_date_published: data.date_published,
      p_categories: data.categories,
      p_ingredients: data.ingredients,
      p_instructions: data.instructions,
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/update_recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to update recipe:', errorText)
      return { error: 'Kunde inte uppdatera receptet. Försök igen.' }
    }

    // Revalidate relevant paths
    revalidatePath(`/recept/${id}`)
    revalidatePath('/recept')
    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error('Error updating recipe:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

async function deleteImageFile(filename: string | null): Promise<void> {
  if (!filename) return
  // Skip if it's a URL (external image)
  if (filename.startsWith('http://') || filename.startsWith('https://')) return
  // Strip .webp extension if present
  const imageId = filename.replace(/\.webp$/, '')
  await deleteImageVariants(imageId)
}

export async function deleteRecipe(
  id: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att ta bort recept' }
    }

    // First, fetch the recipe to get the image filename
    const getResponse = await fetch(
      `${POSTGREST_URL}/recipes?id=eq.${id}&select=image`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (getResponse.ok) {
      const recipes = await getResponse.json()
      if (recipes.length > 0 && recipes[0].image) {
        await deleteImageFile(recipes[0].image)
      }
    }

    // Delete the recipe from the database
    const response = await fetch(`${POSTGREST_URL}/recipes?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to delete recipe:', errorText)
      return { error: 'Kunde inte ta bort receptet. Försök igen.' }
    }

    // Revalidate relevant paths
    revalidatePath('/recept')
    revalidatePath('/alla-recept')
    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error('Error deleting recipe:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export interface ImportRecipeResult {
  success: boolean
  data?: Partial<CreateRecipeInput>
  warnings?: string[]
  lowConfidenceIngredients?: number[]
  error?: string
  sourceUrl: string
}

interface FoodMatch {
  id: string
  name: string
  rank: number
}

interface UnitMatch {
  id: string
  name: string
  plural: string
  abbreviation: string
  rank: number
}

async function searchFood(query: string): Promise<FoodMatch | null> {
  if (!query || query.length < 2) return null

  try {
    const response = await fetch(`${POSTGREST_URL}/rpc/search_foods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_query: query, p_limit: 1 }),
    })

    if (!response.ok) return null

    const results: FoodMatch[] = await response.json()
    // Only return if it's a good match (rank > 0.5)
    return results.length > 0 && results[0].rank > 0.5 ? results[0] : null
  } catch {
    return null
  }
}

async function searchUnit(query: string): Promise<UnitMatch | null> {
  if (!query || query.length < 1) return null

  try {
    const response = await fetch(`${POSTGREST_URL}/rpc/search_units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_query: query, p_limit: 1 }),
    })

    if (!response.ok) return null

    const results: UnitMatch[] = await response.json()
    // Only return if it's a good match (rank > 0.5)
    return results.length > 0 && results[0].rank > 0.5 ? results[0] : null
  } catch {
    return null
  }
}

async function matchIngredientsToDatabase(
  ingredients: Array<{ name: string; measurement: string; quantity: string }>
): Promise<Array<{ name: string; measurement: string; quantity: string }>> {
  const matched = await Promise.all(
    ingredients.map(async (ing) => {
      const [foodMatch, unitMatch] = await Promise.all([
        searchFood(ing.name),
        searchUnit(ing.measurement),
      ])

      return {
        name: foodMatch?.name || ing.name,
        measurement: unitMatch?.abbreviation || unitMatch?.name || ing.measurement,
        quantity: ing.quantity,
      }
    })
  )

  return matched
}

export async function importRecipeFromUrl(
  url: string
): Promise<ImportRecipeResult> {
  try {
    // Check authentication
    const token = await getPostgrestToken()
    if (!token) {
      return {
        success: false,
        error: 'Du måste vara inloggad för att importera recept',
        sourceUrl: url,
      }
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return {
          success: false,
          error: 'Ogiltig URL. Endast HTTP och HTTPS stöds.',
          sourceUrl: url,
        }
      }
    } catch {
      return {
        success: false,
        error: 'Ogiltig URL-format',
        sourceUrl: url,
      }
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; RecipeImporter/1.0; recipe parser)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
      },
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Kunde inte hämta sidan: ${response.status} ${response.statusText}`,
        sourceUrl: url,
      }
    }

    const html = await response.text()

    // Extract JSON-LD Recipe
    const jsonLd = extractJsonLdRecipe(html)
    if (!jsonLd) {
      return {
        success: false,
        error:
          'Ingen receptdata hittades på sidan. Sidan kanske inte använder JSON-LD-format.',
        sourceUrl: url,
      }
    }

    // Map to our format
    const { data, warnings, lowConfidenceIngredients } = mapJsonLdToRecipeInput(jsonLd, url)

    // Match ingredients to database foods and units
    if (data.ingredients && data.ingredients.length > 0) {
      const ingredientsToMatch = data.ingredients.filter(
        (i): i is { name: string; measurement: string; quantity: string } =>
          'name' in i
      )

      if (ingredientsToMatch.length > 0) {
        const matchedIngredients =
          await matchIngredientsToDatabase(ingredientsToMatch)

        // Rebuild ingredients array with matched values
        let matchIndex = 0
        data.ingredients = data.ingredients.map((ing) => {
          if ('name' in ing) {
            return matchedIngredients[matchIndex++]
          }
          return ing
        })
      }
    }

    // Keep the image URL as-is - it will be downloaded when the recipe is saved
    return {
      success: true,
      data,
      warnings: warnings.length > 0 ? warnings : undefined,
      lowConfidenceIngredients: lowConfidenceIngredients.length > 0 ? lowConfidenceIngredients : undefined,
      sourceUrl: url,
    }
  } catch (error) {
    console.error('Error importing recipe from URL:', error)
    return {
      success: false,
      error: 'Ett oväntat fel uppstod vid import. Försök igen.',
      sourceUrl: url,
    }
  }
}

/**
 * Download an image from a URL and save it locally (server-side).
 * This bypasses CORS restrictions that would block client-side downloads.
 */
export async function downloadAndSaveImage(
  imageUrl: string
): Promise<{ filename: string } | { error: string }> {
  try {
    const result = await downloadImage(imageUrl)

    if (!result.success || !result.filename) {
      return { error: result.error || 'Kunde inte ladda ner bilden' }
    }

    return { filename: result.filename }
  } catch (error) {
    console.error('Error downloading image:', error)
    return { error: 'Ett fel uppstod vid nedladdning av bilden' }
  }
}

export async function addRecipeToShoppingList(
  recipeId: string,
  options?: {
    servings?: number
    ingredientIds?: string[]
    listId?: string
  }
): Promise<{ success: true; listId: string; addedCount: number } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att lägga till i inköpslistan' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/add_recipe_to_shopping_list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_recipe_id: recipeId,
        p_shopping_list_id: options?.listId ?? null,
        p_servings: options?.servings ?? null,
        p_ingredient_ids: options?.ingredientIds ?? null,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to add recipe to shopping list:', errorText)
      return { error: 'Kunde inte lägga till i inköpslistan' }
    }

    const result = await response.json()

    revalidatePath('/inkopslista')

    return {
      success: true,
      listId: result.list_id,
      addedCount: result.added_count,
    }
  } catch (error) {
    console.error('Error adding recipe to shopping list:', error)
    return { error: 'Ett oväntat fel uppstod' }
  }
}

export async function toggleRecipeLike(
  recipeId: string
): Promise<{ liked: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att gilla recept' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/toggle_recipe_like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_recipe_id: recipeId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to toggle recipe like:', errorText)

      // Parse PostgREST error to get the error code
      try {
        const errorJson = JSON.parse(errorText)
        const errorCode = errorJson.code || errorJson.message

        if (errorCode === 'cannot-like-own-recipe') {
          return { error: 'Du kan inte gilla dina egna recept' }
        }
        if (errorCode === 'recipe-not-found') {
          return { error: 'Receptet hittades inte' }
        }
      } catch {
        // If we can't parse the error, fall through to generic message
      }

      return { error: 'Kunde inte uppdatera gillning' }
    }

    const result = await response.json()

    // Revalidate relevant paths
    revalidatePath('/gillade-recept')
    revalidatePath(`/recept/${recipeId}`)

    // DB function returns { liked: boolean }
    return { liked: result.liked }
  } catch (error) {
    console.error('Error toggling recipe like:', error)
    return { error: 'Kunde inte uppdatera gillning' }
  }
}

export async function toggleShoppingListItem(
  itemId: string
): Promise<{ checked: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/toggle_shopping_list_item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_item_id: itemId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to toggle shopping list item:', errorText)
      return { error: 'Kunde inte uppdatera objektet' }
    }

    const result = await response.json()

    revalidatePath('/inkopslista')

    return { checked: result.checked }
  } catch (error) {
    console.error('Error toggling shopping list item:', error)
    return { error: 'Kunde inte uppdatera objektet' }
  }
}

export async function clearCheckedItems(
  listId?: string
): Promise<{ success: true; cleared: number } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/clear_checked_items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_list_id: listId || null }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to clear checked items:', errorText)
      return { error: 'Kunde inte rensa avbockade objekt' }
    }

    const result = await response.json()

    revalidatePath('/inkopslista')

    return { success: true, cleared: result.cleared ?? result }
  } catch (error) {
    console.error('Error clearing checked items:', error)
    return { error: 'Kunde inte rensa avbockade objekt' }
  }
}

export async function getApiKeys(): Promise<ApiKey[] | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du maste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/get_user_api_keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to get API keys:', errorText)
      return { error: 'Kunde inte hamta API-nycklar' }
    }

    const result = await response.json()

    // Map database field names to ApiKey interface
    return result.map((key: { id: string; name: string; api_key_prefix: string; last_used_at: string | null; date_published: string }) => ({
      id: key.id,
      name: key.name,
      prefix: key.api_key_prefix,
      last_used_at: key.last_used_at,
      date_published: key.date_published,
    })) as ApiKey[]
  } catch (error) {
    console.error('Error getting API keys:', error)
    return { error: 'Kunde inte hamta API-nycklar' }
  }
}

export async function createApiKey(
  name: string
): Promise<{ apiKey: string; prefix: string; id: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du maste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/create_user_api_key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_name: name }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to create API key:', errorText)

      if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
        return { error: 'En nyckel med det namnet finns redan' }
      }

      return { error: 'Kunde inte skapa nyckel' }
    }

    const result = await response.json()

    revalidatePath('/installningar')

    return {
      apiKey: result.api_key,
      prefix: result.prefix,
      id: result.id,
    }
  } catch (error) {
    console.error('Error creating API key:', error)
    return { error: 'Kunde inte skapa nyckel' }
  }
}

export async function revokeApiKey(
  keyId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du maste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/revoke_api_key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_key_id: keyId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to revoke API key:', errorText)
      return { error: 'Kunde inte ta bort nyckel' }
    }

    revalidatePath('/installningar')

    return { success: true }
  } catch (error) {
    console.error('Error revoking API key:', error)
    return { error: 'Kunde inte ta bort nyckel' }
  }
}

export async function getUserShoppingLists(): Promise<ShoppingList[] | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/get_user_shopping_lists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to get shopping lists:', errorText)
      return { error: 'Kunde inte hämta inköpslistor' }
    }

    const result = await response.json()
    return result as ShoppingList[]
  } catch (error) {
    console.error('Error getting shopping lists:', error)
    return { error: 'Kunde inte hämta inköpslistor' }
  }
}

export async function createShoppingList(
  name: string
): Promise<{ id: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/create_shopping_list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_name: name }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to create shopping list:', errorText)

      if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
        return { error: 'En lista med det namnet finns redan' }
      }

      return { error: 'Kunde inte skapa inköpslistan' }
    }

    const result = await response.json()

    revalidatePath('/inkopslista')

    return { id: result }
  } catch (error) {
    console.error('Error creating shopping list:', error)
    return { error: 'Kunde inte skapa inköpslistan' }
  }
}

export async function renameShoppingList(
  listId: string,
  name: string
): Promise<{ success: true } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/rename_shopping_list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_list_id: listId, p_name: name }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to rename shopping list:', errorText)

      if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
        return { error: 'En lista med det namnet finns redan' }
      }

      return { error: 'Kunde inte byta namn på listan' }
    }

    revalidatePath('/inkopslista')

    return { success: true }
  } catch (error) {
    console.error('Error renaming shopping list:', error)
    return { error: 'Kunde inte byta namn på listan' }
  }
}

export async function deleteShoppingList(
  listId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/delete_shopping_list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_list_id: listId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to delete shopping list:', errorText)
      return { error: 'Kunde inte ta bort listan' }
    }

    revalidatePath('/inkopslista')

    return { success: true }
  } catch (error) {
    console.error('Error deleting shopping list:', error)
    return { error: 'Kunde inte ta bort listan' }
  }
}

export async function setDefaultShoppingList(
  listId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/set_default_shopping_list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_list_id: listId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to set default shopping list:', errorText)
      return { error: 'Kunde inte ändra standardlista' }
    }

    revalidatePath('/inkopslista')

    return { success: true }
  } catch (error) {
    console.error('Error setting default shopping list:', error)
    return { error: 'Kunde inte ändra standardlista' }
  }
}

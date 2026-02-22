'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import {
  CreateRecipeInput,
  UpdateRecipeInput,
  ShareLink,
} from '@/lib/types'
import { extractJsonLdRecipe, extractProvechoRecipe, extractProvechoRecipeText, PROVECHO_HOSTNAMES, mapJsonLdToRecipeInput, fetchWithPlaywright } from '@/lib/recipe-import'
import { downloadImage } from '@/lib/recipe-import/image-downloader'
import { deleteImageVariants } from './image-processing'
import { getRecipes } from '@/lib/api'
import type { Recipe } from '@/lib/types'
import { getPostgrestToken } from './action-utils'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:4444'

async function deleteImageFile(filename: string | null): Promise<void> {
  if (!filename) return
  // Skip if it's a URL (external image)
  if (filename.startsWith('http://') || filename.startsWith('https://')) return
  // Strip .webp extension if present
  const imageId = filename.replace(/\.webp$/, '')
  await deleteImageVariants(imageId)
}

// Recipe loading for infinite scroll
export async function loadMoreRecipes(options: {
  offset: number
  limit: number
  ownerIds?: string[]
}): Promise<Recipe[]> {
  const { offset, limit, ownerIds } = options

  const token = await getPostgrestToken()

  if (!token) {
    return []
  }

  return getRecipes({ ownerIds, token, limit, offset })
}

// AI Credits
export async function deductAiCredit(
  description: string
): Promise<{ remainingCredits: number } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/deduct_credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_description: description }),
    })

    if (!response.ok) {
      return {
        error: 'Du har inga AI-poäng kvar. Köp fler i menyn.',
      }
    }

    const remainingCredits = await response.json()
    return { remainingCredits }
  } catch (error) {
    console.error('Error deducting AI credit:', error)
    return { error: 'Något gick fel. Försök igen.' }
  }
}

// Recipe CRUD
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
      p_description: data.description || null,
      p_url: data.url || null,
      p_recipe_yield: data.recipe_yield || null,
      p_recipe_yield_name: data.recipe_yield_name || null,
      p_prep_time: data.prep_time || null,
      p_cook_time: data.cook_time || null,
      p_cuisine: data.cuisine || null,
      p_image: data.image || null,
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

    // Revalidate relevant paths and tags
    revalidatePath('/recept')
    revalidatePath('/')
    revalidateTag('recipes', 'max')

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

    // Revalidate relevant paths and tags
    revalidatePath(`/recept/${id}`)
    revalidatePath('/recept')
    revalidatePath('/alla-recept')
    revalidatePath('/')
    revalidateTag('recipes', 'max')

    return { success: true }
  } catch (error) {
    console.error('Error updating recipe:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
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

    // Revalidate relevant paths and tags
    revalidatePath('/recept')
    revalidatePath('/alla-recept')
    revalidatePath('/')
    revalidateTag('recipes', 'max')

    return { success: true }
  } catch (error) {
    console.error('Error deleting recipe:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function copyRecipe(
  recipeId: string
): Promise<{ newRecipeId: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att kopiera recept' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/copy_recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_source_recipe_id: recipeId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to copy recipe:', errorText)

      // Parse PostgREST error to get the error code
      try {
        const errorJson = JSON.parse(errorText)
        const errorCode = errorJson.code || errorJson.message

        if (errorCode === 'not-authenticated') {
          return { error: 'Du måste vara inloggad' }
        }
        if (errorCode === 'recipe-not-found-or-not-visible') {
          return { error: 'Receptet kunde inte hittas eller är inte tillgängligt' }
        }
      } catch {
        // If we can't parse the error, fall through to generic message
      }

      return { error: 'Kunde inte kopiera receptet. Försök igen.' }
    }

    const result = await response.json()

    // Revalidate relevant paths
    revalidatePath('/recept')
    revalidatePath('/alla-recept')

    return { newRecipeId: result }
  } catch (error) {
    console.error('Error copying recipe:', error)
    return { error: 'Kunde inte kopiera receptet. Försök igen.' }
  }
}

// Recipe likes
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

    // Revalidate relevant paths and tags
    revalidatePath('/gillade-recept')
    revalidatePath(`/recept/${recipeId}`)
    revalidateTag('recipes', 'max')

    // DB function returns { liked: boolean }
    return { liked: result.liked }
  } catch (error) {
    console.error('Error toggling recipe like:', error)
    return { error: 'Kunde inte uppdatera gillning' }
  }
}

// Recipe import
export interface ImportRecipeResult {
  success: boolean
  data?: Partial<CreateRecipeInput>
  warnings?: string[]
  lowConfidenceIngredients?: number[]
  error?: string
  sourceUrl: string
  pageText?: string // Page text for AI fallback when JSON-LD not found
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

async function searchFood(query: string, token: string): Promise<FoodMatch | null> {
  if (!query || query.length < 2) return null

  try {
    const response = await fetch(`${POSTGREST_URL}/rpc/search_foods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
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

async function searchUnit(query: string, token: string): Promise<UnitMatch | null> {
  if (!query || query.length < 1) return null

  try {
    const response = await fetch(`${POSTGREST_URL}/rpc/search_units`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
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
  const token = await getPostgrestToken()
  if (!token) return ingredients

  const matched = await Promise.all(
    ingredients.map(async (ing) => {
      const [foodMatch, unitMatch] = await Promise.all([
        searchFood(ing.name, token),
        searchUnit(ing.measurement, token),
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

    // Try simple HTTP fetch first
    let jsonLd = null
    let pageText: string | null = null

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; RecipeImporter/1.0; recipe parser)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        },
      })

      if (response.ok) {
        const html = await response.text()

        // Provecho.co: encoded recipe in __NEXT_DATA__
        const isProvecho = (PROVECHO_HOSTNAMES as readonly string[]).includes(parsedUrl.hostname)
        if (isProvecho) {
          jsonLd = extractProvechoRecipe(html)
        }

        if (!jsonLd) {
          jsonLd = extractJsonLdRecipe(html)
        }
      }
    } catch {
      // HTTP fetch failed, will try Playwright
    }

    // If no JSON-LD found, try Playwright for JS-rendered pages
    if (!jsonLd) {
      const playwrightResult = await fetchWithPlaywright(url)
      jsonLd = playwrightResult.jsonLd
      pageText = playwrightResult.pageText
    }

    // If still no JSON-LD, return with pageText for AI fallback
    if (!jsonLd) {
      return {
        success: false,
        error: pageText
          ? 'Ingen strukturerad receptdata hittades. Prova med AI för att tolka sidans innehåll.'
          : 'Kunde inte hämta innehåll från sidan.',
        sourceUrl: url,
        pageText: pageText || undefined,
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
 * Fetch page text from a URL using Playwright (for AI import).
 * Skips JSON-LD extraction — goes straight to rendered page text.
 */
export async function fetchUrlPageText(
  url: string
): Promise<{ pageText: string | null; error?: string }> {
  try {
    const token = await getPostgrestToken()
    if (!token) {
      return { pageText: null, error: 'Du måste vara inloggad' }
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { pageText: null, error: 'Ogiltig URL' }
      }
    } catch {
      return { pageText: null, error: 'Ogiltig URL-format' }
    }

    // Provecho: extract structured recipe text directly (no Playwright needed)
    if ((PROVECHO_HOSTNAMES as readonly string[]).includes(parsedUrl.hostname)) {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RecipeImporter/1.0)',
          'Accept': 'text/html',
        },
      })
      if (response.ok) {
        const html = await response.text()
        const recipeText = extractProvechoRecipeText(html)
        if (recipeText) return { pageText: recipeText }
      }
    }

    const result = await fetchWithPlaywright(url)
    if (!result.pageText) {
      return { pageText: null, error: 'Kunde inte hämta sidans innehåll' }
    }
    return { pageText: result.pageText }
  } catch (error) {
    console.error('Error fetching page text:', error)
    return { pageText: null, error: 'Ett oväntat fel uppstod' }
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

// Share link operations

export async function createShareLink(
  recipeId: string,
  expiresDays?: number
): Promise<{ token: string; url: string; expires_at: string | null } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att dela recept' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/create_share_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_recipe_id: recipeId,
        p_expires_days: expiresDays ?? null,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to create share link:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message?.includes('access-denied')) {
          return { error: 'Du kan bara dela dina egna recept' }
        }
      } catch {
        // Fall through to generic error
      }

      return { error: 'Kunde inte skapa delningslänk. Försök igen.' }
    }

    const result = await response.json()
    // RPC returns array with one row
    const row = Array.isArray(result) ? result[0] : result

    if (!row || !row.token) {
      return { error: 'Kunde inte skapa delningslänk' }
    }

    const baseUrl = process.env.APP_URL || 'http://localhost:3000'
    const shareUrl = `${baseUrl}/dela/${row.token}`

    return {
      token: row.token,
      url: shareUrl,
      expires_at: row.expires_at ?? null,
    }
  } catch (error) {
    console.error('Error creating share link:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function revokeShareLink(
  shareToken: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/revoke_share_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_token: shareToken }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to revoke share link:', errorText)
      return { error: 'Kunde inte återkalla delningslänken' }
    }

    const result = await response.json()

    return { success: result === true }
  } catch (error) {
    console.error('Error revoking share link:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function getShareLinks(
  recipeId: string
): Promise<{ links: ShareLink[] } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/get_recipe_share_tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_recipe_id: recipeId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to get share links:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message?.includes('access-denied')) {
          return { error: 'Du kan bara se delningslänkar för dina egna recept' }
        }
      } catch {
        // Fall through to generic error
      }

      return { error: 'Kunde inte hämta delningslänkar' }
    }

    const links: ShareLink[] = await response.json()

    return { links }
  } catch (error) {
    console.error('Error getting share links:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function copySharedRecipe(
  shareToken: string
): Promise<{ newRecipeId: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att spara recept' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/copy_shared_recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_token: shareToken }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to copy shared recipe:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message?.includes('invalid-or-expired-token')) {
          return { error: 'Delningslänken är ogiltig eller har gått ut' }
        }
      } catch {
        // Fall through to generic error
      }

      return { error: 'Kunde inte spara receptet. Försök igen.' }
    }

    const result = await response.json()

    // Revalidate relevant paths
    revalidatePath('/recept')
    revalidatePath('/mina-recept')

    return { newRecipeId: result }
  } catch (error) {
    console.error('Error copying shared recipe:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

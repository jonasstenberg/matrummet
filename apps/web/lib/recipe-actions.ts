import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  CreateRecipeInput,
  UpdateRecipeInput,
  ShareLink,
} from '@/lib/types'
import { extractJsonLdRecipe, extractProvechoRecipe, extractProvechoRecipeText, PROVECHO_HOSTNAMES, mapJsonLdToRecipeInput, fetchWithPlaywright } from '@/lib/recipe-import'
import { downloadImage } from '@/lib/recipe-import/image-downloader'
import { deleteImageFromService } from './image-service-client'
import { getRecipes } from '@/lib/api'
import type { Recipe } from '@/lib/types'
import { actionAuthMiddleware } from './middleware'
import { env } from '@/lib/env'
// Zod schemas for recipe ingredient/instruction unions
const ingredientInputSchema = z.union([
  z.object({ group: z.string() }),
  z.object({ name: z.string(), measurement: z.string(), quantity: z.string(), form: z.string().optional() }),
])

const instructionInputSchema = z.union([
  z.object({ group: z.string() }),
  z.object({ step: z.string() }),
])

const createRecipeInputSchema = z.object({
  recipe_name: z.string(),
  author: z.string().nullable().optional(),
  description: z.string(),
  url: z.string().nullable().optional(),
  recipe_yield: z.string().nullable().optional(),
  recipe_yield_name: z.string().nullable().optional(),
  prep_time: z.number().nullable().optional(),
  cook_time: z.number().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  date_published: z.string().nullable().optional(),
  categories: z.array(z.string()).optional(),
  ingredients: z.array(ingredientInputSchema),
  instructions: z.array(instructionInputSchema),
})

const updateRecipeInputSchema = z.object({
  recipe_id: z.string(),
  recipe_name: z.string().optional(),
  author: z.string().nullable().optional(),
  description: z.string().optional(),
  url: z.string().nullable().optional(),
  recipe_yield: z.string().nullable().optional(),
  recipe_yield_name: z.string().nullable().optional(),
  prep_time: z.number().nullable().optional(),
  cook_time: z.number().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  date_published: z.string().nullable().optional(),
  categories: z.array(z.string()).optional(),
  ingredients: z.array(ingredientInputSchema).optional(),
  instructions: z.array(instructionInputSchema).optional(),
})

async function deleteImageFile(filename: string | null): Promise<void> {
  if (!filename) return
  if (filename.startsWith('http://') || filename.startsWith('https://')) return
  const imageId = filename.replace(/\.webp$/, '')
  await deleteImageFromService(imageId)
}

// ============================================================================
// Helper functions (not server functions — called from other server functions)
// ============================================================================

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
    const response = await fetch(`${env.POSTGREST_URL}/rpc/search_foods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_query: query, p_limit: 1 }),
    })

    if (!response.ok) return null

    const results: FoodMatch[] = await response.json()
    return results.length > 0 && results[0].rank > 0.5 ? results[0] : null
  } catch {
    return null
  }
}

async function searchUnit(query: string, token: string): Promise<UnitMatch | null> {
  if (!query || query.length < 1) return null

  try {
    const response = await fetch(`${env.POSTGREST_URL}/rpc/search_units`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_query: query, p_limit: 1 }),
    })

    if (!response.ok) return null

    const results: UnitMatch[] = await response.json()
    return results.length > 0 && results[0].rank > 0.5 ? results[0] : null
  } catch {
    return null
  }
}

async function matchIngredientsToDatabase(
  ingredients: Array<{ name: string; measurement: string; quantity: string }>,
  token: string
): Promise<Array<{ name: string; measurement: string; quantity: string }>> {
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

// ============================================================================
// Server Functions
// ============================================================================

export interface ImportRecipeResult {
  success: boolean
  data?: Partial<CreateRecipeInput>
  warnings?: string[]
  lowConfidenceIngredients?: number[]
  error?: string
  sourceUrl: string
  pageText?: string
}

const loadMoreRecipesFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ offset: z.number(), limit: z.number(), ownerIds: z.array(z.string()).optional() }))
  .handler(async ({ data, context }): Promise<Recipe[]> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return []
    }

    return getRecipes({ ownerIds: data.ownerIds, token: postgrestToken, limit: data.limit, offset: data.offset })
  })

const deductAiCreditFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ description: z.string() }))
  .handler(async ({ data, context }): Promise<{ remainingCredits: number } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/deduct_credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_description: data.description }),
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
  })

const createRecipeFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(createRecipeInputSchema)
  .handler(async ({ data, context }): Promise<{ id: string } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att skapa recept' }
    }

    try {
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
        p_thumbnail: data.thumbnail || null,
        p_categories: data.categories || [],
        p_ingredients: data.ingredients || [],
        p_instructions: data.instructions || [],
      }

      const response = await fetch(`${env.POSTGREST_URL}/rpc/insert_recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to create recipe:', errorText)
        return { error: 'Kunde inte skapa receptet. Försök igen.' }
      }

      const result = await response.json()

      return { id: result }
    } catch (error) {
      console.error('Error creating recipe:', error)
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const updateRecipeFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ id: z.string(), data: updateRecipeInputSchema }))
  .handler(async ({ data: input, context }): Promise<{ success: boolean } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att uppdatera recept' }
    }

    try {
      const payload = {
        p_recipe_id: input.id,
        p_name: input.data.recipe_name,
        p_author: input.data.author,
        p_description: input.data.description,
        p_url: input.data.url,
        p_recipe_yield: input.data.recipe_yield,
        p_recipe_yield_name: input.data.recipe_yield_name,
        p_prep_time: input.data.prep_time,
        p_cook_time: input.data.cook_time,
        p_cuisine: input.data.cuisine,
        p_image: input.data.image,
        p_thumbnail: input.data.thumbnail,
        p_date_published: input.data.date_published,
        p_categories: input.data.categories,
        p_ingredients: input.data.ingredients,
        p_instructions: input.data.instructions,
      }

      const response = await fetch(`${env.POSTGREST_URL}/rpc/update_recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to update recipe:', errorText)
        return { error: 'Kunde inte uppdatera receptet. Försök igen.' }
      }

      return { success: true }
    } catch (error) {
      console.error('Error updating recipe:', error)
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const deleteRecipeFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }): Promise<{ success: boolean } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att ta bort recept' }
    }

    try {
      const getResponse = await fetch(
        `${env.POSTGREST_URL}/recipes?id=eq.${data.id}&select=image`,
        {
          headers: {
            Authorization: `Bearer ${postgrestToken}`,
          },
        }
      )

      if (getResponse.ok) {
        const recipes = await getResponse.json()
        if (recipes.length > 0 && recipes[0].image) {
          await deleteImageFile(recipes[0].image)
        }
      }

      const response = await fetch(`${env.POSTGREST_URL}/recipes?id=eq.${data.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${postgrestToken}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to delete recipe:', errorText)
        return { error: 'Kunde inte ta bort receptet. Försök igen.' }
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting recipe:', error)
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const copyRecipeFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ recipeId: z.string() }))
  .handler(async ({ data, context }): Promise<{ newRecipeId: string } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att kopiera recept' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/copy_recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_source_recipe_id: data.recipeId }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to copy recipe:', errorText)

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
          // Fall through to generic message
        }

        return { error: 'Kunde inte kopiera receptet. Försök igen.' }
      }

      const result = await response.json()

      return { newRecipeId: result }
    } catch (error) {
      console.error('Error copying recipe:', error)
      return { error: 'Kunde inte kopiera receptet. Försök igen.' }
    }
  })

const toggleRecipeLikeFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ recipeId: z.string() }))
  .handler(async ({ data, context }): Promise<{ liked: boolean } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att gilla recept' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/toggle_recipe_like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_recipe_id: data.recipeId }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to toggle recipe like:', errorText)

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
          // Fall through to generic message
        }

        return { error: 'Kunde inte uppdatera gillning' }
      }

      const result = await response.json()

      return { liked: result.liked }
    } catch (error) {
      console.error('Error toggling recipe like:', error)
      return { error: 'Kunde inte uppdatera gillning' }
    }
  })

const importRecipeFromUrlFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ url: z.string() }))
  .handler(async ({ data, context }): Promise<ImportRecipeResult> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return {
        success: false,
        error: 'Du måste vara inloggad för att importera recept',
        sourceUrl: data.url,
      }
    }

    try {
      let parsedUrl: URL
      try {
        parsedUrl = new URL(data.url)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return {
            success: false,
            error: 'Ogiltig URL. Endast HTTP och HTTPS stöds.',
            sourceUrl: data.url,
          }
        }
      } catch {
        return {
          success: false,
          error: 'Ogiltig URL-format',
          sourceUrl: data.url,
        }
      }

      let jsonLd = null
      let pageText: string | null = null

      try {
        const response = await fetch(data.url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; RecipeImporter/1.0; recipe parser)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
          },
        })

        if (response.ok) {
          const html = await response.text()

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

      if (!jsonLd) {
        const playwrightResult = await fetchWithPlaywright(data.url)
        jsonLd = playwrightResult.jsonLd
        pageText = playwrightResult.pageText
      }

      if (!jsonLd) {
        return {
          success: false,
          error: pageText
            ? 'Ingen strukturerad receptdata hittades. Prova med AI för att tolka sidans innehåll.'
            : 'Kunde inte hämta innehåll från sidan.',
          sourceUrl: data.url,
          pageText: pageText || undefined,
        }
      }

      const { data: recipeData, warnings, lowConfidenceIngredients } = mapJsonLdToRecipeInput(jsonLd, data.url)

      if (recipeData.ingredients && recipeData.ingredients.length > 0) {
        const ingredientsToMatch = recipeData.ingredients.filter(
          (i): i is { name: string; measurement: string; quantity: string } =>
            'name' in i
        )

        if (ingredientsToMatch.length > 0) {
          const matchedIngredients =
            await matchIngredientsToDatabase(ingredientsToMatch, postgrestToken)

          let matchIndex = 0
          recipeData.ingredients = recipeData.ingredients.map((ing) => {
            if ('name' in ing) {
              return matchedIngredients[matchIndex++]
            }
            return ing
          })
        }
      }

      return {
        success: true,
        data: recipeData,
        warnings: warnings.length > 0 ? warnings : undefined,
        lowConfidenceIngredients: lowConfidenceIngredients.length > 0 ? lowConfidenceIngredients : undefined,
        sourceUrl: data.url,
      }
    } catch (error) {
      console.error('Error importing recipe from URL:', error)
      return {
        success: false,
        error: 'Ett oväntat fel uppstod vid import. Försök igen.',
        sourceUrl: data.url,
      }
    }
  })

const fetchUrlPageTextFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ url: z.string() }))
  .handler(async ({ data, context }): Promise<{ pageText: string | null; error?: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { pageText: null, error: 'Du måste vara inloggad' }
    }

    try {
      let parsedUrl: URL
      try {
        parsedUrl = new URL(data.url)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return { pageText: null, error: 'Ogiltig URL' }
        }
      } catch {
        return { pageText: null, error: 'Ogiltig URL-format' }
      }

      if ((PROVECHO_HOSTNAMES as readonly string[]).includes(parsedUrl.hostname)) {
        const response = await fetch(data.url, {
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

      const result = await fetchWithPlaywright(data.url)
      if (!result.pageText) {
        return { pageText: null, error: 'Kunde inte hämta sidans innehåll' }
      }
      return { pageText: result.pageText }
    } catch (error) {
      console.error('Error fetching page text:', error)
      return { pageText: null, error: 'Ett oväntat fel uppstod' }
    }
  })

const downloadAndSaveImageFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ imageUrl: z.string() }))
  .handler(async ({ data }): Promise<{ filename: string } | { error: string }> => {
    try {
      const result = await downloadImage(data.imageUrl)

      if (!result.success || !result.filename) {
        return { error: result.error || 'Kunde inte ladda ner bilden' }
      }

      return { filename: result.filename }
    } catch (error) {
      console.error('Error downloading image:', error)
      return { error: 'Ett fel uppstod vid nedladdning av bilden' }
    }
  })

const createShareLinkFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ recipeId: z.string(), expiresDays: z.number().optional() }))
  .handler(async ({ data, context }): Promise<{ token: string; url: string; expires_at: string | null } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att dela recept' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/create_share_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({
          p_recipe_id: data.recipeId,
          p_expires_days: data.expiresDays ?? null,
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
      const row = Array.isArray(result) ? result[0] : result

      if (!row || !row.token) {
        return { error: 'Kunde inte skapa delningslänk' }
      }

      const baseUrl = env.APP_URL || 'http://localhost:3000'
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
  })

const revokeShareLinkFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ shareToken: z.string() }))
  .handler(async ({ data, context }): Promise<{ success: boolean } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/revoke_share_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_token: data.shareToken }),
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
  })

const getShareLinksFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ recipeId: z.string() }))
  .handler(async ({ data, context }): Promise<{ links: ShareLink[] } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/get_recipe_share_tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_recipe_id: data.recipeId }),
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
  })

const copySharedRecipeFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ shareToken: z.string() }))
  .handler(async ({ data, context }): Promise<{ newRecipeId: string } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att spara recept' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/copy_shared_recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_token: data.shareToken }),
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

      return { newRecipeId: result }
    } catch (error) {
      console.error('Error copying shared recipe:', error)
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

// ============================================================================
// Exported wrappers (preserve existing call signatures)
// ============================================================================

export async function loadMoreRecipes(options: {
  offset: number
  limit: number
  ownerIds?: string[]
}): Promise<Recipe[]> {
  return loadMoreRecipesFn({ data: options })
}

export async function deductAiCredit(
  description: string
): Promise<{ remainingCredits: number } | { error: string }> {
  return deductAiCreditFn({ data: { description } })
}

export async function createRecipe(
  data: CreateRecipeInput
): Promise<{ id: string } | { error: string }> {
  return createRecipeFn({ data })
}

export async function updateRecipe(
  id: string,
  data: UpdateRecipeInput
): Promise<{ success: boolean } | { error: string }> {
  return updateRecipeFn({ data: { id, data } })
}

export async function deleteRecipe(
  id: string
): Promise<{ success: boolean } | { error: string }> {
  return deleteRecipeFn({ data: { id } })
}

export async function copyRecipe(
  recipeId: string
): Promise<{ newRecipeId: string } | { error: string }> {
  return copyRecipeFn({ data: { recipeId } })
}

export async function toggleRecipeLike(
  recipeId: string
): Promise<{ liked: boolean } | { error: string }> {
  return toggleRecipeLikeFn({ data: { recipeId } })
}

export async function importRecipeFromUrl(
  url: string
): Promise<ImportRecipeResult> {
  return importRecipeFromUrlFn({ data: { url } })
}

export async function fetchUrlPageText(
  url: string
): Promise<{ pageText: string | null; error?: string }> {
  return fetchUrlPageTextFn({ data: { url } })
}

export async function downloadAndSaveImage(
  imageUrl: string
): Promise<{ filename: string } | { error: string }> {
  return downloadAndSaveImageFn({ data: { imageUrl } })
}

export async function createShareLink(
  recipeId: string,
  expiresDays?: number
): Promise<{ token: string; url: string; expires_at: string | null } | { error: string }> {
  return createShareLinkFn({ data: { recipeId, expiresDays } })
}

export async function revokeShareLink(
  shareToken: string
): Promise<{ success: boolean } | { error: string }> {
  return revokeShareLinkFn({ data: { shareToken } })
}

export async function getShareLinks(
  recipeId: string
): Promise<{ links: ShareLink[] } | { error: string }> {
  return getShareLinksFn({ data: { recipeId } })
}

export async function copySharedRecipe(
  shareToken: string
): Promise<{ newRecipeId: string } | { error: string }> {
  return copySharedRecipeFn({ data: { shareToken } })
}

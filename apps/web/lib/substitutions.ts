import { env } from '@/lib/env'
import type { IngredientSubstitution, SubstitutionSuggestion, SubstitutionResponse } from '@/lib/ingredient-search-types'
import { createMistralClient, MISTRAL_MODEL } from '@/lib/ai-client'
import { z, toJSONSchema } from 'zod'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'substitutions' })

export interface SubstitutionInput {
  recipe_id: string
  missing_food_ids: string[]
  available_food_ids: string[]
  user_preferences?: {
    dietary_restrictions?: string[]
    flavor_preferences?: string[]
  }
}

interface FoodInfo {
  id: string
  name: string
}

const SubstitutionZodSchema = z.object({
  substitutions: z.array(z.object({
    original_food_id: z.string().describe('The ID of the original missing ingredient'),
    original_name: z.string().describe('The name of the original missing ingredient'),
    suggestions: z.array(z.object({
      substitute_name: z.string().describe('Name of the suggested substitute ingredient'),
      available: z.boolean().describe('Whether this substitute is in the users available ingredients'),
      confidence: z.enum(['high', 'medium', 'low']).describe('Confidence level for this substitution'),
      notes: z.string().describe('Brief explanation of how to use this substitute, any adjustments needed'),
    })),
  })),
})

const SUBSTITUTION_JSON_SCHEMA = toJSONSchema(SubstitutionZodSchema)

function buildSystemPrompt(userPreferences?: SubstitutionInput['user_preferences']): string {
  let prompt = `Du ar en expert pa svensk matlagning och ingrediensersattningar. Din uppgift ar att foresla ersattningar for ingredienser som saknas i ett recept.

For varje saknad ingrediens, foresla 1-3 mojliga ersattningar. Prioritera:
1. Ersattningar som finns bland anvandarens tillgangliga ingredienser (markera available: true)
2. Vanliga svenska koksvaror som de flesta har hemma
3. Ersattningar som ger liknande smak och textur

Ange confidence-niva:
- "high": Ersattningen fungerar mycket bra, nastan identiskt resultat
- "medium": Ersattningen fungerar bra men kan ge lite annorlunda resultat
- "low": Ersattningen fungerar i nodfall men receptet blir annorlunda

I notes-faltet, ge korta praktiska tips pa svenska om hur ersattningen anvands, t.ex. mangdjusteringar eller tillagningstips.`

  if (userPreferences?.dietary_restrictions?.length) {
    prompt += `\n\nAnvandarens kostbegraningar att ta hansyn till: ${userPreferences.dietary_restrictions.join(', ')}`
  }

  if (userPreferences?.flavor_preferences?.length) {
    prompt += `\n\nAnvandarens smakpreferenser: ${userPreferences.flavor_preferences.join(', ')}`
  }

  return prompt
}

async function fetchFoodNames(foodIds: string[]): Promise<Map<string, string>> {
  if (foodIds.length === 0) return new Map()

  try {
    const idsParam = foodIds.map((id) => `"${id}"`).join(',')
    const response = await fetch(
      `${env.POSTGREST_URL}/foods?id=in.(${idsParam})&select=id,name`
    )

    if (!response.ok) return new Map()

    const foods: FoodInfo[] = await response.json()
    return new Map(foods.map((f) => [f.id, f.name]))
  } catch {
    return new Map()
  }
}

async function fetchRecipeInfo(
  recipeId: string
): Promise<{ name: string; ingredients: string[] } | null> {
  try {
    const response = await fetch(
      `${env.POSTGREST_URL}/user_recipes?id=eq.${recipeId}&select=name,ingredients`
    )

    if (!response.ok) return null

    const recipes = await response.json()
    if (recipes.length === 0) return null

    const recipe = recipes[0]
    const ingredientNames = (recipe.ingredients || []).map(
      (ing: { name: string }) => ing.name
    )

    return { name: recipe.name, ingredients: ingredientNames }
  } catch {
    return null
  }
}

/**
 * Get substitution suggestions for missing ingredients in a recipe.
 * This is the core business logic, callable from both API routes and server functions.
 */
export async function getSubstitutionSuggestions(
  input: SubstitutionInput
): Promise<SubstitutionResponse | { error: string; status?: number }> {
  if (!input.recipe_id) {
    return { error: 'recipe_id kravs', status: 400 }
  }

  if (!input.missing_food_ids || input.missing_food_ids.length === 0) {
    return { error: 'missing_food_ids kravs', status: 400 }
  }

  if (!env.MISTRAL_API_KEY) {
    return { error: 'AI-tjansten ar inte konfigurerad', status: 503 }
  }

  // Fetch food names and recipe info in parallel
  const [missingFoodNames, availableFoodNames, recipeInfo] = await Promise.all([
    fetchFoodNames(input.missing_food_ids),
    fetchFoodNames(input.available_food_ids || []),
    fetchRecipeInfo(input.recipe_id),
  ])

  if (!recipeInfo) {
    return { error: 'Receptet hittades inte', status: 404 }
  }

  // Build the user prompt with context
  const missingIngredients = input.missing_food_ids
    .map((id) => ({
      id,
      name: missingFoodNames.get(id) || 'Okand ingrediens',
    }))
    .filter((ing) => ing.name !== 'Okand ingrediens')

  if (missingIngredients.length === 0) {
    return { error: 'Inga giltiga saknade ingredienser', status: 400 }
  }

  const availableIngredientNames = Array.from(availableFoodNames.values())

  const userPrompt = `Recept: ${recipeInfo.name}
Alla ingredienser i receptet: ${recipeInfo.ingredients.join(', ')}

Saknade ingredienser som behover ersattas:
${missingIngredients.map((ing) => `- ${ing.name} (id: ${ing.id})`).join('\n')}

Tillgangliga ingredienser hos anvandaren:
${availableIngredientNames.length > 0 ? availableIngredientNames.join(', ') : 'Inga specifika ingredienser angivna'}

Foresla ersattningar for varje saknad ingrediens.`

  // Call Mistral API
  const client = createMistralClient()

  const response = await client.chat.complete({
    model: MISTRAL_MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(input.user_preferences) },
      { role: 'user', content: userPrompt },
    ],
    responseFormat: {
      type: 'json_schema',
      jsonSchema: {
        name: 'substitutions',
        schemaDefinition: SUBSTITUTION_JSON_SCHEMA,
        strict: true,
      },
    },
  })

  const generatedText = response.choices?.[0]?.message?.content

  if (!generatedText || typeof generatedText !== 'string') {
    logger.error({ detail: response }, 'No content in AI response')
    return { error: 'Ingen ersattning kunde genereras', status: 422 }
  }

  // Parse and validate the response
  let parsedResponse: { substitutions: IngredientSubstitution[] }
  try {
    parsedResponse = JSON.parse(generatedText)
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : String(error), response: generatedText }, 'JSON parse error')
    return { error: 'AI-svaret kunde inte tolkas', status: 422 }
  }

  if (!parsedResponse.substitutions || !Array.isArray(parsedResponse.substitutions)) {
    logger.error({ detail: parsedResponse }, 'Invalid response structure')
    return { error: 'AI-svaret har fel format', status: 422 }
  }

  // Validate each substitution result
  const validatedSubstitutions: IngredientSubstitution[] = parsedResponse.substitutions.map(
    (sub) => ({
      original_food_id: String(sub.original_food_id),
      original_name: String(sub.original_name),
      suggestions: (sub.suggestions || []).map(
        (sug: SubstitutionSuggestion) => ({
          substitute_name: String(sug.substitute_name),
          available: Boolean(sug.available),
          confidence: ['high', 'medium', 'low'].includes(sug.confidence)
            ? (sug.confidence as 'high' | 'medium' | 'low')
            : 'medium',
          notes: String(sug.notes || ''),
        })
      ),
    })
  )

  return { substitutions: validatedSubstitutions }
}

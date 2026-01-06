import { getSession } from '@/lib/auth'
import { env } from '@/lib/env'
import { IngredientSubstitution, SubstitutionSuggestion } from '@/lib/ingredient-search-types'
import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = 'gemini-2.5-flash'
const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:4444'

interface SubstitutionRequest {
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

// Schema for Gemini structured output
const SUBSTITUTION_SCHEMA = {
  type: 'object' as const,
  properties: {
    substitutions: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          original_food_id: {
            type: 'string' as const,
            description: 'The ID of the original missing ingredient',
          },
          original_name: {
            type: 'string' as const,
            description: 'The name of the original missing ingredient',
          },
          suggestions: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                substitute_name: {
                  type: 'string' as const,
                  description: 'Name of the suggested substitute ingredient',
                },
                available: {
                  type: 'boolean' as const,
                  description:
                    'Whether this substitute is in the users available ingredients',
                },
                confidence: {
                  type: 'string' as const,
                  enum: ['high', 'medium', 'low'],
                  description: 'Confidence level for this substitution',
                },
                notes: {
                  type: 'string' as const,
                  description:
                    'Brief explanation of how to use this substitute, any adjustments needed',
                },
              },
              required: [
                'substitute_name',
                'available',
                'confidence',
                'notes',
              ],
            },
          },
        },
        required: ['original_food_id', 'original_name', 'suggestions'],
      },
    },
  },
  required: ['substitutions'],
}

function buildSystemPrompt(userPreferences?: SubstitutionRequest['user_preferences']): string {
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
      `${POSTGREST_URL}/foods?id=in.(${idsParam})&select=id,name`
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
      `${POSTGREST_URL}/recipes_and_categories?id=eq.${recipeId}&select=name,ingredients`
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

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body: SubstitutionRequest = await request.json()

    if (!body.recipe_id) {
      return NextResponse.json(
        { error: 'recipe_id kravs' },
        { status: 400 }
      )
    }

    if (!body.missing_food_ids || body.missing_food_ids.length === 0) {
      return NextResponse.json(
        { error: 'missing_food_ids kravs' },
        { status: 400 }
      )
    }

    // Check if Gemini API is configured
    const geminiApiKey = env.GEMINI_API_KEY

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'AI-tjansten ar inte konfigurerad' },
        { status: 503 }
      )
    }

    // Fetch food names and recipe info in parallel
    const [missingFoodNames, availableFoodNames, recipeInfo] = await Promise.all([
      fetchFoodNames(body.missing_food_ids),
      fetchFoodNames(body.available_food_ids || []),
      fetchRecipeInfo(body.recipe_id),
    ])

    if (!recipeInfo) {
      return NextResponse.json(
        { error: 'Receptet hittades inte' },
        { status: 404 }
      )
    }

    // Build the user prompt with context
    const missingIngredients = body.missing_food_ids
      .map((id) => ({
        id,
        name: missingFoodNames.get(id) || 'Okand ingrediens',
      }))
      .filter((ing) => ing.name !== 'Okand ingrediens')

    if (missingIngredients.length === 0) {
      return NextResponse.json(
        { error: 'Inga giltiga saknade ingredienser' },
        { status: 400 }
      )
    }

    const availableIngredientNames = Array.from(availableFoodNames.values())

    const userPrompt = `Recept: ${recipeInfo.name}
Alla ingredienser i receptet: ${recipeInfo.ingredients.join(', ')}

Saknade ingredienser som behover ersattas:
${missingIngredients.map((ing) => `- ${ing.name} (id: ${ing.id})`).join('\n')}

Tillgangliga ingredienser hos anvandaren:
${availableIngredientNames.length > 0 ? availableIngredientNames.join(', ') : 'Inga specifika ingredienser angivna'}

Foresla ersattningar for varje saknad ingrediens.`

    // Call Gemini API
    const ai = new GoogleGenAI({ apiKey: geminiApiKey })

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: buildSystemPrompt(body.user_preferences),
        responseMimeType: 'application/json',
        responseSchema: SUBSTITUTION_SCHEMA,
      },
    })

    const generatedText = response.text

    if (!generatedText) {
      console.error('No content in Gemini response:', response)
      return NextResponse.json(
        { error: 'Ingen ersattning kunde genereras' },
        { status: 422 }
      )
    }

    // Parse and validate the response
    let parsedResponse: { substitutions: IngredientSubstitution[] }
    try {
      parsedResponse = JSON.parse(generatedText)
    } catch (error) {
      console.error('JSON parse error:', error, 'Response:', generatedText)
      return NextResponse.json(
        { error: 'AI-svaret kunde inte tolkas' },
        { status: 422 }
      )
    }

    // Validate the structure
    if (!parsedResponse.substitutions || !Array.isArray(parsedResponse.substitutions)) {
      console.error('Invalid response structure:', parsedResponse)
      return NextResponse.json(
        { error: 'AI-svaret har fel format' },
        { status: 422 }
      )
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

    return NextResponse.json({ substitutions: validatedSubstitutions })
  } catch (error) {
    console.error('Substitution API error:', error)
    return NextResponse.json(
      { error: 'Ett ovantad fel uppstod' },
      { status: 500 }
    )
  }
}

import { env } from "@/lib/env"
import { createMistralClient, MISTRAL_MODEL } from "@/lib/ai-client"
import { buildMealPlanPrompt } from "@/lib/meal-plan/prompt"
import { MEAL_PLAN_JSON_SCHEMA, MealPlanResponseSchema } from "@/lib/meal-plan/types"
import type { MealPlanResponse, SuggestedRecipe } from "@/lib/meal-plan/types"

// ── Shared interfaces ──────────────────────────────────────────────

export interface CompactRecipe {
  id: string
  name: string
  image: string | null
  thumbnail: string | null
  categories: string[]
  prep_time: number | null
  cook_time: number | null
  recipe_yield: number | null
}

export interface BaseRecipe {
  id: string
  name: string
  description: string
  source_url: string
  source_site: string
  prep_time: number | null
  cook_time: number | null
  recipe_yield: number | null
  recipe_yield_name: string | null
  diet_type: string
  categories: string[]
  ingredients: SuggestedRecipe["ingredient_groups"]
  instructions: SuggestedRecipe["instruction_groups"]
}

export interface MealPlanPreferencesInput {
  categories: string[]
  meal_types: string[]
  days?: number[]
  servings: number
  max_suggestions?: number
}

export type EnrichedEntry = MealPlanResponse["entries"][number] & {
  recipe_name?: string
  recipe_image?: string | null
  recipe_thumbnail?: string | null
  recipe_prep_time?: number | null
  recipe_cook_time?: number | null
  recipe_yield?: number | null
  recipe_categories?: string[]
}

export interface GenerateMealPlanResult {
  entries: EnrichedEntry[]
  summary: string
}

// ── Data fetching ──────────────────────────────────────────────────

export async function fetchUserRecipes(
  postgrestToken: string,
  homeId?: string,
): Promise<CompactRecipe[]> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${postgrestToken}`,
    Accept: "application/json",
  }
  if (homeId) {
    headers["X-Active-Home-Id"] = homeId
  }

  const response = await fetch(
    `${env.POSTGREST_URL}/user_recipes?select=id,name,image,thumbnail,categories,prep_time,cook_time,recipe_yield&order=date_modified.desc&limit=300`,
    { headers, cache: "no-store" },
  )

  if (!response.ok) {
    return []
  }

  return response.json()
}

export async function fetchPantryItems(
  postgrestToken: string,
  homeId?: string,
): Promise<string[]> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${postgrestToken}`,
    "Content-Type": "application/json",
  }
  if (homeId) {
    headers["X-Active-Home-Id"] = homeId
  }

  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_user_pantry`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    return []
  }

  const items: Array<{ food_name: string }> = await response.json()
  return items.map((i) => i.food_name)
}

export async function fetchBaseRecipes(
  postgrestToken: string,
  dietTypes?: string[],
  categories?: string[],
  limit: number = 50,
): Promise<BaseRecipe[]> {
  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_base_recipes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${postgrestToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_diet_types: dietTypes && dietTypes.length > 0 ? dietTypes : null,
      p_categories: categories && categories.length > 0 ? categories : null,
      p_limit: limit,
    }),
  })

  if (!response.ok) {
    return []
  }

  return response.json()
}

// ── Validation & enrichment ────────────────────────────────────────

/**
 * Validate AI response entries: resolve BASE: references, clear unknown
 * recipe IDs, and deduplicate by day_of_week + meal_type.
 */
export function validateAndEnrichEntries(
  entries: MealPlanResponse["entries"],
  userRecipes: CompactRecipe[],
  baseRecipes: BaseRecipe[],
): MealPlanResponse["entries"] {
  const baseRecipeMap = new Map(baseRecipes.map((r) => [r.id, r]))
  const validRecipeIds = new Set(userRecipes.map((r) => r.id))

  // Resolve BASE: references and clear unknown recipe IDs
  let resolved = entries.map((entry) => {
    if (!entry.recipe_id) return entry

    // Check for base recipe references (BASE:uuid)
    if (entry.recipe_id.startsWith("BASE:")) {
      const baseId = entry.recipe_id.slice(5)
      const base = baseRecipeMap.get(baseId)
      if (base) {
        return {
          ...entry,
          recipe_id: null,
          suggested_name: base.name,
          suggested_description: base.description || null,
          suggested_recipe: {
            recipe_name: base.name,
            description: base.description,
            recipe_yield: base.recipe_yield,
            prep_time: base.prep_time,
            cook_time: base.cook_time,
            categories: base.categories,
            ingredient_groups: base.ingredients,
            instruction_groups: base.instructions,
            source_url: base.source_url,
            source_site: base.source_site,
          },
        }
      }
      // Base recipe not found -- treat as unknown
      return {
        ...entry,
        suggested_name: entry.suggested_name || "Okant basrecept",
        recipe_id: null,
      }
    }

    if (!validRecipeIds.has(entry.recipe_id)) {
      // Unknown recipe ID -- treat as suggestion
      return {
        ...entry,
        suggested_name: entry.suggested_name || "Okant recept",
        recipe_id: null,
      }
    }
    return entry
  })

  // Deduplicate entries -- keep first entry per day_of_week + meal_type
  const seen = new Set<string>()
  resolved = resolved.filter((entry) => {
    const key = `${entry.day_of_week}-${entry.meal_type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return resolved
}

/**
 * Attach user recipe details (name, image, etc.) to entries that reference
 * existing recipes, for frontend display.
 */
export function enrichEntriesWithRecipeDetails(
  entries: MealPlanResponse["entries"],
  userRecipes: CompactRecipe[],
): EnrichedEntry[] {
  const recipeMap = new Map(userRecipes.map((r) => [r.id, r]))
  return entries.map((entry) => {
    if (entry.recipe_id) {
      const recipe = recipeMap.get(entry.recipe_id)
      if (recipe) {
        return {
          ...entry,
          recipe_name: recipe.name,
          recipe_image: recipe.image,
          recipe_thumbnail: recipe.thumbnail,
          recipe_prep_time: recipe.prep_time,
          recipe_cook_time: recipe.cook_time,
          recipe_yield: recipe.recipe_yield,
          recipe_categories: recipe.categories,
        }
      }
    }
    return entry
  })
}

// ── AI generation ──────────────────────────────────────────────────

/**
 * Call the Mistral AI to generate a meal plan, parse and validate the
 * response. Returns the validated entries and summary, or throws on failure.
 */
export async function generateMealPlan(params: {
  filteredRecipes: CompactRecipe[]
  baseRecipes: BaseRecipe[]
  userRecipes: CompactRecipe[]
  preferences: MealPlanPreferencesInput
  pantryItems: string[]
}): Promise<GenerateMealPlanResult> {
  const { filteredRecipes, baseRecipes, userRecipes, preferences, pantryItems } = params

  // Compute effective max_suggestions
  const selectedDays =
    preferences.days && preferences.days.length > 0 && preferences.days.length < 7
      ? preferences.days
      : [1, 2, 3, 4, 5, 6, 7]
  const totalEntries = selectedDays.length * preferences.meal_types.length
  const fromExisting = totalEntries - (preferences.max_suggestions ?? 3)
  const availableRecipes = filteredRecipes.length + baseRecipes.length
  const effectiveMaxSuggestions =
    fromExisting > availableRecipes
      ? totalEntries - availableRecipes
      : (preferences.max_suggestions ?? 3)

  const prompt = buildMealPlanPrompt(
    filteredRecipes,
    preferences,
    pantryItems.length > 0 ? pantryItems : undefined,
    effectiveMaxSuggestions,
    preferences.days,
    baseRecipes,
  )

  const client = createMistralClient()

  const response = await client.chat.complete({
    model: MISTRAL_MODEL,
    messages: [{ role: "user", content: prompt }],
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "meal_plan",
        schemaDefinition: MEAL_PLAN_JSON_SCHEMA,
        strict: true,
      },
    },
  })

  const generatedText = response.choices?.[0]?.message?.content
  if (!generatedText || typeof generatedText !== "string") {
    throw new MealPlanGenerationError("no_response", "Inget svar fran AI")
  }

  let parsed: MealPlanResponse
  try {
    const raw = JSON.parse(generatedText)
    const result = MealPlanResponseSchema.safeParse(raw)
    if (!result.success) {
      throw new MealPlanGenerationError("invalid_response", "AI returnerade ogiltigt svar")
    }
    parsed = result.data
  } catch (e) {
    if (e instanceof MealPlanGenerationError) throw e
    throw new MealPlanGenerationError("invalid_response", "AI returnerade ogiltigt svar")
  }

  // Validate and resolve entries
  const validatedEntries = validateAndEnrichEntries(parsed.entries, userRecipes, baseRecipes)

  // Enrich with recipe details for the frontend
  const enrichedEntries = enrichEntriesWithRecipeDetails(validatedEntries, userRecipes)

  return {
    entries: enrichedEntries,
    summary: parsed.summary,
  }
}

// ── Save plan ──────────────────────────────────────────────────────

export async function saveMealPlan(
  postgrestToken: string,
  weekStart: string,
  preferences: MealPlanPreferencesInput,
  entries: MealPlanResponse["entries"],
  servings: number,
  homeId?: string,
): Promise<string | null> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${postgrestToken}`,
    "Content-Type": "application/json",
  }
  if (homeId) {
    headers["X-Active-Home-Id"] = homeId
  }

  const response = await fetch(`${env.POSTGREST_URL}/rpc/save_meal_plan`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_week_start: weekStart,
      p_preferences: preferences,
      p_entries: entries.map((e) => ({
        day_of_week: e.day_of_week,
        meal_type: e.meal_type,
        recipe_id: e.recipe_id,
        suggested_name: e.suggested_name,
        suggested_description: e.suggested_description,
        suggested_recipe: e.suggested_recipe || null,
        servings,
      })),
    }),
  })

  if (!response.ok) {
    return null
  }

  return response.json()
}

// ── Recipe filtering ───────────────────────────────────────────────

/**
 * Filter recipes by category preferences, falling back to unfiltered list
 * when the filter yields fewer than 5 results.
 */
export function filterRecipesByCategories(
  recipes: CompactRecipe[],
  categories: string[],
): CompactRecipe[] {
  if (categories.length === 0) return recipes

  const categoriesLower = categories.map((c) => c.toLowerCase())
  const filtered = recipes.filter((r) =>
    r.categories.some((c) => categoriesLower.includes(c.toLowerCase())),
  )

  // Fall back to all recipes if filter leaves too few
  return filtered.length < 5 ? recipes : filtered
}

// ── Error class ────────────────────────────────────────────────────

export type MealPlanErrorCode = "no_response" | "invalid_response"

export class MealPlanGenerationError extends Error {
  code: MealPlanErrorCode

  constructor(code: MealPlanErrorCode, message: string) {
    super(message)
    this.name = "MealPlanGenerationError"
    this.code = code
  }
}

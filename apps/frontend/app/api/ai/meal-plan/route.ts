import { getSession, signPostgrestToken, signSystemPostgrestToken } from "@/lib/auth"
import { env } from "@/lib/env"
import { buildMealPlanPrompt } from "@/lib/meal-plan/prompt"
import { MEAL_PLAN_JSON_SCHEMA, MealPlanResponseSchema } from "@/lib/meal-plan/types"
import type { MealPlanResponse, SuggestedRecipe } from "@/lib/meal-plan/types"
import { createMistralClient, MISTRAL_MODEL } from "@/lib/ai-client"
import { NextRequest, NextResponse } from "next/server"

async function deductCredit(
  postgrestToken: string,
  description: string,
): Promise<{ success: true; remainingCredits: number } | { success: false }> {
  const response = await fetch(`${env.POSTGREST_URL}/rpc/deduct_credit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${postgrestToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_description: description }),
  })

  if (!response.ok) {
    return { success: false }
  }

  const remainingCredits = await response.json()
  return { success: true, remainingCredits }
}

async function refundCredit(
  userEmail: string,
  description: string,
): Promise<void> {
  const systemToken = await signSystemPostgrestToken()
  await fetch(`${env.POSTGREST_URL}/rpc/add_credits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${systemToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_user_email: userEmail,
      p_amount: 1,
      p_transaction_type: "refund",
      p_description: description,
    }),
  })
}

interface CompactRecipe {
  id: string
  name: string
  image: string | null
  thumbnail: string | null
  categories: string[]
  prep_time: number | null
  cook_time: number | null
  recipe_yield: number | null
}

async function fetchUserRecipes(
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

async function fetchPantryItems(
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

interface BaseRecipe {
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

async function fetchBaseRecipes(
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

async function saveMealPlan(
  postgrestToken: string,
  weekStart: string,
  preferences: Record<string, unknown>,
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

export async function POST(request: NextRequest) {
  let creditDeducted = false
  let userEmail: string | null = null

  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    userEmail = session.email

    const body = await request.json()
    const {
      week_start,
      preferences = { categories: [], meal_types: ["middag"], days: [1, 2, 3, 4, 5, 6, 7], servings: 4, max_suggestions: 3 },
      home_id,
    } = body as {
      week_start: string
      preferences: { categories: string[]; meal_types: string[]; days?: number[]; servings: number; max_suggestions?: number }
      home_id?: string
    }

    if (!week_start) {
      return NextResponse.json(
        { error: "week_start krävs" },
        { status: 400 },
      )
    }

    if (!env.MISTRAL_API_KEY) {
      return NextResponse.json(
        { error: "AI-generering är inte konfigurerat" },
        { status: 503 },
      )
    }

    const postgrestToken = await signPostgrestToken(session.email)

    // Atomically deduct credit BEFORE the AI call to prevent race conditions.
    // If AI fails, we refund below.
    const creditDescription = `Matplan: v.${week_start}`
    const deductResult = await deductCredit(postgrestToken, creditDescription)

    if (!deductResult.success) {
      return NextResponse.json(
        {
          error: "Du har inga AI-poäng kvar. Köp fler i menyn.",
          code: "INSUFFICIENT_CREDITS",
        },
        { status: 402 },
      )
    }
    creditDeducted = true

    // Fetch recipes, pantry, and base recipes in parallel
    const [recipes, pantryItems, baseRecipes] = await Promise.all([
      fetchUserRecipes(postgrestToken, home_id),
      fetchPantryItems(postgrestToken, home_id),
      fetchBaseRecipes(postgrestToken, undefined, preferences.categories),
    ])

    // Filter by category preferences if set
    let filteredRecipes = recipes
    if (preferences.categories.length > 0) {
      const categoriesLower = preferences.categories.map((d) => d.toLowerCase())
      filteredRecipes = recipes.filter((r) =>
        r.categories.some((c) => categoriesLower.includes(c.toLowerCase())),
      )
      // Fall back to all recipes if filter leaves too few
      if (filteredRecipes.length < 5) {
        filteredRecipes = recipes
      }
    }

    // Ensure max_suggestions is high enough when there aren't enough recipes
    const selectedDays = preferences.days && preferences.days.length > 0 && preferences.days.length < 7
      ? preferences.days
      : [1, 2, 3, 4, 5, 6, 7]
    const totalEntries = selectedDays.length * preferences.meal_types.length
    const fromExisting = totalEntries - (preferences.max_suggestions ?? 3)
    // Count both user recipes and base recipes as available picks
    const availableRecipes = filteredRecipes.length + baseRecipes.length
    const effectiveMaxSuggestions = fromExisting > availableRecipes
      ? totalEntries - availableRecipes
      : preferences.max_suggestions ?? 3

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
      messages: [
        { role: "user", content: prompt },
      ],
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
      await refundCredit(session.email, `Återbetalning: inget AI-svar`)
      return NextResponse.json(
        { error: "Inget svar från AI" },
        { status: 422 },
      )
    }

    let parsed: MealPlanResponse
    try {
      const raw = JSON.parse(generatedText)
      const result = MealPlanResponseSchema.safeParse(raw)
      if (!result.success) {
        await refundCredit(session.email, `Återbetalning: ogiltigt AI-svar`)
        return NextResponse.json(
          { error: "AI returnerade ogiltigt svar" },
          { status: 422 },
        )
      }
      parsed = result.data
    } catch {
      await refundCredit(session.email, `Återbetalning: ogiltigt AI-svar`)
      return NextResponse.json(
        { error: "AI returnerade ogiltigt svar" },
        { status: 422 },
      )
    }

    // Build lookup for base recipes
    const baseRecipeMap = new Map(baseRecipes.map((r) => [r.id, r]))

    // Validate returned recipe_ids against the sent set
    const validRecipeIds = new Set(recipes.map((r) => r.id))
    parsed.entries = parsed.entries.map((entry) => {
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
        // Base recipe not found — treat as unknown
        return {
          ...entry,
          suggested_name: entry.suggested_name || "Okänt basrecept",
          recipe_id: null,
        }
      }

      if (!validRecipeIds.has(entry.recipe_id)) {
        // Unknown recipe ID — treat as suggestion
        return {
          ...entry,
          suggested_name: entry.suggested_name || `Okänt recept`,
          recipe_id: null,
        }
      }
      return entry
    })

    // Deduplicate entries — keep first entry per day_of_week + meal_type
    const seen = new Set<string>()
    parsed.entries = parsed.entries.filter((entry) => {
      const key = `${entry.day_of_week}-${entry.meal_type}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Save the plan
    const planId = await saveMealPlan(
      postgrestToken,
      week_start,
      preferences,
      parsed.entries,
      preferences.servings,
      home_id,
    )

    // Enrich entries with recipe details for the frontend
    const recipeMap = new Map(recipes.map((r) => [r.id, r]))
    const enrichedEntries = parsed.entries.map((entry) => {
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

    return NextResponse.json({
      plan_id: planId,
      entries: enrichedEntries,
      summary: parsed.summary,
      remainingCredits: deductResult.remainingCredits,
    })
  } catch (error) {
    console.error("Meal plan generation error:", error)
    if (creditDeducted && userEmail) {
      await refundCredit(userEmail, "Återbetalning: serverfel").catch(() => {})
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

import { getSession, signPostgrestToken } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

const POSTGREST_URL = process.env.POSTGREST_URL || "http://localhost:4444"

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

interface IngredientInput {
  group?: string
  name?: string
  measurement?: string
  quantity?: string
}

async function searchFood(query: string): Promise<FoodMatch | null> {
  if (!query || query.length < 2) return null

  try {
    const response = await fetch(`${POSTGREST_URL}/rpc/search_foods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  ingredients: IngredientInput[]
): Promise<IngredientInput[]> {
  const matched = await Promise.all(
    ingredients.map(async (ing) => {
      // Skip group markers
      if ("group" in ing && ing.group) {
        return ing
      }

      if (!ing.name) {
        return ing
      }

      const [foodMatch, unitMatch] = await Promise.all([
        searchFood(ing.name),
        ing.measurement ? searchUnit(ing.measurement) : null,
      ])

      return {
        name: foodMatch?.name || ing.name,
        measurement: unitMatch?.abbreviation || unitMatch?.name || ing.measurement || "",
        quantity: ing.quantity || "",
      }
    })
  )

  return matched
}

/**
 * POST /api/admin/restructure/apply
 * Applies the restructured ingredients and/or improved instructions to a recipe.
 *
 * Body:
 * - recipeId: The recipe ID to update
 * - ingredients: Optional array of ingredient objects (with group markers)
 * - instructions: Optional array of instruction objects (with group markers)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { recipeId, ingredients, instructions } = body

    if (!recipeId || typeof recipeId !== "string") {
      return NextResponse.json(
        { error: "recipeId is required" },
        { status: 400 }
      )
    }

    const hasIngredients = Array.isArray(ingredients) && ingredients.length > 0
    const hasInstructions = Array.isArray(instructions) && instructions.length > 0

    if (!hasIngredients && !hasInstructions) {
      return NextResponse.json(
        { error: "At least one of ingredients or instructions must be provided" },
        { status: 400 }
      )
    }

    // First, fetch the current recipe to get all its data
    const recipeResponse = await fetch(
      `${POSTGREST_URL}/recipes_and_categories?id=eq.${recipeId}`
    )

    if (!recipeResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch recipe" },
        { status: 500 }
      )
    }

    const recipes = await recipeResponse.json()

    if (recipes.length === 0) {
      return NextResponse.json(
        { error: "Recipe not found" },
        { status: 404 }
      )
    }

    const recipe = recipes[0]

    // Match ingredients to foods and units (if provided)
    const matchedIngredients = hasIngredients
      ? await matchIngredientsToDatabase(ingredients)
      : recipe.ingredients?.map((i: { name: string; measurement: string; quantity: string; group_id?: string }) => ({
          name: i.name,
          measurement: i.measurement || "",
          quantity: i.quantity || "",
        })) || []

    // Create PostgREST token for the admin user
    const token = await signPostgrestToken(session.email)

    // Build instructions array - use provided or keep existing
    const finalInstructions = hasInstructions
      ? instructions
      : recipe.instructions?.map((i: { step: string }) => ({ step: i.step })) || []

    // Call update_recipe with the updated data
    const payload = {
      p_recipe_id: recipeId,
      p_name: recipe.name,
      p_author: recipe.author,
      p_description: recipe.description,
      p_url: recipe.url,
      p_recipe_yield: recipe.recipe_yield,
      p_recipe_yield_name: recipe.recipe_yield_name,
      p_prep_time: recipe.prep_time,
      p_cook_time: recipe.cook_time,
      p_cuisine: recipe.cuisine,
      p_image: recipe.image,
      p_thumbnail: recipe.thumbnail,
      p_categories: recipe.categories || [],
      p_ingredients: matchedIngredients,
      p_instructions: finalInstructions,
    }

    const updateResponse = await fetch(`${POSTGREST_URL}/rpc/update_recipe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      console.error("Failed to update recipe:", errorText)
      return NextResponse.json(
        { error: "Failed to update recipe", details: errorText },
        { status: 500 }
      )
    }

    // Revalidate relevant paths
    revalidatePath(`/recept/${recipeId}`)
    revalidatePath('/recept')
    revalidatePath('/')

    // Build success message
    const updatedParts: string[] = []
    if (hasIngredients) updatedParts.push("ingredients")
    if (hasInstructions) updatedParts.push("instructions")

    return NextResponse.json({
      success: true,
      message: `Recipe ${updatedParts.join(" and ")} updated successfully`,
      ...(hasIngredients && { matchedIngredients }),
      ...(hasInstructions && { updatedInstructions: finalInstructions }),
    })
  } catch (error) {
    console.error("Apply restructure error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

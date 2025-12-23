import { getSession } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

const POSTGREST_URL = process.env.POSTGREST_URL || "http://localhost:4444"
const PAGE_SIZE = 20

interface RecipeWithGroups {
  id: string
  name: string
  ingredient_groups: Array<{ id: string; name: string; sort_order: number }> | null
  ingredients: Array<{
    id: string
    name: string
    measurement: string
    quantity: string
    group_id: string | null
    sort_order: number
  }> | null
}

/**
 * Checks if a recipe needs restructuring:
 * - Has ingredient_groups with items, OR
 * - Has ingredients with names starting with '#' (old format)
 */
function needsRestructuring(recipe: RecipeWithGroups): boolean {
  // Has proper ingredient groups
  if (recipe.ingredient_groups && recipe.ingredient_groups.length > 0) {
    return true
  }

  // Has old-style # prefixed ingredients
  if (recipe.ingredients?.some(i => i.name.startsWith("#"))) {
    return true
  }

  return false
}

/**
 * Extract group names from a recipe (both proper groups and # prefixed ingredients)
 */
function extractGroupNames(recipe: RecipeWithGroups): string[] {
  const groups: string[] = []

  // Add proper ingredient groups
  if (recipe.ingredient_groups) {
    groups.push(...recipe.ingredient_groups.map(g => g.name))
  }

  // Add # prefixed ingredients as group names
  if (recipe.ingredients) {
    for (const ing of recipe.ingredients) {
      if (ing.name.startsWith("#")) {
        // Remove # and trim
        const groupName = ing.name.substring(1).trim()
        if (groupName && !groups.includes(groupName)) {
          groups.push(groupName)
        }
      }
    }
  }

  return groups
}

/**
 * GET /api/admin/restructure
 * Lists recipes that need restructuring (have ingredient groups or # prefixed ingredients).
 *
 * Query params:
 * - page: Page number (default 1)
 * - search: Search term for recipe name
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const search = searchParams.get("search") || ""

    // Fetch all recipes (we need to filter in code to check for # prefixed ingredients)
    const params = new URLSearchParams()
    params.set("select", "id,name,ingredient_groups,ingredients")
    params.set("order", "name.asc")

    if (search) {
      params.set("name", `ilike.*${search}*`)
    }

    const response = await fetch(
      `${POSTGREST_URL}/recipes_and_categories?${params}`
    )

    if (!response.ok) {
      console.error("PostgREST error:", await response.text())
      return NextResponse.json(
        { error: "Failed to fetch recipes" },
        { status: 500 }
      )
    }

    const allRecipes: RecipeWithGroups[] = await response.json()

    // Filter to recipes that need restructuring
    const recipesToRestructure = allRecipes.filter(needsRestructuring)

    // Calculate pagination
    const total = recipesToRestructure.length
    const totalPages = Math.ceil(total / PAGE_SIZE)
    const offset = (page - 1) * PAGE_SIZE
    const paginatedRecipes = recipesToRestructure.slice(offset, offset + PAGE_SIZE)

    // Prepare response with summary info
    const items = paginatedRecipes.map(r => {
      const groups = extractGroupNames(r)
      const hashPrefixedCount = r.ingredients?.filter(i => i.name.startsWith("#")).length || 0

      return {
        id: r.id,
        name: r.name,
        groupCount: groups.length,
        ingredientCount: (r.ingredients?.length || 0) - hashPrefixedCount,
        groups,
        hasLegacyFormat: hashPrefixedCount > 0,
      }
    })

    return NextResponse.json({
      items,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
    })
  } catch (error) {
    console.error("Error listing recipes for restructure:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

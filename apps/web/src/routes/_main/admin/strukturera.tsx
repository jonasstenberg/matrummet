import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { AdminRestructureClient } from '@/components/admin-restructure-client'

const PAGE_SIZE = 20

interface RecipeWithGroups {
  id: string
  name: string
  ingredient_groups: Array<{
    id: string
    name: string
    sort_order: number
  }> | null
  ingredients: Array<{
    id: string
    name: string
    measurement: string
    quantity: string
    group_id: string | null
    sort_order: number
  }> | null
  instructions: Array<{
    id: string
    step: string
    group_id: string | null
    sort_order: number
  }> | null
}

interface RecipeItem {
  id: string
  name: string
  groupCount: number
  ingredientCount: number
  instructionCount: number
  groups: string[]
  hasLegacyFormat?: boolean
  hasInstructions?: boolean
}

interface PaginatedResponse {
  items: RecipeItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
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
  if (recipe.ingredients?.some((i) => i.name.startsWith('#'))) {
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
    groups.push(...recipe.ingredient_groups.map((g) => g.name))
  }

  // Add # prefixed ingredients as group names
  if (recipe.ingredients) {
    for (const ing of recipe.ingredients) {
      if (ing.name.startsWith('#')) {
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

const fetchRestructureData = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({ page: z.number(), search: z.string(), mode: z.string() }),
  )
  .handler(async ({ data }): Promise<PaginatedResponse> => {
    const { page, search, mode } = data

    // Admin auth is guaranteed by the parent admin layout's beforeLoad
    const session = await getSession()
    if (!session) {
      throw new Error('Unauthorized')
    }

    // Fetch all recipes (we need to filter in code to check for # prefixed ingredients)
    const token = await signPostgrestToken(session.email, session.role)

    const params = new URLSearchParams()
    params.set('select', 'id,name,ingredient_groups,ingredients,instructions')
    params.set('order', 'name.asc')

    if (search) {
      params.set('name', `ilike.*${search}*`)
    }

    const response = await fetch(
      `${env.POSTGREST_URL}/user_recipes?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      },
    )

    if (!response.ok) {
      console.error('PostgREST error:', await response.text())
      throw new Error('Failed to fetch recipes')
    }

    const allRecipes: RecipeWithGroups[] = await response.json()

    // Filter based on mode
    const recipesToRestructure =
      mode === 'all'
        ? allRecipes
        : allRecipes.filter(needsRestructuring)

    // Calculate pagination
    const total = recipesToRestructure.length
    const totalPages = Math.ceil(total / PAGE_SIZE)
    const offset = (page - 1) * PAGE_SIZE

    // Prepare items with summary info
    const allItems = recipesToRestructure.map((r) => {
      const groups = extractGroupNames(r)
      const hashPrefixedCount =
        r.ingredients?.filter((i) => i.name.startsWith('#')).length || 0
      const instructionCount = r.instructions?.length || 0

      return {
        id: r.id,
        name: r.name,
        groupCount: groups.length,
        ingredientCount: (r.ingredients?.length || 0) - hashPrefixedCount,
        instructionCount,
        groups,
        hasLegacyFormat: hashPrefixedCount > 0,
        hasInstructions: instructionCount > 0,
      }
    })

    // Sort by priority: Legacy #-format first, then no instructions, then rest
    allItems.sort((a, b) => {
      if (a.hasLegacyFormat !== b.hasLegacyFormat)
        return a.hasLegacyFormat ? -1 : 1
      if (a.hasInstructions !== b.hasInstructions)
        return a.hasInstructions ? 1 : -1
      return a.name.localeCompare(b.name, 'sv')
    })

    const paginatedItems = allItems.slice(offset, offset + PAGE_SIZE)

    return {
      items: paginatedItems,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
    }
  })

export const Route = createFileRoute('/_main/admin/strukturera')({
  validateSearch: (search) =>
    z
      .object({
        page: z.coerce.number().min(1).optional().catch(undefined),
        search: z.string().optional().catch(undefined),
        mode: z.string().optional().catch(undefined),
      })
      .parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    fetchRestructureData({
      data: {
        page: deps.page ?? 1,
        search: deps.search ?? '',
        mode: deps.mode ?? 'ingredients',
      },
    }),
  head: () => ({ meta: [{ title: 'Strukturera | Admin' }] }),
  component: PageComponent,
})

function PageComponent() {
  const initialData = Route.useLoaderData()

  return <AdminRestructureClient initialData={initialData} />
}

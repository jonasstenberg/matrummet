'use server'

import { redirect } from 'next/navigation'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import type { CategoryWithCount } from '@/lib/types'

export type FoodStatus = 'pending' | 'approved' | 'rejected'

export interface Food {
  id: string
  name: string
  status: FoodStatus
  created_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  date_published: string
  date_modified: string
  ingredient_count: number
  canonical_food_id: string | null
  canonical_food_name: string | null
  ai_confidence: number | null
  ai_reasoning: string | null
  ai_decision: string | null
  ai_suggested_merge_id: string | null
  ai_suggested_merge_name: string | null
}

export interface FoodsPaginatedResponse {
  items: Food[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  email: string
  name: string | null
  role: UserRole
  provider: string | null
  recipe_count: number
  credit_balance: number
}

export interface UserStats {
  total_users: number
  admin_count: number
  total_credit_balance: number
}

export interface UsersPaginatedResponse {
  items: User[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  stats: UserStats
}

export interface SimilarFood {
  id: string
  name: string
}

export interface LinkedRecipe {
  id: string
  name: string
}

export interface Unit {
  id: string
  name: string
  plural: string
  abbreviation: string
  ingredient_count: number
}

export interface UnitsPaginatedResponse {
  items: Unit[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AdminSession {
  email: string
  name: string
  role: 'admin'
}

/**
 * Verify admin access. Returns session if valid admin, otherwise redirects or throws.
 */
export async function requireAdmin(returnUrl = '/admin'): Promise<AdminSession> {
  const session = await getSession()

  if (!session) {
    redirect(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
  }

  if (session.role !== 'admin') {
    // Return a special indicator that will be handled by the page
    throw new Error('NOT_ADMIN')
  }

  return session as AdminSession
}

/**
 * Check if user is authenticated admin without redirect
 */
export async function isAdminAuthenticated(): Promise<{ isAdmin: boolean; session: AdminSession | null }> {
  const session = await getSession()

  if (!session) {
    return { isAdmin: false, session: null }
  }

  if (session.role !== 'admin') {
    return { isAdmin: false, session: null }
  }

  return { isAdmin: true, session: session as AdminSession }
}

export type AliasFilter = 'all' | 'is_alias' | 'has_aliases' | 'standalone'

export interface GetAdminFoodsParams {
  page?: number
  search?: string
  status?: FoodStatus | 'all'
  alias?: AliasFilter
}

async function enrichFoodsWithAiData(items: Food[], token: string): Promise<Food[]> {
  if (items.length === 0) return items

  const ids = items.map((item) => item.id)
  const aiResponse = await fetch(
    `${env.POSTGREST_URL}/foods?select=id,ai_confidence,ai_reasoning,ai_decision,ai_suggested_merge_id&id=in.(${ids.join(',')})`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  )

  if (!aiResponse.ok) return items

  const aiData: Array<{
    id: string
    ai_confidence: number | null
    ai_reasoning: string | null
    ai_decision: string | null
    ai_suggested_merge_id: string | null
  }> = await aiResponse.json()

  const aiMap = new Map(aiData.map((d) => [d.id, d]))

  // Fetch merge target names
  const mergeIds = aiData
    .filter((d) => d.ai_suggested_merge_id)
    .map((d) => d.ai_suggested_merge_id!)

  const mergeNameMap = new Map<string, string>()
  if (mergeIds.length > 0) {
    const mergeResponse = await fetch(
      `${env.POSTGREST_URL}/foods?select=id,name&id=in.(${mergeIds.join(',')})`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    )
    if (mergeResponse.ok) {
      const mergeData: Array<{ id: string; name: string }> = await mergeResponse.json()
      mergeData.forEach((d) => mergeNameMap.set(d.id, d.name))
    }
  }

  return items.map((item) => {
    const ai = aiMap.get(item.id)
    return {
      ...item,
      ai_confidence: ai?.ai_confidence ?? null,
      ai_reasoning: ai?.ai_reasoning ?? null,
      ai_decision: ai?.ai_decision ?? null,
      ai_suggested_merge_id: ai?.ai_suggested_merge_id ?? null,
      ai_suggested_merge_name: ai?.ai_suggested_merge_id
        ? (mergeNameMap.get(ai.ai_suggested_merge_id) ?? null)
        : null,
    }
  })
}

async function getCanonicalTargetIds(token: string): Promise<Set<string>> {
  const response = await fetch(
    `${env.POSTGREST_URL}/foods?select=canonical_food_id&canonical_food_id=not.is.null`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  )
  if (!response.ok) return new Set()
  const data: Array<{ canonical_food_id: string }> = await response.json()
  return new Set(data.map((d) => d.canonical_food_id))
}

/**
 * Fetch paginated foods for admin
 */
export async function getAdminFoods(params: GetAdminFoodsParams = {}): Promise<FoodsPaginatedResponse> {
  const { page = 1, search = '', status = 'pending', alias = 'all' } = params
  const pageSize = 50

  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const token = await signPostgrestToken(session.email, session.role)
  const statusParam = status === 'all' ? null : status
  const useAliasFilter = alias !== 'all'

  // When alias filter is active, fetch all items to filter properly
  const fetchLimit = useAliasFilter ? 10000 : pageSize
  const fetchOffset = useAliasFilter ? 0 : (page - 1) * pageSize

  const itemsResponse = await fetch(`${env.POSTGREST_URL}/rpc/admin_list_foods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      p_search: search || null,
      p_status: statusParam,
      p_limit: fetchLimit,
      p_offset: fetchOffset,
    }),
    cache: 'no-store',
  })

  if (!itemsResponse.ok) {
    throw new Error('Failed to fetch foods')
  }

  let items: Food[] = await itemsResponse.json()
  let total: number

  if (useAliasFilter) {
    const canonicalTargets = await getCanonicalTargetIds(token)

    items = items.filter((item) => {
      switch (alias) {
        case 'is_alias':
          return item.canonical_food_id !== null
        case 'has_aliases':
          return canonicalTargets.has(item.id)
        case 'standalone':
          return item.canonical_food_id === null && !canonicalTargets.has(item.id)
        default:
          return true
      }
    })

    total = items.length
    const offset = (page - 1) * pageSize
    items = items.slice(offset, offset + pageSize)
  } else {
    const countResponse = await fetch(`${env.POSTGREST_URL}/rpc/admin_count_foods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_search: search || null,
        p_status: statusParam,
      }),
      cache: 'no-store',
    })

    if (!countResponse.ok) {
      throw new Error('Failed to fetch food count')
    }

    total = await countResponse.json()
  }

  items = await enrichFoodsWithAiData(items, token)

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export type UserSortField = 'name' | 'email' | 'role' | 'provider' | 'recipe_count' | 'credit_balance'
export type SortDir = 'asc' | 'desc'

export interface GetAdminUsersParams {
  page?: number
  search?: string
  role?: UserRole | 'all'
  sortBy?: UserSortField
  sortDir?: SortDir
}

async function getAdminUserStats(token: string): Promise<UserStats> {
  const response = await fetch(`${env.POSTGREST_URL}/rpc/admin_user_stats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    return { total_users: 0, admin_count: 0, total_credit_balance: 0 }
  }

  const data = await response.json()
  // PostgREST returns a single-row result as an array for RPC
  return Array.isArray(data) ? data[0] : data
}

/**
 * Fetch paginated users for admin
 */
export async function getAdminUsers(params: GetAdminUsersParams = {}): Promise<UsersPaginatedResponse> {
  const { page = 1, search = '', role = 'all', sortBy = 'name', sortDir = 'asc' } = params
  const pageSize = 50

  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const token = await signPostgrestToken(session.email, session.role)

  const offset = (page - 1) * pageSize

  // Fetch count, items, and stats in parallel
  const [countResponse, itemsResponse, stats] = await Promise.all([
    fetch(`${env.POSTGREST_URL}/rpc/admin_count_users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_search: search || null,
        p_role: role === 'all' ? null : role,
      }),
      cache: 'no-store',
    }),
    fetch(`${env.POSTGREST_URL}/rpc/admin_list_users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_search: search || null,
        p_role: role === 'all' ? null : role,
        p_limit: pageSize,
        p_offset: offset,
        p_sort_by: sortBy,
        p_sort_dir: sortDir,
      }),
      cache: 'no-store',
    }),
    getAdminUserStats(token),
  ])

  if (!countResponse.ok) {
    throw new Error('Failed to fetch user count')
  }

  if (!itemsResponse.ok) {
    throw new Error('Failed to fetch users')
  }

  const [total, items] = await Promise.all([
    countResponse.json(),
    itemsResponse.json(),
  ])

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    stats,
  }
}

/**
 * Get similar foods for a given food name
 */
export async function getSimilarFoods(name: string): Promise<SimilarFood[]> {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const token = await signPostgrestToken(session.email, session.role)

  const response = await fetch(
    `${env.POSTGREST_URL}/rpc/find_similar_foods?p_name=${encodeURIComponent(name)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    return []
  }

  return response.json()
}

/**
 * Get recipes linked to a food
 */
export async function getLinkedRecipes(foodId: string): Promise<LinkedRecipe[]> {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const token = await signPostgrestToken(session.email, session.role)

  const response = await fetch(
    `${env.POSTGREST_URL}/rpc/get_recipes_by_food?p_food_id=${foodId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    return []
  }

  return response.json()
}

export interface GetAdminUnitsParams {
  page?: number
  search?: string
}

/**
 * Fetch paginated units for admin
 */
export async function getAdminUnits(params: GetAdminUnitsParams = {}): Promise<UnitsPaginatedResponse> {
  const { page = 1, search = '' } = params
  const pageSize = 50

  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const token = await signPostgrestToken(session.email, session.role)

  // Fetch total count
  const countResponse = await fetch(`${env.POSTGREST_URL}/rpc/admin_count_units`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      p_search: search || null,
    }),
    cache: 'no-store',
  })

  if (!countResponse.ok) {
    throw new Error('Failed to fetch unit count')
  }

  const total = await countResponse.json()

  // Fetch paginated items
  const offset = (page - 1) * pageSize
  const itemsResponse = await fetch(`${env.POSTGREST_URL}/rpc/admin_list_units`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      p_search: search || null,
      p_limit: pageSize,
      p_offset: offset,
    }),
    cache: 'no-store',
  })

  if (!itemsResponse.ok) {
    throw new Error('Failed to fetch units')
  }

  const items = await itemsResponse.json()

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * Fetch all categories with recipe count for admin
 */
export async function getAdminCategories(): Promise<CategoryWithCount[]> {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const token = await signPostgrestToken(session.email, session.role)

  const response = await fetch(
    `${env.POSTGREST_URL}/categories?select=id,name,group_id,recipe_categories(count),category_groups(name,sort_order)&order=name`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    throw new Error('Failed to fetch categories')
  }

  const data: Array<{
    id: number
    name: string
    group_id: string | null
    recipe_categories: Array<{ count: number }>
    category_groups: { name: string; sort_order: number } | null
  }> = await response.json()

  // Transform the data to include recipe_count and sort by Swedish locale
  const categoriesWithCount: CategoryWithCount[] = data.map((cat) => ({
    id: String(cat.id),
    name: cat.name,
    group_id: cat.group_id,
    recipe_count: cat.recipe_categories?.[0]?.count ?? 0,
    group_name: cat.category_groups?.name ?? undefined,
  }))

  categoriesWithCount.sort((a, b) => a.name.localeCompare(b.name, 'sv'))

  return categoriesWithCount
}

export interface CategoryGroupOption {
  id: string
  name: string
  sort_order: number
}

/**
 * Fetch all category groups for admin dropdowns
 */
export async function getAdminCategoryGroups(): Promise<CategoryGroupOption[]> {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const token = await signPostgrestToken(session.email, session.role)

  const response = await fetch(
    `${env.POSTGREST_URL}/category_groups?select=id,name,sort_order&order=sort_order.asc`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    throw new Error('Failed to fetch category groups')
  }

  return response.json()
}

/**
 * Get recipes linked to a category
 */
export async function getLinkedRecipesByCategory(categoryId: string): Promise<LinkedRecipe[]> {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const token = await signPostgrestToken(session.email, session.role)

  const response = await fetch(
    `${env.POSTGREST_URL}/recipe_categories?select=recipe:recipes(id,name)&category_id=eq.${categoryId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    return []
  }

  const data: Array<{ recipe: { id: string; name: string } }> = await response.json()
  return data.map((d) => d.recipe).sort((a, b) => a.name.localeCompare(b.name, 'sv'))
}

/**
 * Get recipes linked to a unit (via ingredients)
 */
export async function getLinkedRecipesByUnit(unitId: string): Promise<LinkedRecipe[]> {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const token = await signPostgrestToken(session.email, session.role)

  const response = await fetch(
    `${env.POSTGREST_URL}/ingredients?select=recipe:recipes(id,name)&unit_id=eq.${unitId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    return []
  }

  const data: Array<{ recipe: { id: string; name: string } }> = await response.json()
  // Deduplicate by recipe id (multiple ingredients in same recipe)
  const seen = new Set<string>()
  const unique: LinkedRecipe[] = []
  for (const d of data) {
    if (!seen.has(d.recipe.id)) {
      seen.add(d.recipe.id)
      unique.push(d.recipe)
    }
  }
  return unique.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
}

/**
 * Get count of foods with pending status for AI review
 */
export async function getPendingFoodCount(): Promise<number> {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const token = await signPostgrestToken(session.email, session.role)

  const res = await fetch(`${env.POSTGREST_URL}/foods?status=eq.pending`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
    cache: 'no-store',
  })

  const count = parseInt(res.headers.get('content-range')?.split('/')[1] || '0')
  return count
}

export interface LastAiReviewSummary {
  lastRunAt: string | null
  decisions: Record<string, number>
}

/**
 * Get last AI review run timestamp and summary of decisions
 */
export async function getLastAiReviewSummary(): Promise<LastAiReviewSummary> {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const token = await signPostgrestToken(session.email, session.role)

  // Get the most recent AI review log entry
  const lastRunRes = await fetch(
    `${env.POSTGREST_URL}/food_review_logs?reviewer_type=eq.ai&order=created_at.desc&limit=1&select=created_at`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  )

  if (!lastRunRes.ok) {
    return { lastRunAt: null, decisions: {} }
  }

  const lastRunData: Array<{ created_at: string }> = await lastRunRes.json()
  if (lastRunData.length === 0) {
    return { lastRunAt: null, decisions: {} }
  }

  const lastRunAt = lastRunData[0].created_at

  // Get the date of the last run (truncate to day for grouping)
  const lastRunDate = new Date(lastRunAt)
  const dayStart = new Date(lastRunDate)
  dayStart.setHours(0, 0, 0, 0)

  // Fetch all entries from the same day to get summary stats
  const summaryRes = await fetch(
    `${env.POSTGREST_URL}/food_review_logs?reviewer_type=eq.ai&created_at=gte.${dayStart.toISOString()}&select=decision`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  )

  const decisions: Record<string, number> = {}
  if (summaryRes.ok) {
    const entries: Array<{ decision: string }> = await summaryRes.json()
    for (const entry of entries) {
      decisions[entry.decision] = (decisions[entry.decision] || 0) + 1
    }
  }

  return { lastRunAt, decisions }
}

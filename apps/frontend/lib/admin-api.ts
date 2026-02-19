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

export interface GetAdminFoodsParams {
  page?: number
  search?: string
  status?: FoodStatus | 'all'
}

/**
 * Fetch paginated foods for admin
 */
export async function getAdminFoods(params: GetAdminFoodsParams = {}): Promise<FoodsPaginatedResponse> {
  const { page = 1, search = '', status = 'pending' } = params
  const pageSize = 50

  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const token = await signPostgrestToken(session.email, session.role)

  // Fetch total count
  const countResponse = await fetch(`${env.POSTGREST_URL}/rpc/admin_count_foods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      p_search: search || null,
      p_status: status === 'all' ? null : status,
    }),
    cache: 'no-store',
  })

  if (!countResponse.ok) {
    throw new Error('Failed to fetch food count')
  }

  const total = await countResponse.json()

  // Fetch paginated items
  const offset = (page - 1) * pageSize
  const itemsResponse = await fetch(`${env.POSTGREST_URL}/rpc/admin_list_foods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      p_search: search || null,
      p_status: status === 'all' ? null : status,
      p_limit: pageSize,
      p_offset: offset,
    }),
    cache: 'no-store',
  })

  if (!itemsResponse.ok) {
    throw new Error('Failed to fetch foods')
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
    `${env.POSTGREST_URL}/categories?select=id,name,recipe_categories(count)&order=name`,
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
    recipe_categories: Array<{ count: number }>
  }> = await response.json()

  // Transform the data to include recipe_count and sort by Swedish locale
  const categoriesWithCount = data.map((cat) => ({
    id: String(cat.id),
    name: cat.name,
    recipe_count: cat.recipe_categories?.[0]?.count ?? 0,
  }))

  categoriesWithCount.sort((a, b) => a.name.localeCompare(b.name, 'sv'))

  return categoriesWithCount
}

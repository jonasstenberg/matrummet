import type {
  Recipe,
  CategoryGroup,
  ShoppingListItem,
  ShoppingList,
} from '@matrummet/types/types'
import type { TokenStorage } from './token-storage'
import { signToken, signPostgrestToken, verifyToken } from './auth'
import type { JWTPayload } from './auth'

export interface PostgrestClientConfig {
  postgrestUrl: string
  jwtSecret: string
  postgrestJwtSecret: string
  tokenStorage: TokenStorage
}

export interface RecipeQueryOptions {
  categories?: string[]
  search?: string
  owner?: boolean
  ownerIds?: string[]
  limit?: number
  offset?: number
}

export class PostgrestClient {
  private config: PostgrestClientConfig

  constructor(config: PostgrestClientConfig) {
    this.config = config
  }

  // ---- Auth ----

  async login(email: string, password: string): Promise<JWTPayload> {
    const res = await fetch(`${this.config.postgrestUrl}/rpc/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ login_email: email, login_password: password }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(errorText || 'Login failed')
    }

    const data = await res.json()
    const payload: JWTPayload = {
      email: data.email,
      name: data.name,
      role: data.role === 'admin' ? 'admin' : 'user',
    }

    const token = await signToken(payload, this.config.jwtSecret)
    await this.config.tokenStorage.setAppToken(token)

    return payload
  }

  async signup(name: string, email: string, password: string): Promise<JWTPayload> {
    const res = await fetch(`${this.config.postgrestUrl}/rpc/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_name: name, p_email: email, p_password: password }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(errorText || 'Signup failed')
    }

    const data = await res.json()
    const payload: JWTPayload = {
      email: data.email,
      name: data.name,
      role: 'user',
    }

    const token = await signToken(payload, this.config.jwtSecret)
    await this.config.tokenStorage.setAppToken(token)

    return payload
  }

  async logout(): Promise<void> {
    await this.config.tokenStorage.removeAppToken()
  }

  async getCurrentUser(): Promise<JWTPayload | null> {
    const token = await this.config.tokenStorage.getAppToken()
    if (!token) return null
    return verifyToken(token, this.config.jwtSecret)
  }

  // ---- Recipes ----

  private async getAuthHeaders(): Promise<HeadersInit> {
    const user = await this.getCurrentUser()
    if (!user) return { 'Content-Type': 'application/json' }

    const pgToken = await signPostgrestToken(
      user.email,
      user.role,
      this.config.postgrestJwtSecret,
    )
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${pgToken}`,
    }
  }

  async getRecipes(options?: RecipeQueryOptions): Promise<Recipe[]> {
    const headers = await this.getAuthHeaders()

    if (options?.search) {
      const res = await fetch(`${this.config.postgrestUrl}/rpc/search_recipes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_query: options.search,
          p_owner_only: options.owner ?? false,
          p_category: options.categories?.[0] ?? null,
          p_limit: options.limit ?? 50,
          p_offset: options.offset ?? 0,
          ...(options.ownerIds?.length ? { p_owner_ids: options.ownerIds } : {}),
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Failed to search recipes: ${res.status} ${errorText}`)
      }

      let recipes: Recipe[] = await res.json()
      if (options.categories && options.categories.length > 1) {
        const categorySet = new Set(options.categories.map(c => c.toLowerCase()))
        recipes = recipes.filter(r =>
          r.categories?.some(c => categorySet.has(c.toLowerCase()))
        )
      }
      return recipes
    }

    const params = new URLSearchParams()
    params.set('order', 'date_published.desc')

    const andConditions: string[] = []
    andConditions.push('or(is_featured.eq.false,is_owner.eq.true)')

    if (options?.categories?.length) {
      if (options.categories.length === 1) {
        params.set('categories', `cs.{"${options.categories[0]}"}`)
      } else {
        const orConditions = options.categories
          .map(cat => `categories.cs.{"${cat}"}`)
          .join(',')
        andConditions.push(`or(${orConditions})`)
      }
    }
    if (andConditions.length > 0) {
      params.set('and', `(${andConditions.join(',')})`)
    }
    if (options?.ownerIds?.length) {
      params.set('owner_id', `in.(${options.ownerIds.join(',')})`)
    } else if (options?.owner) {
      params.set('is_owner', 'eq.true')
    }
    if (options?.limit) params.set('limit', String(options.limit))
    if (options?.offset) params.set('offset', String(options.offset))

    const res = await fetch(`${this.config.postgrestUrl}/user_recipes?${params}`, { headers })
    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Failed to fetch recipes: ${res.status} ${errorText}`)
    }
    return res.json()
  }

  async getRecipe(id: string): Promise<Recipe | null> {
    const headers = await this.getAuthHeaders()
    const hasAuth = 'Authorization' in headers

    const view = hasAuth ? 'user_recipes' : 'featured_recipes'
    const res = await fetch(`${this.config.postgrestUrl}/${view}?id=eq.${id}`, { headers })

    if (!res.ok) return null
    const data = await res.json()
    return data[0] ?? null
  }

  async getCategories(): Promise<CategoryGroup[]> {
    const res = await fetch(
      `${this.config.postgrestUrl}/categories?select=name,category_groups(name,sort_order)&order=name`,
    )

    if (!res.ok) return []

    const data: Array<{
      name: string
      category_groups: { name: string; sort_order: number } | null
    }> = await res.json()

    const groupMap = new Map<string, { sort_order: number; categories: string[] }>()

    for (const cat of data) {
      const groupName = cat.category_groups?.name ?? 'Övrigt'
      const sortOrder = cat.category_groups?.sort_order ?? 99

      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, { sort_order: sortOrder, categories: [] })
      }
      groupMap.get(groupName)!.categories.push(cat.name)
    }

    return Array.from(groupMap.entries())
      .sort((a, b) => a[1].sort_order - b[1].sort_order)
      .map(([name, { sort_order, categories }]) => ({
        name,
        sort_order,
        categories: categories.sort((a, b) => a.localeCompare(b, 'sv')),
      }))
  }

  // ---- Likes ----

  async getLikedRecipes(options?: Omit<RecipeQueryOptions, 'owner' | 'ownerIds'>): Promise<Recipe[]> {
    const headers = await this.getAuthHeaders()

    if (options?.search) {
      const res = await fetch(`${this.config.postgrestUrl}/rpc/search_liked_recipes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_query: options.search,
          p_category: options.categories?.[0] ?? null,
        }),
      })

      if (!res.ok) throw new Error('Failed to search liked recipes')
      let recipes: Recipe[] = await res.json()
      if (options.categories && options.categories.length > 1) {
        const categorySet = new Set(options.categories.map(c => c.toLowerCase()))
        recipes = recipes.filter(r =>
          r.categories?.some(c => categorySet.has(c.toLowerCase()))
        )
      }
      return recipes
    }

    const params = new URLSearchParams()
    params.set('order', 'liked_at.desc')

    if (options?.categories?.length) {
      if (options.categories.length === 1) {
        params.set('categories', `cs.{"${options.categories[0]}"}`)
      } else {
        const orConditions = options.categories
          .map(cat => `categories.cs.{"${cat}"}`)
          .join(',')
        params.set('or', `(${orConditions})`)
      }
    }
    if (options?.limit) params.set('limit', String(options.limit))
    if (options?.offset) params.set('offset', String(options.offset))

    const res = await fetch(`${this.config.postgrestUrl}/liked_recipes?${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch liked recipes')
    return res.json()
  }

  async toggleRecipeLike(recipeId: string): Promise<void> {
    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.config.postgrestUrl}/rpc/toggle_recipe_like`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_recipe_id: recipeId }),
    })
    if (!res.ok) throw new Error('Failed to toggle like')
  }

  // ---- Shopping List ----

  async getShoppingList(listId?: string, homeId?: string): Promise<ShoppingListItem[]> {
    const headers = await this.getAuthHeaders() as Record<string, string>

    const params = new URLSearchParams()
    params.set('order', 'is_checked.asc,sort_order.asc')
    if (listId) params.set('shopping_list_id', `eq.${listId}`)
    if (homeId) headers['X-Active-Home-Id'] = homeId

    const res = await fetch(`${this.config.postgrestUrl}/shopping_list_view?${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch shopping list')
    return res.json()
  }

  async getUserShoppingLists(homeId?: string): Promise<ShoppingList[]> {
    const headers = await this.getAuthHeaders() as Record<string, string>
    if (homeId) headers['X-Active-Home-Id'] = homeId

    const res = await fetch(`${this.config.postgrestUrl}/rpc/get_user_shopping_lists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    })
    if (!res.ok) throw new Error('Failed to fetch shopping lists')
    return res.json()
  }

  async toggleShoppingListItem(itemId: string): Promise<void> {
    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.config.postgrestUrl}/rpc/toggle_shopping_list_item`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_item_id: itemId }),
    })
    if (!res.ok) throw new Error('Failed to toggle item')
  }

  async clearCheckedItems(listId?: string): Promise<void> {
    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.config.postgrestUrl}/rpc/clear_checked_items`, {
      method: 'POST',
      headers,
      body: JSON.stringify(listId ? { p_list_id: listId } : {}),
    })
    if (!res.ok) throw new Error('Failed to clear checked items')
  }

  async addCustomShoppingListItem(name: string, listId?: string): Promise<void> {
    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.config.postgrestUrl}/rpc/add_custom_shopping_list_item`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_name: name, ...(listId ? { p_list_id: listId } : {}) }),
    })
    if (!res.ok) throw new Error('Failed to add item')
  }
}

/**
 * Parse PostgREST Content-Range header to extract total count.
 */
export function parseContentRange(header: string | null): number {
  if (!header) return 0
  const match = header.match(/\/(\d+|\*)$/)
  if (match && match[1] !== '*') {
    return parseInt(match[1], 10)
  }
  return 0
}

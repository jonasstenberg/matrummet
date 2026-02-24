import type {
  Recipe,
  CreateRecipeInput,
  UpdateRecipeInput,
  CategoryGroup,
  ShoppingListItem,
  ShoppingList,
} from '@matrummet/types/types'
import type { TokenStorage } from './token-storage'
import { signToken, signPostgrestToken, verifyToken } from './auth'
import type { JWTPayload } from './auth'

/** Mobile/client config — manages its own JWT tokens via storage. */
export interface PostgrestClientConfig {
  postgrestUrl: string
  jwtSecret: string
  postgrestJwtSecret: string
  tokenStorage: TokenStorage
}

/** Server config — uses a pre-made PostgREST token from middleware. */
export interface ServerPostgrestConfig {
  postgrestUrl: string
  postgrestToken: string
  session: JWTPayload
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
  private postgrestUrl: string
  // Resolved auth functions (set once in constructor)
  private getAuthHeadersFn: () => Promise<Record<string, string>>
  private getCurrentUserFn: () => Promise<JWTPayload | null>
  // Lifecycle hooks (mobile sets these, server leaves them null)
  private onTokenUpdated: ((payload: JWTPayload) => Promise<void>) | null
  private onTokenCleared: (() => Promise<void>) | null

  constructor(config: PostgrestClientConfig | ServerPostgrestConfig) {
    this.postgrestUrl = config.postgrestUrl

    if ('postgrestToken' in config) {
      // Server mode: pre-authenticated, no token management
      const { postgrestToken, session } = config
      this.getAuthHeadersFn = async () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${postgrestToken}`,
      })
      this.getCurrentUserFn = async () => session
      this.onTokenUpdated = null
      this.onTokenCleared = null
    } else {
      // Mobile mode: manages tokens via storage
      const { jwtSecret, postgrestJwtSecret, tokenStorage } = config

      this.getCurrentUserFn = async () => {
        const token = await tokenStorage.getAppToken()
        if (!token) return null
        return verifyToken(token, jwtSecret)
      }

      this.getAuthHeadersFn = async () => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        const user = await this.getCurrentUserFn()
        if (user) {
          const pgToken = await signPostgrestToken(user.email, user.role, postgrestJwtSecret)
          headers['Authorization'] = `Bearer ${pgToken}`
        }
        return headers
      }

      this.onTokenUpdated = async (payload: JWTPayload) => {
        const token = await signToken(payload, jwtSecret)
        await tokenStorage.setAppToken(token)
      }

      this.onTokenCleared = async () => {
        await tokenStorage.removeAppToken()
      }
    }
  }

  // ---- Auth ----

  async login(email: string, password: string): Promise<JWTPayload> {
    const res = await fetch(`${this.postgrestUrl}/rpc/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    if (this.onTokenUpdated) {
      await this.onTokenUpdated(payload)
    }

    return payload
  }

  async signup(name: string, email: string, password: string): Promise<JWTPayload> {
    const res = await fetch(`${this.postgrestUrl}/rpc/signup`, {
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

    if (this.onTokenUpdated) {
      await this.onTokenUpdated(payload)
    }

    return payload
  }

  async logout(): Promise<void> {
    if (this.onTokenCleared) {
      await this.onTokenCleared()
    }
  }

  async getCurrentUser(): Promise<JWTPayload | null> {
    return this.getCurrentUserFn()
  }

  // ---- Private ----

  private async getAuthHeaders(homeId?: string): Promise<Record<string, string>> {
    const headers = await this.getAuthHeadersFn()
    if (homeId) {
      headers['X-Active-Home-Id'] = homeId
    }
    return headers
  }

  // ---- Recipes ----

  async getRecipes(options?: RecipeQueryOptions): Promise<Recipe[]> {
    const headers = await this.getAuthHeaders()

    if (options?.search) {
      const res = await fetch(`${this.postgrestUrl}/rpc/search_recipes`, {
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

    const res = await fetch(`${this.postgrestUrl}/user_recipes?${params}`, { headers })
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
    const res = await fetch(`${this.postgrestUrl}/${view}?id=eq.${id}`, { headers })

    if (!res.ok) return null
    const data = await res.json()
    return data[0] ?? null
  }

  async getCategories(): Promise<CategoryGroup[]> {
    const res = await fetch(
      `${this.postgrestUrl}/categories?select=name,category_groups(name,sort_order)&order=name`,
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

  async createRecipe(input: CreateRecipeInput): Promise<string> {
    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.postgrestUrl}/rpc/insert_recipe`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_name: input.recipe_name,
        p_author: input.author ?? null,
        p_description: input.description ?? null,
        p_url: input.url ?? null,
        p_recipe_yield: input.recipe_yield ?? null,
        p_recipe_yield_name: input.recipe_yield_name ?? null,
        p_prep_time: input.prep_time ?? null,
        p_cook_time: input.cook_time ?? null,
        p_cuisine: input.cuisine ?? null,
        p_image: input.image ?? null,
        p_categories: input.categories ?? [],
        p_ingredients: input.ingredients,
        p_instructions: input.instructions,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(errorText || 'Failed to create recipe')
    }

    const id: string = await res.json()
    return id
  }

  async updateRecipe(input: UpdateRecipeInput): Promise<void> {
    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.postgrestUrl}/rpc/update_recipe`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_recipe_id: input.recipe_id,
        p_name: input.recipe_name,
        p_author: input.author,
        p_description: input.description,
        p_url: input.url,
        p_recipe_yield: input.recipe_yield,
        p_recipe_yield_name: input.recipe_yield_name,
        p_prep_time: input.prep_time,
        p_cook_time: input.cook_time,
        p_cuisine: input.cuisine,
        p_image: input.image,
        p_categories: input.categories,
        p_ingredients: input.ingredients,
        p_instructions: input.instructions,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(errorText || 'Failed to update recipe')
    }
  }

  async deleteRecipe(recipeId: string): Promise<void> {
    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.postgrestUrl}/recipes?id=eq.${recipeId}`, {
      method: 'DELETE',
      headers,
    })
    if (!res.ok) throw new Error('Failed to delete recipe')
  }

  // ---- Likes ----

  async getLikedRecipes(options?: Omit<RecipeQueryOptions, 'owner' | 'ownerIds'>): Promise<Recipe[]> {
    const headers = await this.getAuthHeaders()

    if (options?.search) {
      const res = await fetch(`${this.postgrestUrl}/rpc/search_liked_recipes`, {
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

    const res = await fetch(`${this.postgrestUrl}/liked_recipes?${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch liked recipes')
    return res.json()
  }

  async toggleRecipeLike(recipeId: string): Promise<void> {
    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.postgrestUrl}/rpc/toggle_recipe_like`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_recipe_id: recipeId }),
    })
    if (!res.ok) throw new Error('Failed to toggle like')
  }

  // ---- Shopping List ----

  async getShoppingList(listId?: string, homeId?: string): Promise<ShoppingListItem[]> {
    const headers = await this.getAuthHeaders(homeId)

    const params = new URLSearchParams()
    params.set('order', 'is_checked.asc,sort_order.asc')
    if (listId) params.set('shopping_list_id', `eq.${listId}`)

    const res = await fetch(`${this.postgrestUrl}/shopping_list_view?${params}`, { headers })
    if (!res.ok) throw new Error('Failed to fetch shopping list')
    return res.json()
  }

  async getUserShoppingLists(homeId?: string): Promise<ShoppingList[]> {
    const headers = await this.getAuthHeaders(homeId)

    const res = await fetch(`${this.postgrestUrl}/rpc/get_user_shopping_lists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    })
    if (!res.ok) throw new Error('Failed to fetch shopping lists')
    return res.json()
  }

  async toggleShoppingListItem(itemId: string): Promise<void> {
    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.postgrestUrl}/rpc/toggle_shopping_list_item`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_item_id: itemId }),
    })
    if (!res.ok) throw new Error('Failed to toggle item')
  }

  async clearCheckedItems(listId?: string): Promise<void> {
    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.postgrestUrl}/rpc/clear_checked_items`, {
      method: 'POST',
      headers,
      body: JSON.stringify(listId ? { p_list_id: listId } : {}),
    })
    if (!res.ok) throw new Error('Failed to clear checked items')
  }

  async addCustomShoppingListItem(name: string, listId?: string): Promise<void> {
    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.postgrestUrl}/rpc/add_custom_shopping_list_item`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_name: name, ...(listId ? { p_list_id: listId } : {}) }),
    })
    if (!res.ok) throw new Error('Failed to add item')
  }

  // ---- Settings ----

  async updateProfile(name: string): Promise<JWTPayload> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const headers = await this.getAuthHeaders()
    const res = await fetch(
      `${this.postgrestUrl}/users?email=eq.${encodeURIComponent(user.email)}`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({ name: name.trim() }),
      },
    )

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(errorText || 'Kunde inte uppdatera profil')
    }

    const updated: Array<{ email: string; name: string; role: string }> = await res.json()
    if (!updated[0]) throw new Error('Användaren hittades inte')

    const payload: JWTPayload = {
      email: updated[0].email,
      name: updated[0].name,
      role: updated[0].role === 'admin' ? 'admin' : 'user',
    }

    if (this.onTokenUpdated) {
      await this.onTokenUpdated(payload)
    }

    return payload
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.postgrestUrl}/rpc/reset_password`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_email: user.email,
        p_old_password: oldPassword,
        p_new_password: newPassword,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      if (errorText.includes('invalid-credentials')) {
        throw new Error('Fel nuvarande lösenord')
      }
      if (errorText.includes('password-not-meet-requirements')) {
        throw new Error('Lösenordet måste vara minst 8 tecken och innehålla versaler, gemener och siffror')
      }
      throw new Error(errorText || 'Kunde inte byta lösenord')
    }
  }

  async deleteAccount(password?: string): Promise<void> {
    const headers = await this.getAuthHeaders()
    const res = await fetch(`${this.postgrestUrl}/rpc/delete_account`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_password: password ?? null,
        p_delete_data: false,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      if (errorText.includes('invalid-password')) {
        throw new Error('Fel lösenord')
      }
      if (errorText.includes('password-required')) {
        throw new Error('Lösenord krävs')
      }
      throw new Error(errorText || 'Kunde inte radera kontot')
    }

    if (this.onTokenCleared) {
      await this.onTokenCleared()
    }
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

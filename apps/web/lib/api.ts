import { env } from "./env";
import type { Recipe, ShoppingListItem, SharedRecipe, CategoryGroup } from "./types";
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api' })

export interface RecipeResult {
  recipes: Recipe[];
  totalCount: number;
}

export async function getRecipes(options?: {
  categories?: string[];
  search?: string;
  owner?: string;
  ownerIds?: string[];
  limit?: number;
  offset?: number;
  token?: string;
}): Promise<Recipe[]> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (options?.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  // Use RPC function for search (supports substring matching like "sås" → "vaniljsås")
  // Note: RPC only supports single category, so we pass the first one and filter client-side if multiple
  if (options?.search) {
    const res = await fetch(`${env.POSTGREST_URL}/rpc/search_recipes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_query: options.search,
        p_owner_only: options.owner ? true : false,
        p_category: options.categories?.[0] ?? null,
        p_limit: options.limit ?? 50,
        p_offset: options.offset ?? 0,
        ...(options.ownerIds && options.ownerIds.length > 0 ? { p_owner_ids: options.ownerIds } : {}),
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error({ responseBody: errorText, status: res.status }, 'Failed to search recipes');
      throw new Error(`Failed to search recipes: ${res.status} ${errorText}`);
    }
    let recipes: Recipe[] = await res.json();
    // Client-side filter for multiple categories (OR logic)
    if (options.categories && options.categories.length > 1) {
      const categorySet = new Set(options.categories.map(c => c.toLowerCase()));
      recipes = recipes.filter(r =>
        r.categories?.some(c => categorySet.has(c.toLowerCase()))
      );
    }
    return recipes;
  }

  // Regular fetch without search
  const params = new URLSearchParams();
  params.set("order", "date_published.desc");

  // Exclude non-owned featured recipes (featured recipes are only for the landing page)
  const andConditions: string[] = [];
  andConditions.push("or(is_featured.eq.false,is_owner.eq.true)");

  // Multi-category filter with OR logic
  if (options?.categories && options.categories.length > 0) {
    if (options.categories.length === 1) {
      params.set("categories", `cs.{"${options.categories[0]}"}`);
    } else {
      const orConditions = options.categories
        .map(cat => `categories.cs.{"${cat}"}`)
        .join(',');
      andConditions.push(`or(${orConditions})`);
    }
  }
  if (andConditions.length > 0) {
    params.set("and", `(${andConditions.join(',')})`);
  }
  if (options?.ownerIds && options.ownerIds.length > 0) {
    params.set("owner_id", `in.(${options.ownerIds.join(',')})`);
  } else if (options?.owner) {
    // Filter by is_owner instead of exposing email in query
    params.set("is_owner", "eq.true");
  }
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }
  if (options?.offset) {
    params.set("offset", String(options.offset));
  }

  const res = await fetch(`${env.POSTGREST_URL}/user_recipes?${params}`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    logger.error({ responseBody: errorText, status: res.status }, 'Failed to fetch recipes');
    throw new Error(`Failed to fetch recipes: ${res.status} ${errorText}`);
  }
  return res.json();
}

export async function getRecipe(id: string, token?: string): Promise<Recipe | null> {
  // If authenticated, use user_recipes view (includes private recipes)
  if (token) {
    const res = await fetch(`${env.POSTGREST_URL}/user_recipes?id=eq.${id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      logger.error({ detail: res.statusText, status: res.status, recipeId: id }, 'Failed to fetch recipe');
      return null;
    }
    const data = await res.json();
    return data[0] ?? null;
  }

  // If not authenticated, try featured_recipes view
  const res = await fetch(`${env.POSTGREST_URL}/featured_recipes?id=eq.${id}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    logger.error({ detail: res.statusText, status: res.status, recipeId: id }, 'Failed to fetch featured recipe');
    return null;
  }
  const data = await res.json();
  return data[0] ?? null;
}

export async function getCategories(): Promise<CategoryGroup[]> {
  try {
    const res = await fetch(
      `${env.POSTGREST_URL}/categories?select=name,category_groups(name,sort_order)&order=name`,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      logger.error({ status: res.status }, 'Failed to fetch categories');
      return [];
    }

    const data: Array<{
      name: string;
      category_groups: { name: string; sort_order: number } | null;
    }> = await res.json();

    // Group categories by their group
    const groupMap = new Map<string, { sort_order: number; categories: string[] }>();

    for (const cat of data) {
      const groupName = cat.category_groups?.name ?? 'Övrigt';
      const sortOrder = cat.category_groups?.sort_order ?? 99;

      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, { sort_order: sortOrder, categories: [] });
      }
      groupMap.get(groupName)!.categories.push(cat.name);
    }

    // Sort groups by sort_order, categories alphabetically within each group
    return Array.from(groupMap.entries())
      .sort((a, b) => a[1].sort_order - b[1].sort_order)
      .map(([name, { sort_order, categories }]) => ({
        name,
        sort_order,
        categories: categories.sort((a, b) => a.localeCompare(b, 'sv')),
      }));
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : String(error) }, 'Error fetching categories');
    return [];
  }
}

export interface TokenValidationResult {
  valid: boolean;
  error?: string;
}

export async function validatePasswordResetToken(token: string): Promise<TokenValidationResult> {
  try {
    const res = await fetch(
      `${env.POSTGREST_URL}/rpc/validate_password_reset_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_token: token,
        }),
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      logger.error({ responseBody: await res.text() }, 'Token validation request failed');
      return { valid: false, error: 'Kunde inte validera token' };
    }

    const result = await res.json();

    if (result.valid) {
      return { valid: true };
    } else {
      return {
        valid: false,
        error: 'Ogiltig eller utgången återställningslänk',
      };
    }
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : String(error) }, 'Token validation error');
    return { valid: false, error: 'Ett fel uppstod vid validering' };
  }
}

export async function getLikedRecipes(
  token: string,
  options?: {
    categories?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Recipe[]> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Use RPC function for search (supports substring matching)
  // Note: RPC only supports single category, so we pass the first one and filter client-side if multiple
  if (options?.search) {
    const res = await fetch(`${env.POSTGREST_URL}/rpc/search_liked_recipes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_query: options.search,
        p_category: options.categories?.[0] ?? null,
      }),
      cache: 'no-store',
    });

    if (!res.ok) throw new Error("Failed to search liked recipes");
    let recipes: Recipe[] = await res.json();
    // Client-side filter for multiple categories (OR logic)
    if (options.categories && options.categories.length > 1) {
      const categorySet = new Set(options.categories.map(c => c.toLowerCase()));
      recipes = recipes.filter(r =>
        r.categories?.some(c => categorySet.has(c.toLowerCase()))
      );
    }
    return recipes;
  }

  // Regular fetch without search
  const params = new URLSearchParams();
  params.set("order", "liked_at.desc");

  // Multi-category filter with OR logic
  if (options?.categories && options.categories.length > 0) {
    if (options.categories.length === 1) {
      params.set("categories", `cs.{"${options.categories[0]}"}`);
    } else {
      const orConditions = options.categories
        .map(cat => `categories.cs.{"${cat}"}`)
        .join(',');
      params.set("or", `(${orConditions})`);
    }
  }
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }
  if (options?.offset) {
    params.set("offset", String(options.offset));
  }

  const res = await fetch(`${env.POSTGREST_URL}/liked_recipes?${params}`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) throw new Error("Failed to fetch liked recipes");
  return res.json();
}

export async function getShoppingList(token: string, listId?: string, homeId?: string): Promise<ShoppingListItem[]> {
  const params = new URLSearchParams();
  params.set("order", "is_checked.asc,sort_order.asc");

  if (listId) {
    params.set("shopping_list_id", `eq.${listId}`);
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
  };
  if (homeId) {
    headers['X-Active-Home-Id'] = homeId;
  }

  const res = await fetch(`${env.POSTGREST_URL}/shopping_list_view?${params}`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) throw new Error("Failed to fetch shopping list");
  return res.json();
}

/**
 * Parse PostgREST Content-Range header to extract total count.
 * Format: "0-11/150" (range/total) or "* /150" (unknown range/total)
 * Returns 0 if header is missing or malformed.
 */
export function parseContentRange(header: string | null): number {
  if (!header) return 0;
  // Format: "0-11/150" or "*/150"
  const match = header.match(/\/(\d+|\*)$/);
  if (match && match[1] !== '*') {
    return parseInt(match[1], 10);
  }
  return 0;
}

export async function getRecipesWithCount(options?: {
  categories?: string[];
  search?: string;
  owner?: string;
  ownerIds?: string[];
  limit?: number;
  offset?: number;
  token?: string;
}): Promise<RecipeResult> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Prefer': 'count=exact',
  };
  if (options?.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  // For search, use the regular function (RPC doesn't support count header)
  if (options?.search) {
    const recipes = await getRecipes(options);
    return { recipes, totalCount: recipes.length };
  }

  // Regular fetch with count
  const params = new URLSearchParams();
  params.set("order", "date_published.desc");

  // Exclude non-owned featured recipes (featured recipes are only for the landing page)
  const andConditions: string[] = [];
  andConditions.push("or(is_featured.eq.false,is_owner.eq.true)");

  if (options?.categories && options.categories.length > 0) {
    if (options.categories.length === 1) {
      params.set("categories", `cs.{"${options.categories[0]}"}`);
    } else {
      const orConditions = options.categories
        .map(cat => `categories.cs.{"${cat}"}`)
        .join(',');
      andConditions.push(`or(${orConditions})`);
    }
  }
  if (andConditions.length > 0) {
    params.set("and", `(${andConditions.join(',')})`);
  }
  if (options?.ownerIds && options.ownerIds.length > 0) {
    params.set("owner_id", `in.(${options.ownerIds.join(',')})`);
  } else if (options?.owner) {
    params.set("is_owner", "eq.true");
  }
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }
  if (options?.offset) {
    params.set("offset", String(options.offset));
  }

  const res = await fetch(`${env.POSTGREST_URL}/user_recipes?${params}`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    logger.error({ responseBody: errorText, status: res.status }, 'Failed to fetch recipes with count');
    throw new Error(`Failed to fetch recipes with count: ${res.status} ${errorText}`);
  }

  const recipes: Recipe[] = await res.json();
  const totalCount = parseContentRange(res.headers.get('Content-Range'));

  return { recipes, totalCount };
}

export async function getLikedRecipesWithCount(
  token: string,
  options?: {
    categories?: string[];
    limit?: number;
    offset?: number;
  }
): Promise<RecipeResult> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Prefer': 'count=exact',
  };

  // For search, use the regular function
  const params = new URLSearchParams();
  params.set("order", "liked_at.desc");

  if (options?.categories && options.categories.length > 0) {
    if (options.categories.length === 1) {
      params.set("categories", `cs.{"${options.categories[0]}"}`);
    } else {
      const orConditions = options.categories
        .map(cat => `categories.cs.{"${cat}"}`)
        .join(',');
      params.set("or", `(${orConditions})`);
    }
  }
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }
  if (options?.offset) {
    params.set("offset", String(options.offset));
  }

  const res = await fetch(`${env.POSTGREST_URL}/liked_recipes?${params}`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    logger.error({ responseBody: errorText, status: res.status }, 'Failed to fetch liked recipes with count');
    throw new Error(`Failed to fetch liked recipes with count: ${res.status} ${errorText}`);
  }

  const recipes: Recipe[] = await res.json();
  const totalCount = parseContentRange(res.headers.get('Content-Range'));

  return { recipes, totalCount };
}

// Re-export CategoryWithCount type for client components
export type { CategoryWithCount } from '@/lib/types'

export async function getFeaturedRecipes(limit = 4): Promise<Recipe[]> {
  try {
    const params = new URLSearchParams();
    params.set("order", "date_published.desc");
    params.set("limit", String(limit));

    const res = await fetch(`${env.POSTGREST_URL}/featured_recipes?${params}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      logger.error({ status: res.status }, 'Failed to fetch featured recipes');
      return [];
    }

    return res.json();
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : String(error) }, 'Error fetching featured recipes');
    return [];
  }
}

export async function getSharedRecipe(token: string): Promise<SharedRecipe | null> {
  try {
    const res = await fetch(`${env.POSTGREST_URL}/rpc/get_shared_recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token: token }),
      cache: 'no-store',
    });

    if (!res.ok) {
      logger.error({ detail: res.statusText, status: res.status }, 'Failed to fetch shared recipe');
      return null;
    }

    const data = await res.json();

    // RPC returns empty array if token is invalid/expired/revoked
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return null;
    }

    // If it's an array, get the first (and only) element
    const recipe = Array.isArray(data) ? data[0] : data;

    return recipe;
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : String(error) }, 'Error fetching shared recipe');
    return null;
  }
}

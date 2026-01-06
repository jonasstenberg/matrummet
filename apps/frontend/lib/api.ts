import { env } from "./env";
import type { Recipe } from "./types";

export async function getRecipes(options?: {
  categories?: string[];
  search?: string;
  owner?: string;
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
        p_owner: options.owner ?? null,
        p_category: options.categories?.[0] ?? null,
        p_limit: options.limit ?? 50,
        p_offset: options.offset ?? 0,
      }),
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Failed to search recipes:", res.status, errorText);
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

  // Multi-category filter with OR logic
  if (options?.categories && options.categories.length > 0) {
    if (options.categories.length === 1) {
      params.set("categories", `cs.{"${options.categories[0]}"}`);
    } else {
      // PostgREST OR filter: or=(categories.cs.{"A"},categories.cs.{"B"})
      const orConditions = options.categories
        .map(cat => `categories.cs.{"${cat}"}`)
        .join(',');
      params.set("or", `(${orConditions})`);
    }
  }
  if (options?.owner) {
    params.set("owner", `eq.${options.owner}`);
  }
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }
  if (options?.offset) {
    params.set("offset", String(options.offset));
  }

  const res = await fetch(`${env.POSTGREST_URL}/recipes_and_categories?${params}`, {
    headers,
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Failed to fetch recipes:", res.status, errorText);
    throw new Error(`Failed to fetch recipes: ${res.status} ${errorText}`);
  }
  return res.json();
}

export async function getRecipe(id: string, token?: string): Promise<Recipe | null> {
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${env.POSTGREST_URL}/recipes_and_categories?id=eq.${id}`, {
    headers,
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error("Failed to fetch recipe");
  const data = await res.json();
  return data[0] ?? null;
}

export async function getCategories(): Promise<string[]> {
  try {
    const res = await fetch(`${env.POSTGREST_URL}/categories?select=name&order=name`, {
      next: { tags: ['categories'] },
    });

    if (!res.ok) {
      console.error("Failed to fetch categories:", res.status);
      return [];
    }

    const data = await res.json();
    return data.map((c: { name: string }) => c.name);
  } catch (error) {
    console.error("Error fetching categories:", error);
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
      console.error('Token validation request failed:', await res.text());
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
    console.error('Token validation error:', error);
    return { valid: false, error: 'Ett fel uppstod vid validering' };
  }
}

export async function getLikedRecipes(
  token: string,
  options?: {
    categories?: string[];
    search?: string;
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

  const res = await fetch(`${env.POSTGREST_URL}/liked_recipes?${params}`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) throw new Error("Failed to fetch liked recipes");
  return res.json();
}

export interface ShoppingListItem {
  id: string;
  shopping_list_id: string;
  food_id: string | null;
  unit_id: string | null;
  display_name: string;
  display_unit: string;
  quantity: number;
  is_checked: boolean;
  checked_at: string | null;
  sort_order: number;
  item_name: string;
  unit_name: string;
  list_name: string;
  source_recipes: string[] | null;
  date_published: string;
}

export async function getShoppingList(token: string, listId?: string): Promise<ShoppingListItem[]> {
  const params = new URLSearchParams();
  params.set("order", "is_checked.asc,sort_order.asc");

  if (listId) {
    params.set("shopping_list_id", `eq.${listId}`);
  }

  const res = await fetch(`${env.POSTGREST_URL}/shopping_list_view?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) throw new Error("Failed to fetch shopping list");
  return res.json();
}


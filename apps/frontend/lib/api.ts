import { env } from "./env";
import type { Recipe } from "./types";

export async function getRecipes(options?: {
  category?: string;
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
  if (options?.search) {
    const res = await fetch(`${env.POSTGREST_URL}/rpc/search_recipes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_query: options.search,
        p_owner: options.owner ?? null,
        p_category: options.category ?? null,
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
    return res.json();
  }

  // Regular fetch without search
  const params = new URLSearchParams();
  params.set("order", "date_published.desc");

  if (options?.category) {
    params.set("categories", `cs.{"${options.category}"}`);
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
    category?: string;
    search?: string;
  }
): Promise<Recipe[]> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Use RPC function for search (supports substring matching)
  if (options?.search) {
    const res = await fetch(`${env.POSTGREST_URL}/rpc/search_liked_recipes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_query: options.search,
        p_category: options.category ?? null,
      }),
      cache: 'no-store',
    });

    if (!res.ok) throw new Error("Failed to search liked recipes");
    return res.json();
  }

  // Regular fetch without search
  const params = new URLSearchParams();
  params.set("order", "liked_at.desc");

  if (options?.category) {
    params.set("categories", `cs.{"${options.category}"}`);
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


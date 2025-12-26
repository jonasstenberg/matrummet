import { env } from "./env";
import type { Recipe } from "./types";

export async function getRecipes(options?: {
  category?: string;
  search?: string;
  owner?: string;
  limit?: number;
  offset?: number;
}): Promise<Recipe[]> {
  const params = new URLSearchParams();
  params.set("order", "date_published.desc");

  if (options?.category) {
    params.set("categories", `cs.{"${options.category}"}`);
  }
  if (options?.search) {
    params.set("full_tsv", `phfts(swedish).${options.search}`);
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
    next: { revalidate: 60 },
  });

  if (!res.ok) throw new Error("Failed to fetch recipes");
  return res.json();
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const res = await fetch(`${env.POSTGREST_URL}/recipes_and_categories?id=eq.${id}`, {
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

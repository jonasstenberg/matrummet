/**
 * JSON-LD recipe parsing utilities
 */

export interface JsonLdRecipe {
  "@type"?: string;
  "@graph"?: Array<Record<string, unknown>>;
  name?: string;
  description?: string;
  recipeIngredient?: string[];
  recipeInstructions?: Array<
    string | { "@type"?: string; text?: string; name?: string; itemListElement?: unknown[] }
  >;
  prepTime?: string;
  cookTime?: string;
  recipeYield?: string | string[];
  author?: string | { name?: string };
  image?: string | string[] | { url?: string };
  recipeCuisine?: string;
  recipeCategory?: string | string[];
  [key: string]: unknown; // Allow indexing for compatibility with Record<string, unknown>
}

/**
 * Extract a URL from text if present
 * Returns the URL and the remaining text
 */
export function extractUrl(text: string): { url: string | null; remainingText: string } {
  const urlRegex = /https?:\/\/[^\s]+/i;
  const match = text.match(urlRegex);

  if (match) {
    const url = match[0];
    const remainingText = text.replace(url, "").trim();
    return { url, remainingText };
  }

  return { url: null, remainingText: text };
}

/**
 * Parse JSON-LD recipe data from a JSON string
 * Returns the structured recipe data if found, null otherwise
 */
export function parseJsonLdContent(jsonContent: string): JsonLdRecipe | null {
  try {
    const data = JSON.parse(jsonContent) as JsonLdRecipe;

    // Direct Recipe type
    if (data["@type"] === "Recipe") {
      return data;
    }

    // Recipe in @graph array
    if (data["@graph"] && Array.isArray(data["@graph"])) {
      const recipe = data["@graph"].find(
        (item): item is JsonLdRecipe =>
          typeof item === "object" && item !== null && item["@type"] === "Recipe"
      );
      if (recipe) {
        return recipe;
      }
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

/**
 * Parse JSON-LD recipe data from an array of JSON strings
 * Returns the first recipe found, null otherwise
 */
export function parseJsonLdFromScripts(
  scripts: Array<string | null>
): JsonLdRecipe | null {
  for (const content of scripts) {
    if (!content) continue;
    const recipe = parseJsonLdContent(content);
    if (recipe) {
      return recipe;
    }
  }
  return null;
}

/**
 * Parse JSON-LD recipe data from HTML string
 * Returns the structured recipe data if found, null otherwise
 */
export function parseJsonLdFromHtml(html: string): JsonLdRecipe | null {
  // Find JSON-LD scripts
  const jsonLdMatch = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (!jsonLdMatch) {
    return null;
  }

  // Extract content from script tags and parse
  const contents = jsonLdMatch.map((script) =>
    script.replace(/<script[^>]*>|<\/script>/gi, "")
  );
  return parseJsonLdFromScripts(contents);
}

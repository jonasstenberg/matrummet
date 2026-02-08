/**
 * JSON-LD recipe parsing utilities
 */

// Re-export shared type
export type { JsonLdRecipe } from "@/lib/recipe-import/types"
import type { JsonLdRecipe } from "@/lib/recipe-import/types"

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

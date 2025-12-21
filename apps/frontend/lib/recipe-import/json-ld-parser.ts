import { load } from 'cheerio'
import { JsonLdRecipe } from './types'

/**
 * Extract JSON-LD Recipe data from HTML content
 */
export function extractJsonLdRecipe(html: string): JsonLdRecipe | null {
  const $ = load(html)
  
  // Find all <script type="application/ld+json"> tags
  const scripts = $('script[type="application/ld+json"]')
  
  for (let i = 0; i < scripts.length; i++) {
    const scriptContent = $(scripts[i]).html()
    if (!scriptContent) continue
    
    try {
      const parsed = JSON.parse(scriptContent)
      
      // Check if it's a single Recipe
      if (parsed['@type'] === 'Recipe') {
        return parsed as JsonLdRecipe
      }
      
      // Check if it's wrapped in @graph structure
      if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        const recipe = parsed['@graph'].find((item: unknown) => 
          typeof item === 'object' && item !== null && (item as Record<string, unknown>)['@type'] === 'Recipe'
        )
        if (recipe) {
          return recipe as JsonLdRecipe
        }
      }
      
      // Check if it's an array of items
      if (Array.isArray(parsed)) {
        const recipe = parsed.find((item: unknown) => 
          typeof item === 'object' && item !== null && (item as Record<string, unknown>)['@type'] === 'Recipe'
        )
        if (recipe) {
          return recipe as JsonLdRecipe
        }
      }
    } catch (error) {
      // Skip invalid JSON
      continue
    }
  }
  
  return null
}

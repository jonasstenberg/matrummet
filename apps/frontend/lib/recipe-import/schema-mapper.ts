import { CreateRecipeInput } from '@/lib/types'
import { JsonLdRecipe, HowToStep, HowToSection, ParsedIngredient } from './types'
import { parseIngredient } from './ingredient-parser'
import { parseDuration } from './duration-parser'

export interface MappingResult {
  data: Partial<CreateRecipeInput>
  warnings: string[]
}

/**
 * Extract image URL from various JSON-LD image formats
 */
function extractImageUrl(image: JsonLdRecipe['image']): string | null {
  if (!image) return null
  
  if (typeof image === 'string') {
    return image
  }
  
  if (Array.isArray(image)) {
    const first = image[0]
    if (typeof first === 'string') {
      return first
    }
    if (typeof first === 'object' && first !== null && 'url' in first) {
      return String(first.url)
    }
  }
  
  if (typeof image === 'object' && image !== null && 'url' in image) {
    return String(image.url)
  }
  
  return null
}

/**
 * Extract author name from various JSON-LD author formats
 */
function extractAuthor(author: JsonLdRecipe['author']): string | null {
  if (!author) return null
  
  if (typeof author === 'string') {
    return author
  }
  
  if (Array.isArray(author)) {
    const first = author[0]
    if (typeof first === 'string') {
      return first
    }
    if (typeof first === 'object' && first !== null && 'name' in first) {
      return String(first.name)
    }
  }
  
  if (typeof author === 'object' && author !== null && 'name' in author) {
    return String(author.name)
  }
  
  return null
}

/**
 * Parse recipe yield (e.g., "ca 30 st", "4 servings", "12")
 * Returns { yield: string, name: string | null }
 */
function parseRecipeYield(recipeYield: JsonLdRecipe['recipeYield']): {
  yield: string | null
  name: string | null
} {
  if (!recipeYield) {
    return { yield: null, name: null }
  }
  
  // Handle array - take first element
  const yieldStr = Array.isArray(recipeYield) 
    ? String(recipeYield[0] || '') 
    : String(recipeYield)
  
  if (!yieldStr.trim()) {
    return { yield: null, name: null }
  }
  
  // Pattern: optional "ca"/"about" + number + optional unit
  const match = yieldStr.match(/(?:ca\.?\s+|about\s+)?(\d+(?:[.,]\d+)?)\s*(.+)?/)
  
  if (match) {
    const quantity = match[1].replace(',', '.')
    const unit = match[2]?.trim() || null
    return { yield: quantity, name: unit }
  }
  
  // If just a number
  if (/^\d+$/.test(yieldStr)) {
    return { yield: yieldStr, name: null }
  }
  
  // Otherwise return the whole thing as yield
  return { yield: yieldStr, name: null }
}

/**
 * Extract instruction text from HowToStep, HowToSection, or string
 */
function extractInstructionText(instruction: unknown): string | null {
  if (typeof instruction === 'string') {
    return instruction.trim()
  }
  
  if (typeof instruction === 'object' && instruction !== null) {
    const obj = instruction as Record<string, unknown>
    
    // HowToStep
    if (obj['@type'] === 'HowToStep' && typeof obj.text === 'string') {
      return obj.text.trim()
    }
    
    // Generic object with text property
    if (typeof obj.text === 'string') {
      return obj.text.trim()
    }
  }
  
  return null
}

/**
 * Parse recipe instructions from various JSON-LD formats
 */
function parseInstructions(
  instructions: JsonLdRecipe['recipeInstructions']
): Array<{ step: string } | { group: string }> {
  if (!instructions) return []
  
  const result: Array<{ step: string } | { group: string }> = []
  
  // Single string instruction
  if (typeof instructions === 'string') {
    const text = instructions.trim()
    if (text) {
      result.push({ step: text })
    }
    return result
  }
  
  // Single HowToStep
  if (typeof instructions === 'object' && !Array.isArray(instructions)) {
    const text = extractInstructionText(instructions)
    if (text) {
      result.push({ step: text })
    }
    return result
  }
  
  // Array of instructions
  if (Array.isArray(instructions)) {
    for (const item of instructions) {
      // HowToSection with grouped steps
      if (
        typeof item === 'object' &&
        item !== null &&
        (item as unknown as Record<string, unknown>)['@type'] === 'HowToSection'
      ) {
        const section = item as unknown as HowToSection
        
        // Add group header if named
        if (section.name) {
          result.push({ group: section.name })
        }
        
        // Add steps from section
        if (section.itemListElement && Array.isArray(section.itemListElement)) {
          for (const step of section.itemListElement) {
            const text = extractInstructionText(step)
            if (text) {
              result.push({ step: text })
            }
          }
        }
      } else {
        // Regular step or string
        const text = extractInstructionText(item)
        if (text) {
          result.push({ step: text })
        }
      }
    }
  }
  
  return result
}

/**
 * Map JSON-LD Recipe to CreateRecipeInput format
 */
export function mapJsonLdToRecipeInput(
  jsonLd: JsonLdRecipe,
  sourceUrl: string
): MappingResult {
  const warnings: string[] = []
  
  // Parse image
  const imageUrl = extractImageUrl(jsonLd.image)
  
  // Parse author
  const author = extractAuthor(jsonLd.author)
  
  // Parse durations
  const prepTime = parseDuration(jsonLd.prepTime)
  const cookTime = parseDuration(jsonLd.cookTime)
  const totalTime = parseDuration(jsonLd.totalTime)

  // If only totalTime is provided, use it for cook_time
  const finalPrepTime = prepTime ?? null
  const finalCookTime = cookTime ?? totalTime ?? null
  
  // Parse recipe yield
  const yieldData = parseRecipeYield(jsonLd.recipeYield)
  
  // Parse cuisine
  const cuisine = jsonLd.recipeCuisine
    ? Array.isArray(jsonLd.recipeCuisine)
      ? jsonLd.recipeCuisine.join(', ')
      : String(jsonLd.recipeCuisine)
    : null
  
  // Parse ingredients
  const ingredients: Array<{ name: string; measurement: string; quantity: string }> = []
  
  if (jsonLd.recipeIngredient && Array.isArray(jsonLd.recipeIngredient)) {
    for (const ingredientStr of jsonLd.recipeIngredient) {
      const parsed = parseIngredient(String(ingredientStr))
      
      if (parsed.confidence === 'low') {
        warnings.push(`Låg konfidens vid parsning av ingrediens: "${ingredientStr}"`)
      }
      
      ingredients.push({
        name: parsed.name,
        measurement: parsed.measurement,
        quantity: parsed.quantity,
      })
    }
  }
  
  // Parse instructions
  const instructions = parseInstructions(jsonLd.recipeInstructions)
  
  if (instructions.length === 0) {
    warnings.push('Inga instruktioner hittades i receptet')
  }
  
  // Build the result
  const data: Partial<CreateRecipeInput> = {
    recipe_name: jsonLd.name,
    description: jsonLd.description || '',
    url: sourceUrl,
    author: author,
    prep_time: finalPrepTime,
    cook_time: finalCookTime,
    recipe_yield: yieldData.yield,
    recipe_yield_name: yieldData.name,
    cuisine: cuisine,
    image: imageUrl,
    thumbnail: imageUrl, // Use same image for thumbnail
    ingredients,
    instructions,
  }
  
  return { data, warnings }
}

import { ParsedIngredient } from './types'

/**
 * Parse a recipe ingredient string into structured components
 * 
 * Handles formats like:
 * - "2 dl mjölk" → { quantity: "2", measurement: "dl", name: "mjölk" }
 * - "1 kg potatis, skalad" → { quantity: "1", measurement: "kg", name: "potatis, skalad" }
 * - "Salt och peppar" → { quantity: "", measurement: "", name: "Salt och peppar" }
 */
export function parseIngredient(ingredient: string): ParsedIngredient {
  const trimmed = ingredient.trim()

  // Common measurement units (Swedish and English)
  const units = [
    // Volume
    'dl', 'ml', 'l', 'liter', 'krm', 'tsk', 'msk', 'klyfta', 'klyftor',
    'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp',
    'fluid ounce', 'fluid ounces', 'fl oz', 'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons',
    // Weight
    'g', 'gram', 'kg', 'hg', 'mg',
    'ounce', 'ounces', 'oz', 'pound', 'pounds', 'lb', 'lbs',
    // Pieces
    'st', 'styck', 'stycken', 'bit', 'bitar', 'skiva', 'skivor',
    'piece', 'pieces', 'slice', 'slices', 'clove', 'cloves',
    // Other
    'burk', 'burkar', 'påse', 'påsar', 'förp', 'förpackning',
    'can', 'cans', 'package', 'packages', 'bunch', 'bunches',
  ]

  // Pattern: (quantity) (unit) (name)
  // Quantity can be: number, fraction, range, or empty
  const quantityPattern = /^(\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?|\d+\/\d+|ca\.?\s*\d+(?:[.,]\d+)?)?/
  const quantityMatch = trimmed.match(quantityPattern)
  
  if (!quantityMatch || !quantityMatch[1]) {
    // No quantity found - return as is with low confidence
    return {
      quantity: '',
      measurement: '',
      name: trimmed,
      confidence: 'low',
    }
  }

  const quantity = quantityMatch[1].replace(/,/g, '.').trim()
  const afterQuantity = trimmed.slice(quantityMatch[0].length).trim()

  // Try to find a unit
  const unitsPattern = '(' + units.join('|') + ')'
  const unitRegex = new RegExp('^' + unitsPattern + '(?:\\s+|$)', 'i')
  const unitMatch = afterQuantity.match(unitRegex)

  if (unitMatch) {
    const measurement = unitMatch[1].toLowerCase()
    const name = afterQuantity.slice(unitMatch[0].length).trim()
    
    return {
      quantity,
      measurement,
      name: name || trimmed, // Fallback to full string if name is empty
      confidence: name ? 'high' : 'medium',
    }
  }

  // No unit found - ingredient name starts after quantity
  return {
    quantity,
    measurement: '',
    name: afterQuantity || trimmed,
    confidence: afterQuantity ? 'medium' : 'low',
  }
}

/**
 * JSON-LD Recipe schema types
 * Based on https://schema.org/Recipe
 */

export interface JsonLdRecipe {
  '@context'?: string | string[]
  '@type': 'Recipe'
  name: string
  description?: string
  image?: string | string[] | { url: string } | Array<{ url: string }>
  author?: string | { name: string } | Array<{ name: string }>
  prepTime?: string // ISO 8601 duration (e.g., "PT30M")
  cookTime?: string
  totalTime?: string
  recipeYield?: string | number | string[]
  recipeCuisine?: string | string[]
  recipeIngredient?: string[]
  recipeInstructions?:
    | string
    | string[]
    | HowToStep
    | HowToStep[]
    | Array<string | HowToStep | HowToSection>
  datePublished?: string
  [key: string]: unknown // Allow other properties
}

export interface HowToStep {
  '@type': 'HowToStep'
  text: string
  name?: string
  url?: string
  [key: string]: unknown
}

export interface HowToSection {
  '@type': 'HowToSection'
  name?: string
  itemListElement?: HowToStep[]
  [key: string]: unknown
}

export interface ParsedIngredient {
  name: string
  measurement: string
  quantity: string
  confidence: 'high' | 'medium' | 'low'
}

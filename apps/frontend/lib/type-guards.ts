import type { Recipe } from './types'
import type { RecipeFormData } from './recipe-form-utils'

/**
 * Type guard to check if data is a Recipe (has an id, meaning it's an existing recipe)
 */
export function isRecipe(data: Recipe | RecipeFormData | undefined): data is Recipe {
  return data !== undefined && 'id' in data
}

/**
 * Type guard to check if data is RecipeFormData (has originalPrompt field)
 */
export function isRecipeFormData(data: Recipe | RecipeFormData | undefined): data is RecipeFormData {
  return data !== undefined && 'originalPrompt' in data
}

// Types for the "What can I make?" feature

export interface SelectedIngredient {
  id: string
  name: string
}

export interface RecipeMatch {
  recipe_id: string
  name: string
  description: string | null
  image: string | null
  categories: string[]
  total_ingredients: number
  matching_ingredients: number
  match_percentage: number
  missing_food_ids: string[]
  missing_food_names: string[]
  owner: string
  prep_time: number | null
  cook_time: number | null
  recipe_yield: number | null
  recipe_yield_name: string | null
}

export interface PantryItem {
  id: string
  food_id: string
  food_name: string
  quantity: number | null
  unit: string | null
  added_at: string
  expires_at: string | null
}

export interface SubstitutionSuggestion {
  substitute_name: string
  available: boolean
  confidence: 'high' | 'medium' | 'low'
  notes: string
}

export interface IngredientSubstitution {
  original_food_id: string
  original_name: string
  suggestions: SubstitutionSuggestion[]
}

export interface SubstitutionResponse {
  substitutions: IngredientSubstitution[]
}

export interface CommonPantryItem {
  id: string
  name: string
  category: 'basic' | 'herb' | 'spice' | 'seasoning'
}


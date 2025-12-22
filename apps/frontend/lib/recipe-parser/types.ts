export interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
}

export interface OllamaModelsResponse {
  models: OllamaModel[]
}

export interface OllamaGenerateResponse {
  model: string
  created_at: string
  response: string
  done: boolean
}

export interface ParsedRecipe {
  recipe_name: string
  description: string
  author?: string | null
  recipe_yield?: string | null
  recipe_yield_name?: string | null
  prep_time?: number | null
  cook_time?: number | null
  cuisine?: string | null
  categories?: string[]
  ingredients: Array<{ name: string; measurement: string; quantity: string }>
  instructions: Array<{ step: string }>
}

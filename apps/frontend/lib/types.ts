export interface User {
  id: string
  name: string
  email: string
  measures_system: 'metric' | 'imperial'
  provider: string | null
  owner: string
  role?: 'user' | 'admin'
}

export interface Category {
  id: string
  name: string
  recipe_count?: number
}

export interface IngredientGroup {
  id?: string
  name: string
  sort_order?: number
}

export interface Ingredient {
  id?: string
  name: string
  measurement: string
  quantity: string
  group_id?: string | null
  sort_order?: number
}

export interface InstructionGroup {
  id?: string
  name: string
  sort_order?: number
}

export interface Instruction {
  id?: string
  step: string
  group_id?: string | null
  sort_order?: number
}

export interface Recipe {
  id: string
  name: string
  author: string | null
  description: string
  url: string | null
  recipe_yield: number | null
  recipe_yield_name: string | null
  prep_time: number | null
  cook_time: number | null
  cuisine: string | null
  image: string | null
  thumbnail: string | null
  owner: string
  date_published: string | null
  date_modified: string | null
  categories: string[]
  ingredient_groups: IngredientGroup[]
  ingredients: Ingredient[]
  instruction_groups: InstructionGroup[]
  instructions: Instruction[]
}

export interface CreateRecipeInput {
  recipe_name: string
  author?: string | null
  description: string
  url?: string | null
  recipe_yield?: string | null
  recipe_yield_name?: string | null
  prep_time?: number | null
  cook_time?: number | null
  cuisine?: string | null
  image?: string | null
  thumbnail?: string | null
  date_published?: string | null
  categories?: string[]
  ingredients: Array<
    | { group: string }
    | {
        name: string
        measurement: string
        quantity: string
      }
  >
  instructions: Array<
    | { group: string }
    | { step: string }
  >
}

export interface UpdateRecipeInput {
  recipe_id: string
  recipe_name?: string
  author?: string | null
  description?: string
  url?: string | null
  recipe_yield?: string | null
  recipe_yield_name?: string | null
  prep_time?: number | null
  cook_time?: number | null
  cuisine?: string | null
  image?: string | null
  thumbnail?: string | null
  date_published?: string | null
  categories?: string[]
  ingredients?: Array<
    | { group: string }
    | {
        name: string
        measurement: string
        quantity: string
      }
  >
  instructions?: Array<
    | { group: string }
    | { step: string }
  >
}

export interface Food {
  id: string
  name: string
  date_published?: string
  date_modified?: string
  ingredient_count?: number
}

export interface Unit {
  id: string
  name: string
  plural: string
  abbreviation: string
  date_published?: string
  date_modified?: string
  ingredient_count?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

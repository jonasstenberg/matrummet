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
  food_id?: string
  unit_id?: string
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
  is_liked?: boolean
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

export interface ShoppingListItem {
  id: string
  shopping_list_id: string
  food_id: string | null
  unit_id: string | null
  display_name: string
  display_unit: string
  quantity: number
  is_checked: boolean
  checked_at: string | null
  sort_order: number
  item_name: string
  unit_name: string
  list_name: string
  source_recipes: string[] | null
  date_published: string
}

export interface ApiKey {
  id: string
  name: string
  prefix: string
  last_used_at: string | null
  date_published: string
}

export interface ShoppingList {
  id: string
  name: string
  is_default: boolean
  item_count: number
  checked_count: number
  date_published: string
  date_modified: string
}

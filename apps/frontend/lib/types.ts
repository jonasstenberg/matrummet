export interface User {
  id: string
  name: string
  email: string
  measures_system: 'metric' | 'imperial'
  provider: string | null
  owner: string
  role?: 'user' | 'admin'
  home_id?: string
  home_name?: string
}

export interface Category {
  id: string
  name: string
  recipe_count?: number
}

// Category with required recipe_count for admin pages
export interface CategoryWithCount {
  id: string
  name: string
  recipe_count: number
  group_name?: string
}

export interface CategoryGroup {
  name: string
  sort_order: number
  categories: string[]
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
  form?: string
  group_id?: string | null
  sort_order?: number
  food_id?: string
  unit_id?: string
  in_pantry?: boolean
}

export interface InstructionGroup {
  id?: string
  name: string
  sort_order?: number
}

export interface MatchedIngredient {
  id: string
  name: string
  quantity: string
  measurement: string
}

export interface Instruction {
  id?: string
  step: string
  group_id?: string | null
  sort_order?: number
  matched_ingredients?: MatchedIngredient[]
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
  date_published: string | null
  date_modified: string | null
  categories: string[]
  ingredient_groups: IngredientGroup[]
  ingredients: Ingredient[]
  instruction_groups: InstructionGroup[]
  instructions: Instruction[]
  is_liked?: boolean
  pantry_match_percentage?: number
  pantry_matching_count?: number
  pantry_total_count?: number
  owner_name?: string
  owner_id?: string
  is_owner?: boolean
  // Attribution fields (for copied recipes)
  copied_from_recipe_id?: string | null
  copied_from_user_id?: string | null
  copied_from_author_name?: string | null
  // Admin-only field for landing page preview
  is_featured?: boolean
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
        form?: string
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
        form?: string
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

export interface Home {
  id: string
  name: string
  join_code: string | null
  join_code_expires_at: string | null
  date_published: string
  date_modified: string
}

export interface HomeMember {
  email: string
  name: string
  joined_at?: string
}

export interface HomeInvitation {
  id: string
  home_id: string
  invited_email: string
  invited_by_email: string
  invited_by_name?: string
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled'
  expires_at: string
  date_published: string
}

export interface HomeInfo {
  id: string
  name: string
  join_code: string | null
  join_code_expires_at: string | null
  member_count: number
  members: HomeMember[]
}

export interface HomeJoinCode {
  code: string
  expires_at: string
}

export interface ShareLink {
  id: string
  token: string
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  view_count: number
  last_viewed_at: string | null
  is_active: boolean
}

export interface SharedRecipe {
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
  date_published: string | null
  date_modified: string | null
  categories: string[]
  ingredient_groups: IngredientGroup[]
  ingredients: Ingredient[]
  instruction_groups: InstructionGroup[]
  instructions: Instruction[]
  owner_name: string
  shared_by_name: string
}

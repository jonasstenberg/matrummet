import { z, toJSONSchema } from "zod"

// Suggested recipe sub-schemas (inline to avoid import coupling with recipe-parser)
const SuggestedIngredientSchema = z.object({
  name: z.string(),
  measurement: z.string(),
  quantity: z.string(),
})

const SuggestedIngredientGroupSchema = z.object({
  group_name: z.string(),
  ingredients: z.array(SuggestedIngredientSchema),
})

const SuggestedInstructionGroupSchema = z.object({
  group_name: z.string(),
  instructions: z.array(z.object({ step: z.string() })),
})

export const SuggestedRecipeSchema = z.object({
  recipe_name: z.string(),
  description: z.string(),
  recipe_yield: z.number().nullable().optional(),
  prep_time: z.number().nullable().optional(),
  cook_time: z.number().nullable().optional(),
  categories: z.array(z.string()).optional(),
  ingredient_groups: z.array(SuggestedIngredientGroupSchema),
  instruction_groups: z.array(SuggestedInstructionGroupSchema),
  // Base recipe attribution (present when sourced from base_recipes pool)
  source_url: z.string().optional(),
  source_site: z.string().optional(),
})

export type SuggestedRecipe = z.infer<typeof SuggestedRecipeSchema>

// AI response schema for meal plan generation
const MealPlanEntryResponseSchema = z.object({
  day_of_week: z.number().describe("Veckodag 1=måndag, 7=söndag"),
  meal_type: z.string().describe("Måltidstyp: frukost, lunch, middag, mellanmal"),
  recipe_id: z.string().nullable().describe("UUID för ett befintligt recept, eller null om nytt förslag"),
  suggested_name: z.string().nullable().describe("Namn på föreslagen rätt om inget befintligt recept"),
  suggested_description: z.string().nullable().describe("Kort beskrivning av föreslagen rätt"),
  suggested_recipe: SuggestedRecipeSchema.nullable().optional().describe("Fullständigt recept för förslag (när recipe_id = null)"),
  reason: z.string().describe("Kort motivering till varför rätten valdes"),
})

export const MealPlanResponseSchema = z.object({
  entries: z.array(MealPlanEntryResponseSchema),
  summary: z.string().describe("Sammanfattning av veckoplanens tema och tänk"),
})

export type MealPlanResponse = z.infer<typeof MealPlanResponseSchema>
export type MealPlanEntryResponse = z.infer<typeof MealPlanEntryResponseSchema>

export const MEAL_PLAN_JSON_SCHEMA = toJSONSchema(MealPlanResponseSchema)

// Frontend types
export interface MealPlanPreferences {
  categories: string[]
  meal_types: string[]
  servings: number
}

export interface MealPlanEntry {
  id: string
  day_of_week: number
  meal_type: string
  recipe_id: string | null
  suggested_name: string | null
  suggested_description: string | null
  suggested_recipe?: SuggestedRecipe | null
  servings: number
  sort_order: number
  // Joined recipe details
  recipe_name?: string
  recipe_image?: string
  recipe_thumbnail?: string
  recipe_prep_time?: number
  recipe_cook_time?: number
  recipe_yield?: number
  recipe_categories?: string[]
}

export interface MealPlan {
  id: string
  name: string
  week_start: string
  preferences: MealPlanPreferences
  status: string
  entries: MealPlanEntry[]
}

export interface MealPlanSummary {
  id: string
  week_start: string
  status: string
  entry_count: number
}

export const DAY_NAMES = [
  "Måndag",
  "Tisdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lördag",
  "Söndag",
] as const

export const DAY_SHORT_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"] as const

export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7] as const

export const MEAL_TYPES = [
  { id: "frukost", label: "Frukost" },
  { id: "lunch", label: "Lunch" },
  { id: "middag", label: "Middag" },
  { id: "mellanmal", label: "Mellanmål" },
] as const

export const MEAL_TYPE_PRESETS = [
  { id: "dinner_only", label: "Bara middag", types: ["middag"] },
  { id: "lunch_dinner", label: "Lunch + middag", types: ["lunch", "middag"] },
  { id: "all", label: "Alla måltider", types: ["frukost", "lunch", "middag", "mellanmal"] },
] as const

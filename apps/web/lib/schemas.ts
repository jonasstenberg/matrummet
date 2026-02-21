import { z } from 'zod'

// Ingredient schema - can be either a group marker or an actual ingredient
const ingredientItemSchema = z.union([
  z.object({
    group: z.string().min(1, 'Gruppnamn får inte vara tomt'),
  }),
  z.object({
    name: z.string().min(1, 'Ingrediensnamn är obligatoriskt'),
    measurement: z.string(),
    quantity: z.string(),
    form: z.string().optional(),
  }),
])

// Instruction schema - can be either a group marker or an actual instruction step
const instructionItemSchema = z.union([
  z.object({
    group: z.string().min(1, 'Gruppnamn får inte vara tomt'),
  }),
  z.object({
    step: z.string().min(1, 'Instruktion får inte vara tom'),
  }),
])

// Recipe input schema (for creating/updating recipes)
export const recipeInputSchema = z.object({
  recipe_name: z.string().trim().min(1, 'Receptnamn är obligatoriskt'),
  author: z.string().trim().nullable().optional(),
  description: z.string().trim().min(1, 'Beskrivning är obligatorisk'),
  url: z
    .string()
    .url('Ogiltig URL')
    .trim()
    .nullable()
    .optional()
    .or(z.literal('')),
  recipe_yield: z.string().trim().nullable().optional(),
  recipe_yield_name: z.string().trim().nullable().optional(),
  prep_time: z
    .number()
    .int('Förberedelsetid måste vara ett heltal')
    .nonnegative('Förberedelsetid kan inte vara negativ')
    .nullable()
    .optional(),
  cook_time: z
    .number()
    .int('Tillagningstid måste vara ett heltal')
    .nonnegative('Tillagningstid kan inte vara negativ')
    .nullable()
    .optional(),
  cuisine: z.string().trim().nullable().optional(),
  image: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  date_published: z.string().nullable().optional(),
  categories: z.array(z.string()).optional(),
  ingredients: z
    .array(ingredientItemSchema)
    .min(1, 'Minst en ingrediens måste anges'),
  instructions: z
    .array(instructionItemSchema)
    .min(1, 'Minst en instruktion måste anges'),
})

export type RecipeInputSchema = z.infer<typeof recipeInputSchema>

// Login input schema
export const loginInputSchema = z.object({
  email: z.string().trim().email('Ogiltig e-postadress'),
  password: z.string().min(1, 'Lösenord är obligatoriskt'),
})

export type LoginInputSchema = z.infer<typeof loginInputSchema>

// Signup input schema
export const signupInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Namn är obligatoriskt').max(255, 'Namnet får vara max 255 tecken'),
    email: z.string().trim().email('Ogiltig e-postadress'),
    password: z
      .string()
      .min(8, 'Lösenordet måste vara minst 8 tecken')
      .max(72, 'Lösenordet får vara max 72 tecken')
      .regex(/[A-Z]/, 'Lösenordet måste innehålla minst en versal')
      .regex(/[a-z]/, 'Lösenordet måste innehålla minst en gemen')
      .regex(/[0-9]/, 'Lösenordet måste innehålla minst en siffra'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Lösenorden matchar inte',
    path: ['confirmPassword'],
  })

export type SignupInputSchema = z.infer<typeof signupInputSchema>

// Update profile schema
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Namn är obligatoriskt'),
})

export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>

// Change password schema
export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Nuvarande lösenord är obligatoriskt'),
    newPassword: z
      .string()
      .min(8, 'Lösenordet måste vara minst 8 tecken')
      .max(72, 'Lösenordet får vara max 72 tecken')
      .regex(/[A-Z]/, 'Lösenordet måste innehålla minst en versal')
      .regex(/[a-z]/, 'Lösenordet måste innehålla minst en gemen')
      .regex(/[0-9]/, 'Lösenordet måste innehålla minst en siffra'),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Lösenorden matchar inte',
    path: ['confirmNewPassword'],
  })

export type ChangePasswordSchema = z.infer<typeof changePasswordSchema>

// Reset password schema (for forgot password flow)
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Lösenordet måste vara minst 8 tecken')
      .max(72, 'Lösenordet får vara max 72 tecken')
      .regex(/[A-Z]/, 'Lösenordet måste innehålla minst en versal')
      .regex(/[a-z]/, 'Lösenordet måste innehålla minst en gemen')
      .regex(/[0-9]/, 'Lösenordet måste innehålla minst en siffra'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Lösenorden matchar inte',
    path: ['confirmPassword'],
  })

export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>

// Email-only schema (for forgot password form)
export const emailSchema = z.object({
  email: z.string().trim().email('Ogiltig e-postadress'),
})

export type EmailSchema = z.infer<typeof emailSchema>

// Recipe form schema - matches form UI structure (different from API schema)
// Uses camelCase field names and stores groups separately from items
const formIngredientSchema = z.object({
  name: z.string(),
  measurement: z.string(),
  quantity: z.string(),
  form: z.string().optional(),
  group_id: z.string().nullable().optional(),
})

const formIngredientGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const formInstructionSchema = z.object({
  step: z.string(),
  group_id: z.string().nullable().optional(),
})

const formInstructionGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const recipeFormSchema = z.object({
  name: z.string().min(1, 'Receptnamn är obligatoriskt'),
  description: z.string().min(1, 'Beskrivning är obligatorisk'),
  author: z.string(),
  url: z.string(),
  recipeYield: z.string(),
  recipeYieldName: z.string(),
  prepTime: z.string(),
  cookTime: z.string(),
  cuisine: z.string(),
  image: z.string().nullable(),
  categories: z.array(z.string()),
  ingredients: z.array(formIngredientSchema),
  ingredientGroups: z.array(formIngredientGroupSchema),
  instructions: z.array(formInstructionSchema),
  instructionGroups: z.array(formInstructionGroupSchema),
})

export type RecipeFormValues = z.infer<typeof recipeFormSchema>

// ============================================================================
// API Response Schemas - Runtime validation for API responses
// ============================================================================

// ApiKey response schema (from get_user_api_keys RPC)
export const apiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  last_used_at: z.string().nullable(),
  date_published: z.string(),
})

export type ApiKeySchema = z.infer<typeof apiKeySchema>

export const apiKeysArraySchema = z.array(apiKeySchema)

// ShoppingList response schema (from get_user_shopping_lists RPC)
export const shoppingListSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_default: z.boolean(),
  item_count: z.number(),
  checked_count: z.number(),
  date_published: z.string(),
  date_modified: z.string(),
  home_id: z.string().nullable(),
  home_name: z.string().nullable(),
})

export type ShoppingListSchema = z.infer<typeof shoppingListSchema>

export const shoppingListsArraySchema = z.array(shoppingListSchema)

// ============================================================================
// JSON-LD Recipe Schema - Runtime validation for recipe import
// ============================================================================

// HowToStep schema
const howToStepSchema = z
  .object({
    '@type': z.literal('HowToStep'),
    text: z.string(),
    name: z.string().optional(),
    url: z.string().optional(),
  })
  .passthrough()

// HowToSection schema
const howToSectionSchema = z
  .object({
    '@type': z.literal('HowToSection'),
    name: z.string().optional(),
    itemListElement: z.array(howToStepSchema).optional(),
  })
  .passthrough()

// Image can be string, array of strings, object with url, or array of objects with url
const jsonLdImageSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.object({ url: z.string() }),
  z.array(z.object({ url: z.string() })),
])

// Author can be string, object with name, or array of objects with name
const jsonLdAuthorSchema = z.union([
  z.string(),
  z.object({ name: z.string() }),
  z.array(z.object({ name: z.string() })),
])

// Instructions can be various formats
const jsonLdInstructionsSchema = z.union([
  z.string(),
  z.array(z.string()),
  howToStepSchema,
  z.array(howToStepSchema),
  z.array(z.union([z.string(), howToStepSchema, howToSectionSchema])),
])

// Main JSON-LD Recipe schema
export const jsonLdRecipeSchema = z
  .object({
    '@context': z.union([z.string(), z.array(z.string())]).optional(),
    '@type': z.literal('Recipe'),
    name: z.string(),
    description: z.string().optional(),
    image: jsonLdImageSchema.optional(),
    author: jsonLdAuthorSchema.optional(),
    prepTime: z.string().optional(),
    cookTime: z.string().optional(),
    totalTime: z.string().optional(),
    recipeYield: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
    recipeCuisine: z.union([z.string(), z.array(z.string())]).optional(),
    recipeIngredient: z.array(z.string()).optional(),
    recipeInstructions: jsonLdInstructionsSchema.optional(),
    datePublished: z.string().optional(),
  })
  .passthrough()

export type JsonLdRecipeSchema = z.infer<typeof jsonLdRecipeSchema>

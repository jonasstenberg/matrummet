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
  recipe_name: z.string().min(1, 'Receptnamn är obligatoriskt').trim(),
  author: z.string().trim().nullable().optional(),
  description: z.string().min(1, 'Beskrivning är obligatorisk').trim(),
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
    .positive('Förberedelsetid måste vara positiv')
    .nullable()
    .optional(),
  cook_time: z
    .number()
    .int('Tillagningstid måste vara ett heltal')
    .positive('Tillagningstid måste vara positiv')
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
  email: z.string().email('Ogiltig e-postadress').trim(),
  password: z.string().min(1, 'Lösenord är obligatoriskt'),
})

export type LoginInputSchema = z.infer<typeof loginInputSchema>

// Signup input schema
export const signupInputSchema = z.object({
  name: z.string().min(1, 'Namn är obligatoriskt').trim(),
  email: z.string().email('Ogiltig e-postadress').trim(),
  password: z
    .string()
    .min(8, 'Lösenordet måste vara minst 8 tecken')
    .regex(/[A-Z]/, 'Lösenordet måste innehålla minst en versal')
    .regex(/[a-z]/, 'Lösenordet måste innehålla minst en gemen')
    .regex(/[0-9]/, 'Lösenordet måste innehålla minst en siffra'),
})

export type SignupInputSchema = z.infer<typeof signupInputSchema>

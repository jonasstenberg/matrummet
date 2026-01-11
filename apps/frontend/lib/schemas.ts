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
export const signupInputSchema = z.object({
  name: z.string().trim().min(1, 'Namn är obligatoriskt'),
  email: z.string().trim().email('Ogiltig e-postadress'),
  password: z
    .string()
    .min(8, 'Lösenordet måste vara minst 8 tecken')
    .regex(/[A-Z]/, 'Lösenordet måste innehålla minst en versal')
    .regex(/[a-z]/, 'Lösenordet måste innehålla minst en gemen')
    .regex(/[0-9]/, 'Lösenordet måste innehålla minst en siffra'),
})

export type SignupInputSchema = z.infer<typeof signupInputSchema>

// Update profile schema
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Namn är obligatoriskt'),
})

export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>

// Change password schema
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Nuvarande lösenord är obligatoriskt'),
  newPassword: z
    .string()
    .min(8, 'Lösenordet måste vara minst 8 tecken')
    .regex(/[A-Z]/, 'Lösenordet måste innehålla minst en versal')
    .regex(/[a-z]/, 'Lösenordet måste innehålla minst en gemen')
    .regex(/[0-9]/, 'Lösenordet måste innehålla minst en siffra'),
})

export type ChangePasswordSchema = z.infer<typeof changePasswordSchema>

// Reset password schema (for forgot password flow)
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Lösenordet måste vara minst 8 tecken')
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

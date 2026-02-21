/**
 * Types and schema for LLM-based ingredient and instruction restructuring
 */
import { z, toJSONSchema } from "zod"

const IngredientItemSchema = z.object({
  name: z.string().describe("Ingredient name"),
  measurement: z.string().describe("Unit of measurement"),
  quantity: z.string().describe("Amount/quantity"),
})

const StructuredIngredientGroupSchema = z.object({
  group_name: z.string().describe("Name of the ingredient group, e.g. 'Lammsteken', 'Potatis', 'Vitlökssmör'"),
  ingredients: z.array(IngredientItemSchema).describe("Ingredients that belong to this group"),
})

export const RestructureZodSchema = z.object({
  groups: z.array(StructuredIngredientGroupSchema).describe("Ingredient groups with their ingredients. Each group should contain logically related ingredients."),
  ungrouped_ingredients: z.array(IngredientItemSchema).describe("Ingredients that don't belong to any specific group"),
})

const StructuredInstructionGroupSchema = z.object({
  group_name: z.string().describe("Name of the instruction group"),
  steps: z.array(z.string().describe("A single instruction step")).describe("Steps belonging to this group"),
})

export const InstructionsZodSchema = z.object({
  groups: z.array(StructuredInstructionGroupSchema).describe("Instruction groups for complex recipes (e.g., 'Förberedelser', 'Tillagning', 'Servering')"),
  ungrouped_steps: z.array(z.string().describe("A single instruction step")).describe("Instruction steps that don't belong to any specific group (for simpler recipes)"),
})

export type StructuredIngredientGroup = z.infer<typeof StructuredIngredientGroupSchema>

export type RestructuredIngredients = z.infer<typeof RestructureZodSchema>

export type StructuredInstructionGroup = z.infer<typeof StructuredInstructionGroupSchema>

export type ImprovedInstructions = z.infer<typeof InstructionsZodSchema>

export const RESTRUCTURE_JSON_SCHEMA = toJSONSchema(RestructureZodSchema)

export const INSTRUCTIONS_JSON_SCHEMA = toJSONSchema(InstructionsZodSchema)

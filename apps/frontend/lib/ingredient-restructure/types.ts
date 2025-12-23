/**
 * Types and schema for LLM-based ingredient and instruction restructuring
 */

export interface StructuredIngredientGroup {
  group_name: string
  ingredients: Array<{
    name: string
    measurement: string
    quantity: string
  }>
}

export interface RestructuredIngredients {
  groups: StructuredIngredientGroup[]
  ungrouped_ingredients: Array<{
    name: string
    measurement: string
    quantity: string
  }>
}

export interface StructuredInstructionGroup {
  group_name: string
  steps: string[]
}

export interface ImprovedInstructions {
  groups: StructuredInstructionGroup[]
  ungrouped_steps: string[]
}

// JSON Schema for Gemini structured output
export const RESTRUCTURE_SCHEMA = {
  type: "object",
  required: ["groups", "ungrouped_ingredients"],
  properties: {
    groups: {
      type: "array",
      description: "Ingredient groups with their ingredients. Each group should contain logically related ingredients.",
      items: {
        type: "object",
        required: ["group_name", "ingredients"],
        properties: {
          group_name: {
            type: "string",
            description: "Name of the ingredient group, e.g. 'Lammsteken', 'Potatis', 'Vitlökssmör'"
          },
          ingredients: {
            type: "array",
            description: "Ingredients that belong to this group",
            items: {
              type: "object",
              required: ["name", "measurement", "quantity"],
              properties: {
                name: {
                  type: "string",
                  description: "Ingredient name"
                },
                measurement: {
                  type: "string",
                  description: "Unit of measurement"
                },
                quantity: {
                  type: "string",
                  description: "Amount/quantity"
                }
              }
            }
          }
        }
      }
    },
    ungrouped_ingredients: {
      type: "array",
      description: "Ingredients that don't belong to any specific group",
      items: {
        type: "object",
        required: ["name", "measurement", "quantity"],
        properties: {
          name: {
            type: "string",
            description: "Ingredient name"
          },
          measurement: {
            type: "string",
            description: "Unit of measurement"
          },
          quantity: {
            type: "string",
            description: "Amount/quantity"
          }
        }
      }
    }
  }
} as const

// JSON Schema for instruction improvement output
export const INSTRUCTIONS_SCHEMA = {
  type: "object",
  required: ["groups", "ungrouped_steps"],
  properties: {
    groups: {
      type: "array",
      description: "Instruction groups for complex recipes (e.g., 'Förberedelser', 'Tillagning', 'Servering')",
      items: {
        type: "object",
        required: ["group_name", "steps"],
        properties: {
          group_name: {
            type: "string",
            description: "Name of the instruction group"
          },
          steps: {
            type: "array",
            description: "Steps belonging to this group",
            items: {
              type: "string",
              description: "A single instruction step"
            }
          }
        }
      }
    },
    ungrouped_steps: {
      type: "array",
      description: "Instruction steps that don't belong to any specific group (for simpler recipes)",
      items: {
        type: "string",
        description: "A single instruction step"
      }
    }
  }
} as const

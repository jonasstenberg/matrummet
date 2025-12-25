export interface ParsedIngredientGroup {
  group_name: string
  ingredients: Array<{ name: string; measurement: string; quantity: string }>
}

export interface ParsedInstructionGroup {
  group_name: string
  instructions: Array<{ step: string }>
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
  ingredient_groups?: ParsedIngredientGroup[]
  instruction_groups?: ParsedInstructionGroup[]
}

// JSON Schema for Gemini structured output
export const RECIPE_SCHEMA = {
  type: "object",
  required: ["recipe_name", "description", "ingredient_groups", "instruction_groups"],
  properties: {
    recipe_name: {
      type: "string",
      description: "Receptets namn"
    },
    description: {
      type: "string",
      description: "Kort beskrivning av rätten"
    },
    author: {
      type: "string",
      description: "Författare/källa om nämnd"
    },
    recipe_yield: {
      type: "string",
      description: "Antal portioner som siffra, t.ex. '4'"
    },
    recipe_yield_name: {
      type: "string",
      description: "Vad portionerna är, t.ex. 'portioner', 'personer', 'bitar'"
    },
    prep_time: {
      type: "number",
      description: "Förberedelsetid i minuter"
    },
    cook_time: {
      type: "number",
      description: "Tillagningstid i minuter"
    },
    cuisine: {
      type: "string",
      description: "Kökstyp om uppenbar, t.ex. 'Italiensk', 'Asiatisk', 'Svensk'"
    },
    categories: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Lista av kategorier"
    },
    ingredient_groups: {
      type: "array",
      description: "Lista av ingrediensgrupper. Varje grupp har ett namn och en lista med ingredienser. Använd en tom sträng som gruppnamn om receptet inte har grupperade ingredienser.",
      items: {
        type: "object",
        required: ["group_name", "ingredients"],
        properties: {
          group_name: {
            type: "string",
            description: "Gruppens namn, t.ex. 'Deg', 'Fyllning', 'Sås'. Använd tom sträng om receptet inte har grupperade ingredienser."
          },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "measurement", "quantity"],
              properties: {
                name: {
                  type: "string",
                  description: "Ingrediensens namn"
                },
                measurement: {
                  type: "string",
                  description: "Måttenhet, t.ex. 'dl', 'msk', 'g'"
                },
                quantity: {
                  type: "string",
                  description: "Mängd, t.ex. '2', '1/2'"
                }
              }
            }
          }
        }
      }
    },
    instruction_groups: {
      type: "array",
      description: "Lista av instruktionsgrupper. Varje grupp har ett namn och en lista med steg. Använd en tom sträng som gruppnamn om receptet inte har grupperade instruktioner.",
      items: {
        type: "object",
        required: ["group_name", "instructions"],
        properties: {
          group_name: {
            type: "string",
            description: "Gruppens namn, t.ex. 'Deg', 'Fyllning', 'Servering'. Använd tom sträng om receptet inte har grupperade instruktioner."
          },
          instructions: {
            type: "array",
            items: {
              type: "object",
              required: ["step"],
              properties: {
                step: {
                  type: "string",
                  description: "Instruktionssteg"
                }
              }
            }
          }
        }
      }
    }
  }
} as const

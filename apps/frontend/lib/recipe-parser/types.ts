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
  ingredients: Array<{ name: string; measurement: string; quantity: string }>
  instructions: Array<{ step: string }>
}

// JSON Schema for Gemini structured output
export const RECIPE_SCHEMA = {
  type: "object",
  required: ["recipe_name", "description", "ingredients", "instructions"],
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
} as const

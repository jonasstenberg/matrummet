import { z, toJSONSchema } from "zod"

const IngredientSchema = z.object({
  name: z.string().describe("Ingrediensens namn"),
  measurement: z.string().describe("Måttenhet, t.ex. 'dl', 'msk', 'g'"),
  quantity: z.string().describe("Mängd, t.ex. '2', '1/2'"),
})

const IngredientGroupSchema = z.object({
  group_name: z.string().describe("Gruppens namn, t.ex. 'Deg', 'Fyllning', 'Sås'. Använd tom sträng om receptet inte har grupperade ingredienser."),
  ingredients: z.array(IngredientSchema),
})

const InstructionSchema = z.object({
  step: z.string().describe("Instruktionssteg"),
})

const InstructionGroupSchema = z.object({
  group_name: z.string().describe("Gruppens namn, t.ex. 'Deg', 'Fyllning', 'Servering'. Använd tom sträng om receptet inte har grupperade instruktioner."),
  instructions: z.array(InstructionSchema),
})

export const RecipeZodSchema = z.object({
  recipe_name: z.string().describe("Receptets namn"),
  description: z.string().describe("Kort beskrivning av rätten"),
  author: z.string().nullable().optional().describe("Författare/källa om nämnd"),
  recipe_yield: z.string().nullable().optional().describe("Antal portioner som siffra, t.ex. '4'"),
  recipe_yield_name: z.string().nullable().optional().describe("Vad portionerna är, t.ex. 'portioner', 'personer', 'bitar'"),
  prep_time: z.number().nullable().optional().describe("Förberedelsetid i minuter"),
  cook_time: z.number().nullable().optional().describe("Tillagningstid i minuter"),
  cuisine: z.string().nullable().optional().describe("Kökstyp om uppenbar, t.ex. 'Italiensk', 'Asiatisk', 'Svensk'"),
  image: z.string().nullable().optional().describe("URL till receptets bild om tillgänglig i källdatan"),
  categories: z.array(z.string()).optional().describe("Lista av kategorier"),
  ingredient_groups: z.array(IngredientGroupSchema).optional().describe("Lista av ingrediensgrupper. Varje grupp har ett namn och en lista med ingredienser. Använd en tom sträng som gruppnamn om receptet inte har grupperade ingredienser."),
  instruction_groups: z.array(InstructionGroupSchema).optional().describe("Lista av instruktionsgrupper. Varje grupp har ett namn och en lista med steg. Använd en tom sträng som gruppnamn om receptet inte har grupperade instruktioner."),
})

export type ParsedRecipe = z.infer<typeof RecipeZodSchema>

export type ParsedIngredientGroup = z.infer<typeof IngredientGroupSchema>

export type ParsedInstructionGroup = z.infer<typeof InstructionGroupSchema>

export const RECIPE_JSON_SCHEMA = toJSONSchema(RecipeZodSchema)

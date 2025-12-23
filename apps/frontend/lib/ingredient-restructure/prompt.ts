import type { Ingredient, IngredientGroup, Instruction } from "@/lib/types"
import type { RestructuredIngredients } from "./types"

/**
 * Builds a system instruction for Gemini to restructure messy ingredients.
 */
export function buildRestructureSystemInstruction(): string {
  return `Du är en expert på svenska recept och ingrediensstrukturering.

Din uppgift är att organisera ingredienser under rätt grupper baserat på hur de används i receptet.

BAKGRUND:
Ingredienserna kommer från ett äldre system där grupprubriker (markerade med #) var blandade med ingredienserna.
Problemet är att grupprubrikerna ofta är i fel ordning i förhållande till ingredienserna de tillhör.

DINA INSTRUKTIONER:
1. Analysera receptnamnet och ingredienserna för att förstå vad receptet handlar om
2. Om det finns gruppnamn (som kommer från det gamla systemet), använd dem som utgångspunkt
3. Placera varje ingrediens under den grupp den logiskt tillhör baserat på:
   - Ingrediensens namn och användningsområde
   - Receptets kontext (t.ex. om receptet heter "Lammsteken med potatispuré", ska potatis/mjölk/smör hamna under "Potatispuré")
   - Vanliga svenska receptmönster

4. Om en ingrediens inte passar in i någon grupp, lägg den i "ungrouped_ingredients"
5. Behåll grupporordningen så att den följer en logisk tillagningsordning
6. Ändra INTE ingrediensernas namn, mängd eller måttenhet - behåll dem exakt som de är

VANLIGA MÖNSTER:
- "Potatispuré" eller "Potatis" → potatis, mjölk, smör
- "Sås" → buljong, grädde, vin, mjöl, smör för redning
- "Marinad" → olja, citron/vinäger, kryddor
- "Topping" eller "Till servering" → garnering, örter
- "Deg" → mjöl, jäst, vatten, salt, socker
- Huvudingrediensen (kött, fisk) → den råvaran + direkta kryddor

EXEMPEL:
Om receptet heter "Lammstekmed vitlökssmör och potatispuré" och ingredienserna är:
- Lammstek, Potatis, Smör, Vitlök, Persilja, Salt, Peppar, Mjölk, Timjan, Rosmarin

Då bör strukturen bli:
- Lammsteken: Lammstek, Salt, Peppar, Timjan, Rosmarin
- Vitlökssmör: Smör, Vitlök, Persilja
- Potatispuré: Potatis, Mjölk, Smör`
}

/**
 * Formats ingredients data for the LLM prompt.
 */
export function formatIngredientsForPrompt(
  recipeName: string,
  description: string | null,
  ingredients: Ingredient[],
  groups: IngredientGroup[],
  instructions: Instruction[]
): string {
  const lines: string[] = []

  lines.push(`RECEPTNAMN: ${recipeName}`)

  if (description && description !== "-") {
    lines.push(`BESKRIVNING: ${description}`)
  }
  lines.push("")

  // Extract group names from both proper groups and # prefixed ingredients
  const allGroupNames: string[] = []

  if (groups.length > 0) {
    allGroupNames.push(...groups.map(g => g.name))
  }

  // Also extract # prefixed ingredients as group names
  const legacyGroups = ingredients
    .filter(i => i.name.startsWith("#"))
    .map(i => i.name.substring(1).trim())
    .filter(name => name && !allGroupNames.includes(name))

  allGroupNames.push(...legacyGroups)

  if (allGroupNames.length > 0) {
    lines.push("BEFINTLIGA GRUPPER (från gamla systemet, ordningen kan vara fel):")
    allGroupNames.forEach((name, i) => {
      lines.push(`  ${i + 1}. ${name}`)
    })
    lines.push("")
  }

  lines.push("INGREDIENSER (i nuvarande ordning, # markerar gamla grupprubriker):")

  // Create a map of group_id to group name for reference
  const groupMap = new Map(groups.map(g => [g.id, g.name]))

  ingredients.forEach(ing => {
    // Check if this is a legacy group header
    if (ing.name.startsWith("#")) {
      lines.push(`  [GRUPPRUBRIK] ${ing.name.substring(1).trim()}`)
    } else {
      const groupName = ing.group_id ? groupMap.get(ing.group_id) || "Okänd grupp" : "Ingen grupp"
      const qty = ing.quantity || ""
      const meas = ing.measurement || ""
      const display = [qty, meas, ing.name].filter(Boolean).join(" ").trim()
      lines.push(`  - ${display} [nuvarande grupp: ${groupName}]`)
    }
  })

  // Add instructions for context
  if (instructions && instructions.length > 0) {
    lines.push("")
    lines.push("INSTRUKTIONER (för kontext om hur ingredienserna används):")
    instructions.forEach((instr, i) => {
      lines.push(`  ${i + 1}. ${instr.step}`)
    })
  }

  return lines.join("\n")
}

/**
 * Validates and converts the LLM response to a structured format.
 */
export function validateRestructuredIngredients(data: unknown): RestructuredIngredients {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid response: Expected JSON object")
  }

  const result = data as Record<string, unknown>

  if (!Array.isArray(result.groups)) {
    throw new Error("Invalid response: groups must be an array")
  }

  if (!Array.isArray(result.ungrouped_ingredients)) {
    throw new Error("Invalid response: ungrouped_ingredients must be an array")
  }

  // Validate groups
  for (const group of result.groups) {
    if (!group || typeof group !== "object") {
      throw new Error("Invalid group: must be an object")
    }
    const g = group as Record<string, unknown>
    if (!g.group_name || typeof g.group_name !== "string") {
      throw new Error("Invalid group: group_name is required")
    }
    if (!Array.isArray(g.ingredients)) {
      throw new Error(`Invalid group "${g.group_name}": ingredients must be an array`)
    }
    for (const ing of g.ingredients) {
      validateIngredient(ing, `group "${g.group_name}"`)
    }
  }

  // Validate ungrouped ingredients
  for (const ing of result.ungrouped_ingredients) {
    validateIngredient(ing, "ungrouped_ingredients")
  }

  return result as unknown as RestructuredIngredients
}

function validateIngredient(ing: unknown, context: string): void {
  if (!ing || typeof ing !== "object") {
    throw new Error(`Invalid ingredient in ${context}: must be an object`)
  }
  const i = ing as Record<string, unknown>
  if (typeof i.name !== "string") {
    throw new Error(`Invalid ingredient in ${context}: name must be a string`)
  }
  if (typeof i.measurement !== "string") {
    throw new Error(`Invalid ingredient "${i.name}" in ${context}: measurement must be a string`)
  }
  if (typeof i.quantity !== "string") {
    throw new Error(`Invalid ingredient "${i.name}" in ${context}: quantity must be a string`)
  }
}

/**
 * Converts restructured ingredients to the format used by update_recipe.
 * Returns an array that can be passed directly to p_ingredients.
 */
export function convertToUpdateFormat(
  restructured: RestructuredIngredients
): Array<{ group: string } | { name: string; measurement: string; quantity: string }> {
  const result: Array<{ group: string } | { name: string; measurement: string; quantity: string }> = []

  // First, add grouped ingredients
  for (const group of restructured.groups) {
    // Add group marker
    result.push({ group: group.group_name })

    // Add ingredients in this group
    for (const ing of group.ingredients) {
      result.push({
        name: ing.name,
        measurement: ing.measurement,
        quantity: ing.quantity
      })
    }
  }

  // Then add ungrouped ingredients (they go at the beginning, before any groups)
  // We need to prepend them, so we'll return ungrouped first
  const ungrouped = restructured.ungrouped_ingredients.map(ing => ({
    name: ing.name,
    measurement: ing.measurement,
    quantity: ing.quantity
  }))

  // Return ungrouped first, then grouped
  return [...ungrouped, ...result]
}

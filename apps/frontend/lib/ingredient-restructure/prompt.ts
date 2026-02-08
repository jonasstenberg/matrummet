import type { Ingredient, IngredientGroup, Instruction } from "@/lib/types"
import type { RestructuredIngredients, ImprovedInstructions } from "./types"

/**
 * Builds a system instruction for the AI to restructure messy ingredients.
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

/**
 * Builds a system instruction for the AI to improve/create recipe instructions.
 */
export function buildInstructionsSystemInstruction(): string {
  return `Du är en expert på svenska recept och matlagning.

Din uppgift är att skapa eller förbättra tillagningsinstruktioner för recept.

DINA INSTRUKTIONER:
1. Analysera receptnamnet, ingredienserna och eventuella befintliga instruktioner
2. Skapa tydliga, steg-för-steg instruktioner som är lätta att följa
3. Använd korta, koncisa meningar i imperativ form (t.ex. "Skär löken i tärningar")
4. Inkludera relevanta tillagningstemperaturer och tider där det är lämpligt
5. Se till att alla ingredienser används i instruktionerna
6. Följ en logisk ordning: förberedelser → tillagning → servering

RIKTLINJER FÖR BRA INSTRUKTIONER:
- Börja med förberedelser (skära, hacka, marinera)
- Fortsätt med tillagning i rätt ordning
- Avsluta med servering eller garnering om relevant
- Ange specifika tider (t.ex. "stek i 5-7 minuter")
- Ange temperaturer där det behövs (t.ex. "värm ugnen till 200°C")
- Använd svenska matlagningstermer

GRUPPERING:
- För enkla recept: lägg alla steg i "ungrouped_steps"
- För komplexa recept: använd grupper som "Förberedelser", "Sås", "Tillagning", "Servering"
- Matcha grupper med ingrediensgrupper om möjligt (t.ex. om ingredienserna har "Potatispuré" som grupp)

EXEMPEL PÅ BRA INSTRUKTIONER:
- "Värm ugnen till 200°C."
- "Skär potatisen i 2 cm stora bitar."
- "Stek löken i smör på medelvärme i 5 minuter tills den mjuknat."
- "Rör ner grädden och låt såsen sjuda i 10 minuter."
- "Servera med fräsch persilja på toppen."`
}

/**
 * Formats recipe data for instruction improvement prompt.
 */
export function formatRecipeForInstructionsPrompt(
  recipeName: string,
  description: string | null,
  ingredients: Ingredient[],
  ingredientGroups: IngredientGroup[],
  currentInstructions: Instruction[]
): string {
  const lines: string[] = []

  lines.push(`RECEPTNAMN: ${recipeName}`)

  if (description && description !== "-") {
    lines.push(`BESKRIVNING: ${description}`)
  }
  lines.push("")

  // Add ingredients with their groups
  lines.push("INGREDIENSER:")

  // Group ingredients by group_id for display
  const grouped = new Map<string | null, Ingredient[]>()
  for (const ing of ingredients) {
    if (ing.name.startsWith("#")) continue // Skip legacy group headers
    const key = ing.group_id || null
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(ing)
  }

  // Show ungrouped first
  const ungrouped = grouped.get(null) || []
  if (ungrouped.length > 0) {
    for (const ing of ungrouped) {
      const display = [ing.quantity, ing.measurement, ing.name].filter(Boolean).join(" ")
      lines.push(`  - ${display}`)
    }
  }

  // Show grouped ingredients
  for (const group of ingredientGroups.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))) {
    if (!group.id) continue
    const ings = grouped.get(group.id) || []
    if (ings.length > 0) {
      lines.push(`  [${group.name}]`)
      for (const ing of ings) {
        const display = [ing.quantity, ing.measurement, ing.name].filter(Boolean).join(" ")
        lines.push(`    - ${display}`)
      }
    }
  }
  lines.push("")

  // Add current instructions if any
  if (currentInstructions.length > 0) {
    lines.push("BEFINTLIGA INSTRUKTIONER (kan vara ofullständiga eller dåliga):")
    currentInstructions.forEach((instr, i) => {
      lines.push(`  ${i + 1}. ${instr.step}`)
    })
  } else {
    lines.push("BEFINTLIGA INSTRUKTIONER: Inga (skapa nya från grunden)")
  }

  return lines.join("\n")
}

/**
 * Validates and converts the LLM response for instructions to a structured format.
 */
export function validateImprovedInstructions(data: unknown): ImprovedInstructions {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid response: Expected JSON object")
  }

  const result = data as Record<string, unknown>

  if (!Array.isArray(result.groups)) {
    throw new Error("Invalid response: groups must be an array")
  }

  if (!Array.isArray(result.ungrouped_steps)) {
    throw new Error("Invalid response: ungrouped_steps must be an array")
  }

  // Validate groups
  for (const group of result.groups) {
    if (!group || typeof group !== "object") {
      throw new Error("Invalid instruction group: must be an object")
    }
    const g = group as Record<string, unknown>
    if (!g.group_name || typeof g.group_name !== "string") {
      throw new Error("Invalid instruction group: group_name is required")
    }
    if (!Array.isArray(g.steps)) {
      throw new Error(`Invalid instruction group "${g.group_name}": steps must be an array`)
    }
    for (const step of g.steps) {
      if (typeof step !== "string") {
        throw new Error(`Invalid step in group "${g.group_name}": must be a string`)
      }
    }
  }

  // Validate ungrouped steps
  for (const step of result.ungrouped_steps) {
    if (typeof step !== "string") {
      throw new Error("Invalid ungrouped step: must be a string")
    }
  }

  return result as unknown as ImprovedInstructions
}

/**
 * Converts improved instructions to the format used by update_recipe.
 * Returns an array that can be passed directly to p_instructions.
 */
export function convertInstructionsToUpdateFormat(
  improved: ImprovedInstructions
): Array<{ group: string } | { step: string }> {
  const result: Array<{ group: string } | { step: string }> = []

  // First, add ungrouped steps
  for (const step of improved.ungrouped_steps) {
    result.push({ step })
  }

  // Then add grouped steps
  for (const group of improved.groups) {
    result.push({ group: group.group_name })
    for (const step of group.steps) {
      result.push({ step })
    }
  }

  return result
}

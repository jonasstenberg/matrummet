interface CompactRecipe {
  id: string
  name: string
  categories: string[]
  prep_time: number | null
  cook_time: number | null
  recipe_yield: number | null
}

const DAY_NAMES_SV = ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"]

export function buildMealPlanPrompt(
  recipes: CompactRecipe[],
  preferences: { categories: string[]; meal_types: string[]; servings: number },
  pantryItems?: string[],
  maxSuggestions: number = 3,
  days?: number[],
): string {
  const recipeList = recipes
    .map((r) => {
      const totalTime = (r.prep_time || 0) + (r.cook_time || 0)
      const cats = r.categories.length > 0 ? r.categories.join(", ") : ""
      const timeStr = totalTime > 0 ? `${totalTime}min` : ""
      const yieldStr = r.recipe_yield ? `${r.recipe_yield}p` : ""
      const meta = [cats, timeStr, yieldStr].filter(Boolean).join(" ")
      return `[${r.id}] ${r.name}${meta ? ` (${meta})` : ""}`
    })
    .join("\n")

  const categoryStr = preferences.categories.length > 0
    ? `Kategoripreferenser: ${preferences.categories.join(", ")}. Prioritera recept och förslag som matchar dessa kategorier.`
    : "Inga särskilda kategoripreferenser."

  const mealTypeStr = `Måltidstyper att planera: ${preferences.meal_types.join(", ")}.`
  const servingsStr = `Antal portioner per måltid: ${preferences.servings}.`

  const pantryStr = pantryItems && pantryItems.length > 0
    ? `\nAnvändaren har följande i skafferiet: ${pantryItems.join(", ")}. Prioritera recept som använder dessa ingredienser.`
    : ""

  const selectedDays = days && days.length > 0 && days.length < 7
    ? days
    : [1, 2, 3, 4, 5, 6, 7]
  const dayNameList = selectedDays.map((d) => DAY_NAMES_SV[d - 1]).join(", ")
  const allDays = selectedDays.length === 7
  const dayScope = allDays ? "måndag–söndag" : dayNameList
  const dayRule = allDays
    ? ""
    : `\n- Skapa BARA entries för dessa dagar: ${dayNameList}. Inkludera INGA andra dagar.`

  const suggestedRecipeRule = `\n- För varje nytt förslag (recipe_id = null), inkludera "suggested_recipe" med fullständiga ingredienser (ingredient_groups), instruktioner (instruction_groups), prep_time, cook_time, recipe_yield och kategorier. Skriv som ett komplett recept.
- Nya receptförslag ska hålla restaurangkvalitet. Ta inspiration från klassiska, uppskattade rätter och ge dem en modern touch. Inkludera professionella tekniker som att marinera, reducera, rosta — inte bara "stek och servera".`

  const totalEntries = selectedDays.length * preferences.meal_types.length

  let recipeSourceRule: string
  if (maxSuggestions === 0) {
    recipeSourceRule = "- Välj ENBART recept från listan nedan (ange recipe_id för varje entry). Inga nya förslag — suggested_name och suggested_description ska alltid vara null."
  } else if (maxSuggestions >= totalEntries) {
    recipeSourceRule = `- ALLA ${totalEntries} entries ska vara nya receptförslag (recipe_id = null, fyll i suggested_name och suggested_description). Använd INGA befintliga recept från listan.${suggestedRecipeRule}`
  } else {
    recipeSourceRule = `- Du ska skapa exakt ${totalEntries} entries totalt: exakt ${maxSuggestions} ska vara nya receptförslag (recipe_id = null) och exakt ${totalEntries - maxSuggestions} ska vara befintliga recept från listan (med recipe_id).${suggestedRecipeRule}`
  }

  return `Du är en erfaren kock och matkreatör med djup kunskap om internationella kök och svenska mattraditioner. Du tar inspiration från välkända, högt betygsatta recept och anpassar dem med professionella tekniker och smakkombinationer. Skapa en veckoplan (${dayScope}) utifrån användarens receptsamling.

REGLER:
${recipeSourceRule}${dayRule}
- ${categoryStr}
- ${mealTypeStr}
- ${servingsStr}
- Variera kökstyp och ingredienser under veckan — undvik upprepning.
- Tänk på svenska årstider (februari = vintermat, rotfrukter, grytor, ugnsbakade rätter).
- Enklare rätter på vardagar, mer ambitiösa på helgen.${pantryStr}

ANVÄNDARENS RECEPT:
${recipeList}

Svara med en JSON-struktur. Varje entry ska ha:
- day_of_week: 1=måndag..7=söndag
- meal_type: en av ${preferences.meal_types.map((t) => `"${t}"`).join(", ")}
- recipe_id: UUID från listan ovan${maxSuggestions === 0 ? " (obligatoriskt)" : ", eller null för nytt förslag"}
- suggested_name: ${maxSuggestions === 0 ? "alltid null" : "namn på nytt förslag (null om recipe_id anges)"}
- suggested_description: ${maxSuggestions === 0 ? "alltid null" : "kort beskrivning av nytt förslag (null om recipe_id anges)"}
- suggested_recipe: ${maxSuggestions === 0 ? "alltid null" : "fullständigt recept för förslag (null om recipe_id anges) med recipe_name, description, recipe_yield, prep_time, cook_time, categories, ingredient_groups (array av {group_name, ingredients: [{name, measurement, quantity}]}), instruction_groups (array av {group_name, instructions: [{step}]})"}
- reason: kort motivering (1 mening)

Inkludera också en "summary" med 1–2 meningar om veckans tema.`
}

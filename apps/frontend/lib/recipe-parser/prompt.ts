import type { ParsedRecipe } from "./types";

/**
 * Builds a prompt for the LLM to parse a free-text recipe into structured JSON.
 * Designed for Swedish recipes with Swedish measurements and categories.
 */
export function buildRecipeParsingPrompt(text: string): string {
  return `Du är en expert på att läsa recept och strukturera dem i JSON-format. Din uppgift är att analysera recepttexten nedan och returnera ENDAST giltig JSON utan någon extra text.

VIKTIGT: Svara ENDAST med JSON. Ingen förklarande text före eller efter. Ingen markdown. Bara ren JSON.

JSON-SCHEMA:
{
  "recipe_name": "string (required - receptets namn)",
  "description": "string (required - kort beskrivning av rätten)",
  "author": "string | null (författare/källa om nämnd, annars null)",
  "recipe_yield": "string | null (antal portioner som siffra, t.ex. '4')",
  "recipe_yield_name": "string | null (vad portionerna är, t.ex. 'portioner', 'personer', 'bitar')",
  "prep_time": "number | null (förberedelsetid i minuter)",
  "cook_time": "number | null (tillagningstid i minuter)",
  "cuisine": "string | null (kökstyp om uppenbar, t.ex. 'Italiensk', 'Asiatisk', 'Svensk')",
  "categories": ["string"] (lista av kategorier, se riktlinjer nedan),
  "ingredients": [
    {"name": "string", "measurement": "string", "quantity": "string"}
  ],
  "instructions": [
    {"step": "string"}
  ]
}

KATEGORIRIKTLINJER (välj relevanta):
- Huvudrätt (för main courses)
- Förrätt (för appetizers)
- Efterrätt (för desserts)
- Vegetariskt (om helt vegetarisk)
- Veganskt (om helt vegansk)
- Bakning (för bröd, kakor, tårtor)
- Soppa (för soppor)
- Sallad (för sallader)
- Fisk & skaldjur (om fiskreceptet)
- Kyckling (om kycklingrätter)
- Kött (för kötträtter som inte är kyckling)
- Pasta (för pastarätter)
- Grytor (för grytor och casseroles)
- Snabbt & enkelt (om receptet tar <30 min total tid)
- Helg (för mer avancerade/tidskrävande recept)

MÅTTENHETER (Swedish measurements):
- dl = deciliter
- msk = matsked
- tsk = tesked
- krm = kryddmått
- g = gram
- kg = kilogram
- ml = milliliter
- l = liter
- st = styck/stycken
- klyfta/klyftor (för vitlök)
- påse/burk/förp = förpackning

EXEMPEL PÅ INGREDIENSER:
{"name": "olivolja", "measurement": "msk", "quantity": "2"}
{"name": "mjöl", "measurement": "dl", "quantity": "3"}
{"name": "köttfärs", "measurement": "g", "quantity": "500"}
{"name": "lök", "measurement": "st", "quantity": "1"}
{"name": "vitlök", "measurement": "klyfta", "quantity": "2"}

TIDSKONVERTERING:
- Konvertera alla tider till minuter
- "1 timme" = 60
- "1,5 timme" eller "1 1/2 timme" = 90
- "30 minuter" = 30

INSTRUKTIONER:
- Dela upp i tydliga steg
- Varje steg ska vara en separat instruktion
- Numrera inte stegen (det görs automatiskt)
- Behåll instruktionerna koncisa men kompletta

RECEPTTEXT:
${text}

Returnera ENDAST JSON enligt schemat ovan.`;
}

/**
 * Validates and normalizes the LLM's JSON output into a ParsedRecipe object.
 * Throws an error if required fields are missing.
 */
export function validateParsedRecipe(data: unknown): ParsedRecipe {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid response: Expected JSON object");
  }

  const recipe = data as Record<string, unknown>;

  // Validate required fields
  if (!recipe.recipe_name || typeof recipe.recipe_name !== "string") {
    throw new Error("Obligatoriskt fält saknas: recipe_name");
  }

  if (!recipe.description || typeof recipe.description !== "string") {
    throw new Error("Obligatoriskt fält saknas: description");
  }

  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    throw new Error(
      "Obligatoriskt fält saknas: ingredients (måste vara en icke-tom lista)"
    );
  }

  if (!Array.isArray(recipe.instructions) || recipe.instructions.length === 0) {
    throw new Error(
      "Obligatoriskt fält saknas: instructions (måste vara en icke-tom lista)"
    );
  }

  // Validate ingredients structure
  for (const ingredient of recipe.ingredients) {
    if (!ingredient || typeof ingredient !== "object") {
      throw new Error("Ogiltig ingrediens: måste vara ett objekt");
    }
    const ing = ingredient as Record<string, unknown>;
    if (!ing.name || typeof ing.name !== "string") {
      throw new Error(
        "Ogiltig ingrediens: name saknas eller är inte en sträng"
      );
    }
    if (!ing.measurement || typeof ing.measurement !== "string") {
      throw new Error(
        `Ogiltig ingrediens "${ing.name}": measurement saknas eller är inte en sträng`
      );
    }
    if (!ing.quantity || typeof ing.quantity !== "string") {
      throw new Error(
        `Ogiltig ingrediens "${ing.name}": quantity saknas eller är inte en sträng`
      );
    }
  }

  // Validate instructions structure
  for (const instruction of recipe.instructions) {
    if (!instruction || typeof instruction !== "object") {
      throw new Error("Ogiltig instruktion: måste vara ett objekt");
    }
    const inst = instruction as Record<string, unknown>;
    if (!inst.step || typeof inst.step !== "string") {
      throw new Error(
        "Ogiltig instruktion: step saknas eller är inte en sträng"
      );
    }
  }

  // Build validated recipe with defaults for optional fields
  const parsedRecipe: ParsedRecipe = {
    recipe_name: recipe.recipe_name,
    description: recipe.description,
    author: typeof recipe.author === "string" ? recipe.author : null,
    recipe_yield:
      typeof recipe.recipe_yield === "string" ? recipe.recipe_yield : null,
    recipe_yield_name:
      typeof recipe.recipe_yield_name === "string"
        ? recipe.recipe_yield_name
        : null,
    prep_time: typeof recipe.prep_time === "number" ? recipe.prep_time : null,
    cook_time: typeof recipe.cook_time === "number" ? recipe.cook_time : null,
    cuisine: typeof recipe.cuisine === "string" ? recipe.cuisine : null,
    categories: Array.isArray(recipe.categories)
      ? recipe.categories.filter((c): c is string => typeof c === "string")
      : [],
    ingredients: recipe.ingredients as Array<{
      name: string;
      measurement: string;
      quantity: string;
    }>,
    instructions: recipe.instructions as Array<{
      step: string;
    }>,
  };

  return parsedRecipe;
}

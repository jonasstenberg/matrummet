import type { ParsedRecipe } from "./types";

/**
 * Builds a system instruction for Gemini with dynamic categories.
 * @param categories - Available categories from the database
 * @param isImageInput - Whether the input includes an image
 */
export function buildSystemInstruction(
  categories?: string[],
  isImageInput?: boolean
): string {
  const categoryList =
    categories && categories.length > 0
      ? categories.map((c) => `- ${c}`).join("\n")
      : `- Huvudrätt
- Förrätt
- Efterrätt
- Vegetariskt
- Veganskt
- Bakning
- Soppa
- Sallad
- Fisk & skaldjur
- Kyckling
- Kött
- Pasta
- Grytor
- Snabbt & enkelt
- Helg`;

  const imageInstructions = isImageInput
    ? `
BILDANALYS:
- Analysera bilden noggrant för att identifiera receptet
- Extrahera receptnamn, ingredienser, mängder och instruktioner från bilden
- Om bilden visar en kokbok eller tidningsartikel, läs texten i bilden
- Om bilden visar en maträtt utan recept, identifiera rätten och skapa ett passande recept
- Om det finns handskriven text, gör ditt bästa för att tolka den
- Kombinera information från bilden med eventuell extra text som anges`
    : "";

  return `Du är en svensk receptexpert. Din uppgift är att:

1. Om du får en komplett recepttext eller bild: Extrahera och strukturera informationen
2. Om du bara får ett receptnamn eller kort beskrivning: Skapa ett komplett, autentiskt svenskt recept

Oavsett input, returnera ALLTID ett komplett recept med ingredienser och instruktioner. Om information saknas, skapa rimliga värden baserat på traditionella svenska recept.
${imageInstructions}

TILLGÄNGLIGA KATEGORIER (välj endast från dessa):
${categoryList}

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

VIKTIGT:
- Returnera ALLTID minst 3 ingredienser
- Returnera ALLTID minst 2 instruktionssteg
- Om du bara får ett receptnamn (t.ex. "pannkakor"), skapa ett komplett traditionellt svenskt recept
- Skriv en beskrivning som förklarar rätten på 1-2 meningar`;
}

/**
 * Validates and normalizes the Gemini's structured output into a ParsedRecipe object.
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

import type { ParsedRecipe } from "./types";

/**
 * Builds a system instruction for the AI with dynamic categories.
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

  return `Du är en svensk receptexpert. Din uppgift är att extrahera och strukturera receptinformation från text eller bilder.

VIKTIGASTE REGELN: Du ska ENDAST extrahera recept som faktiskt finns i den givna texten eller bilden. Hitta på ALDRIG ett recept. Om texten innehåller ett recept om "bouillabaisse", extrahera det receptet - inte "köttbullar" eller "pannkakor".

Om texten är en webbsida med blandad text (rubriker, kommentarer, etc.), leta efter:
- Receptnamnet (ofta en rubrik)
- Ingredienslista (mängder och ingredienser)
- Instruktioner/tillagning (steg-för-steg)

UNDANTAG: Om användaren BARA ger ett kort receptnamn (1-3 ord utan ingredienser eller instruktioner), skapa då ett traditionellt svenskt recept.
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

GRUPPER FÖR INGREDIENSER OCH INSTRUKTIONER:
- Många recept har grupperade ingredienser och instruktioner (t.ex. "Deg", "Fyllning", "Sås")
- Om receptet har tydliga grupper, använd group_name för att namnge dem
- Om receptet INTE har grupper, lägg alla ingredienser/instruktioner i EN grupp med tom sträng ("") som group_name
- Var uppmärksam på rubriker som indikerar grupper, t.ex:
  - "Till degen:", "Fyllning:", "Sås:", "Topping:", "Garnering:"
  - "Gör så här (deg):", "Gör fyllningen:", etc.
- Behåll grupperingen från originalreceptet om den finns

INGREDIENSNAMN - KRITISKT:
Extrahera ENDAST det rena livsmedelsnamnet. Flytta ALL tillagningsinfo till instruktionerna.
- "lime, skal och saft" → Ingrediens: "Lime", Instruktion: "Riv skalet och pressa saften."
- "potatis, kokt och mosad" → Ingrediens: "Potatis", Instruktion: "Koka och mosa potatisen."
- "lök, finhackad och brynt" → Ingrediens: "Lök", Instruktion: "Hacka löken fint och bryn."

VIKTIGT: Varje detalj i ingrediensbeskrivningen MÅSTE finnas i instruktionen - missa inget!

BILD-URL:
- Om källdatan innehåller en bild-URL (t.ex. i JSON-LD "image"-fältet), inkludera den i "image"-fältet
- Extrahera den faktiska URL:en - om det är ett objekt med "url"-fält, använd det värdet
- Om det är en array, använd första elementet
- Returnera endast giltiga http/https URL:er

VIKTIGT:
- Returnera ALLTID minst 3 ingredienser totalt
- Returnera ALLTID minst 2 instruktionssteg totalt
- Om texten innehåller ett recept: EXTRAHERA det receptet, hitta inte på ett annat
- Om du bara får ett kort receptnamn utan ingredienser/instruktioner (t.ex. bara "pannkakor"): skapa ett komplett traditionellt svenskt recept
- Skriv en beskrivning som förklarar rätten på 1-2 meningar`;
}

/**
 * Validates and normalizes the AI's structured output into a ParsedRecipe object.
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

  if (
    !Array.isArray(recipe.ingredient_groups) ||
    recipe.ingredient_groups.length === 0
  ) {
    throw new Error(
      "Obligatoriskt fält saknas: ingredient_groups (måste vara en icke-tom lista)"
    );
  }

  if (
    !Array.isArray(recipe.instruction_groups) ||
    recipe.instruction_groups.length === 0
  ) {
    throw new Error(
      "Obligatoriskt fält saknas: instruction_groups (måste vara en icke-tom lista)"
    );
  }

  // Validate ingredient groups structure
  let totalIngredients = 0;
  const validatedIngredientGroups: Array<{
    group_name: string;
    ingredients: Array<{ name: string; measurement: string; quantity: string }>;
  }> = [];

  for (const group of recipe.ingredient_groups) {
    if (!group || typeof group !== "object") {
      throw new Error("Ogiltig ingrediensgrupp: måste vara ett objekt");
    }
    const g = group as Record<string, unknown>;
    if (typeof g.group_name !== "string") {
      throw new Error(
        "Ogiltig ingrediensgrupp: group_name saknas eller är inte en sträng"
      );
    }
    if (!Array.isArray(g.ingredients)) {
      throw new Error(
        `Ogiltig ingrediensgrupp "${g.group_name}": ingredients måste vara en lista`
      );
    }

    const validatedIngredients: Array<{
      name: string;
      measurement: string;
      quantity: string;
    }> = [];
    for (const ingredient of g.ingredients) {
      if (!ingredient || typeof ingredient !== "object") {
        throw new Error("Ogiltig ingrediens: måste vara ett objekt");
      }
      const ing = ingredient as Record<string, unknown>;
      if (!ing.name || typeof ing.name !== "string") {
        throw new Error(
          "Ogiltig ingrediens: name saknas eller är inte en sträng"
        );
      }
      if (typeof ing.measurement !== "string") {
        throw new Error(
          `Ogiltig ingrediens "${ing.name}": measurement saknas eller är inte en sträng`
        );
      }
      if (typeof ing.quantity !== "string") {
        throw new Error(
          `Ogiltig ingrediens "${ing.name}": quantity saknas eller är inte en sträng`
        );
      }
      validatedIngredients.push({
        name: ing.name,
        measurement: ing.measurement,
        quantity: ing.quantity,
      });
      totalIngredients++;
    }

    validatedIngredientGroups.push({
      group_name: g.group_name,
      ingredients: validatedIngredients,
    });
  }

  if (totalIngredients === 0) {
    throw new Error("Receptet måste ha minst en ingrediens");
  }

  // Validate instruction groups structure
  let totalInstructions = 0;
  const validatedInstructionGroups: Array<{
    group_name: string;
    instructions: Array<{ step: string }>;
  }> = [];

  for (const group of recipe.instruction_groups) {
    if (!group || typeof group !== "object") {
      throw new Error("Ogiltig instruktionsgrupp: måste vara ett objekt");
    }
    const g = group as Record<string, unknown>;
    if (typeof g.group_name !== "string") {
      throw new Error(
        "Ogiltig instruktionsgrupp: group_name saknas eller är inte en sträng"
      );
    }
    if (!Array.isArray(g.instructions)) {
      throw new Error(
        `Ogiltig instruktionsgrupp "${g.group_name}": instructions måste vara en lista`
      );
    }

    const validatedInstructions: Array<{ step: string }> = [];
    for (const instruction of g.instructions) {
      if (!instruction || typeof instruction !== "object") {
        throw new Error("Ogiltig instruktion: måste vara ett objekt");
      }
      const inst = instruction as Record<string, unknown>;
      if (!inst.step || typeof inst.step !== "string") {
        throw new Error(
          "Ogiltig instruktion: step saknas eller är inte en sträng"
        );
      }
      validatedInstructions.push({ step: inst.step });
      totalInstructions++;
    }

    validatedInstructionGroups.push({
      group_name: g.group_name,
      instructions: validatedInstructions,
    });
  }

  if (totalInstructions === 0) {
    throw new Error("Receptet måste ha minst en instruktion");
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
    image: typeof recipe.image === "string" && (recipe.image.startsWith("http") || recipe.image.startsWith("//"))
      ? recipe.image.startsWith("//") ? `https:${recipe.image}` : recipe.image
      : null,
    categories: Array.isArray(recipe.categories)
      ? recipe.categories.filter((c): c is string => typeof c === "string")
      : [],
    ingredient_groups: validatedIngredientGroups,
    instruction_groups: validatedInstructionGroups,
  };

  return parsedRecipe;
}

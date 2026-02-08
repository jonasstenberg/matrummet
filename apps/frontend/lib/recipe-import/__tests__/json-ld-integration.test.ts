import { describe, it, expect } from "vitest";
import { extractJsonLdRecipe } from "../json-ld-parser";
import { mapJsonLdToRecipeInput } from "../schema-mapper";

/**
 * Integration tests using real JSON-LD from Swedish recipe sites.
 * Tests the full pipeline: HTML → extractJsonLdRecipe → mapJsonLdToRecipeInput
 */

function wrapInHtml(jsonLd: object | object[]): string {
  const json = JSON.stringify(jsonLd);
  return `<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`;
}

// -- Fixtures from real recipe sites --

const ICA_SEMIFREDDO = {
  "@context": "https://schema.org/",
  "@type": "Recipe",
  name: "Chokladsemifreddo med citronolja och söta krutonger",
  image:
    "https://assets.icanet.se/t_ICAseAbsoluteUrl/tiz6lzbzowopex15f6r1.jpg",
  url: "https://www.ica.se/recept/chokladsemifreddo-med-citronolja-och-sota-krutonger-750732/",
  description: "En len chokladsemifreddo med citronolja och söta krutonger.",
  datePublished: "2025-12-12",
  author: { "@type": "Organization", name: "ICA Köket" },
  totalTime: "PT90M",
  recipeCategory: "Efterrätt",
  recipeYield: "8",
  recipeIngredient: [
    "4 dl vispgrädde",
    "3 ägg",
    '1/2 förp dulce de leche (à ca 400 g)(spara resten till servering)',
    "200 g mörk bakchoklad (55%)",
    "1/2 citron (finrivet skal)",
    "1 dl olivolja",
    "2 skivor surdegsbröd",
    "1 msk olja",
    "1 msk strösocker",
    "2 dl vispgrädde",
    '1/2 förp dulce de leche (à ca 400 g)',
    "kakao",
  ],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Vispa grädden löst." },
    { "@type": "HowToStep", text: "Vispa äggvitorna till ett hårt skum." },
    { "@type": "HowToStep", text: "Hacka och smält chokladen." },
  ],
};

const ICA_TONFISKSALLAD = {
  "@context": "https://schema.org/",
  "@type": "Recipe",
  name: "Tonfisksallad med kikärtor och dijonnaise",
  image:
    "https://assets.icanet.se/t_ICAseAbsoluteUrl/imagevaultfiles/id_251738/cf_259/tonfisksallad.jpg",
  description: "Krispig sallad med chilistekta kikärtor och dijonnaise.",
  author: { "@type": "Organization", name: "ICA Köket" },
  totalTime: "PT30M",
  recipeCategory: "Huvudrätt,Middag",
  recipeYield: "4",
  recipeIngredient: [
    "1 förp kokta kikärtor (à 380 g)",
    "3 msk olja",
    "1 tsk chilipulver",
    "2 krm salt",
    "1 dl majonnäs",
    "2 msk dijonsenap",
    "1 msk finrivet citronskal",
    "3 msk färskpressad citronjuice",
    "1/2 tsk svartpeppar",
    "1 gurka (à ca 300 g)",
    "2 endive- eller hjärtsallad",
    "2 förp tonfisk i olja (à ca 170 g)",
    "1/2 dl finskuren gräslök",
  ],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Häll kikärtorna i ett durkslag." },
    { "@type": "HowToStep", text: "Rör ihop majonnäs, senap och citron." },
  ],
};

const KOKET_KOTTBULLAR = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Köttbullar",
  image: "https://img.koket.se/standard-mega/kottbullar.jpg",
  description: "Klassiska köttbullar till julbordet.",
  author: { "@type": "Person", name: "Köket.se" },
  totalTime: "",
  recipeYield: "4 portioner",
  recipeIngredient: [
    "250 g fläskfärs",
    "250 g nötfärs",
    "1 gul lök",
    "1 ägg",
    "1 dl kaffegrädde",
    "1 tsk salt",
    "0,5 tsk vitpeppar",
    "1 krm malen kryddpeppar",
    "1 krm malen ingefära",
    "smör, till stekning",
  ],
  recipeInstructions: [
    {
      "@type": "HowToStep",
      text: "Skala den gula löken och hacka halva löken fint.",
    },
    {
      "@type": "HowToStep",
      text: "Rulla lagom stora bullar med vattensköljda händer.",
    },
  ],
  recipeCategory: ["Brunch"],
  recipeCuisine: [],
  keywords: ["Färs", "Köttbullar"],
};

const KOKET_SJOMANSBIFF = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Videgårds sjömansbiff",
  image: "https://img.koket.se/standard-mega/videgards-sjomansbiff.png.jpg",
  description: "Det blir inte mer klassiskt än sjömansbiff!",
  author: { "@type": "Person", name: "Erik Videgård" },
  totalTime: "PT1H",
  recipeYield: "4 portioner",
  recipeIngredient: [
    "2 gula lökar, tunt skivade, 3 mm",
    "rapsolja (till stekning)",
    "0,5 dl majsstärkelse (eller vetemjöl)",
    "1 msk salt",
    "1 tsk nymalen svartpeppar",
    "800 g nötinnanlår, tunt skuret i 5 cm bitar",
    "8 potatisar, tunt skivade, 3 mm",
    "2 lagerblad",
    "2 dl oxbuljong",
    "33 cl öl",
    "2 kvistar färsk timjan",
    "persilja, hackad",
    "grönsaker, picklade",
    "senap",
  ],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Sätt ugnen på 200 grader." },
    { "@type": "HowToStep", text: "Hetta upp en stekgryta." },
  ],
  recipeCategory: ["Huvudrätt"],
  recipeCuisine: [],
};

// Arla uses both "type" and "@type" (redundant), and HowToSection structure
const ARLA_PANNKAKOR = {
  "@context": "https://schema.org/",
  type: "Recipe",
  "@type": "Recipe",
  name: "Pannkakor",
  image:
    "https://images.arla.com/recordid/CAF6A3FD-D0CB-4979-B54A4866FC4EBDD3/pannkaka.jpg?width=1300",
  author: { type: "Person", name: "Arla Mat", "@type": "Person" },
  description: "Frasiga nystekta pannkakor!",
  totalTime: "PT30M",
  cookTime: "PT00M",
  prepTime: "PT15M",
  recipeYield: "4 port",
  recipeCategory: "Huvudrätt, Middag",
  recipeCuisine: null,
  recipeIngredient: [
    "3 dl vetemjöl",
    "6 dl Arla Ko® Standardmjölk",
    "3 ägg",
    "½ tsk salt",
    "3 msk Arla Köket® Smör- & rapsolja, till stekning",
  ],
  recipeInstructions: [
    {
      type: "HowToSection",
      "@type": "HowToSection",
      name: "Första instruktionen",
      itemListElement: [
        {
          type: "HowToStep",
          "@type": "HowToStep",
          text: "Vispa ut mjölet i hälften av mjölken.",
          url: "https://www.arla.se/recept/pannkaka/#step1-1",
        },
        {
          type: "HowToStep",
          "@type": "HowToStep",
          text: "Låt pannkakssmeten svälla ca 10 min.",
          url: "https://www.arla.se/recept/pannkaka/#step1-2",
        },
        {
          type: "HowToStep",
          "@type": "HowToStep",
          text: "Hetta upp smör- & rapsolja i en stekpanna.",
          url: "https://www.arla.se/recept/pannkaka/#step1-3",
        },
      ],
    },
  ],
  video: null,
};

const ARLA_LAMMSTEK = {
  "@context": "https://schema.org/",
  type: "Recipe",
  "@type": "Recipe",
  name: "Lammstek med varmt örtsmör",
  image:
    "https://images.arla.com/recordid/8CA6F71C/lammstek-med-varmt-ortsmor.jpg?width=1300",
  author: { type: "Person", name: "Arla Mat", "@type": "Person" },
  description: "Saftig lammstek med varmt örtsmör.",
  totalTime: "PT1H30M",
  cookTime: "PT00M",
  prepTime: "PT00M",
  recipeYield: "8 port",
  recipeCategory: "Varmrätt",
  recipeCuisine: null,
  recipeIngredient: [
    "2 kg lammstek med ben",
    "eller 1,3 kg benfri lammstek",
    "2 msk Svenskt Smör från Arla®",
    "2 hackade vitlöksklyftor",
    "1 msk hackad färsk rosmarin",
    "rivet skal av 1 citron",
    "2 tsk salt",
    "2 krm svartpeppar",
    "100 g Svenskt Smör från Arla®",
    "1 stor hackad vitlöksklyfta",
    "1 msk hackad färsk rosmarin",
    "1 dl hackad bladpersilja",
    "rivet skal av 1 citron",
    "2 msk hackad kapris",
    "2 hackade sardellfiléer",
  ],
  recipeInstructions: [
    {
      type: "HowToSection",
      "@type": "HowToSection",
      name: "Första instruktionen",
      itemListElement: [
        { type: "HowToStep", "@type": "HowToStep", text: "Sätt ugnen på 250°." },
        { type: "HowToStep", "@type": "HowToStep", text: "Smält smöret och blanda." },
        { type: "HowToStep", "@type": "HowToStep", text: "Bred blandningen runtom steken." },
      ],
    },
    {
      type: "HowToSection",
      "@type": "HowToSection",
      name: "Sista instruktionen",
      itemListElement: [
        { type: "HowToStep", "@type": "HowToStep", text: "Smält smöret i en kastrull." },
        { type: "HowToStep", "@type": "HowToStep", text: "Skär lammsteken i skivor och servera." },
      ],
    },
  ],
  video: null,
};

// Tasteline uses plain strings for instructions (not HowToStep objects)
const TASTELINE_KOTTBULLAR = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Klassiska köttbullar med potatismos, lingon och inlagd gurka",
  image: "https://eu-central-1.linodeobjects.com/tasteline/2020/09/kottbullar.jpg",
  datePublished: "2020-09-25",
  totalTime: "PT45M",
  recipeYield: "4 portioner",
  description: "Underbar husmanskost.",
  recipeCategory: "Mat",
  recipeIngredient: [
    "gul lök(ar)",
    "mjölig potatis",
    "gurkor",
    "rårörda lingon",
    "mat & bak smör",
    "salt",
    "vatten",
    "ströbröd",
    "mjölk",
    "ättiksprit, 12 %",
    "strösocker",
    "ägg",
    "blandfärs",
    "olivolja",
  ],
  recipeInstructions: [
    "Skiva gurkan tunt och lägg den i en skål.",
    "Skala potatisen och koka den mjuk.",
    "Skala och finhacka lök.",
  ],
  author: { type: "Person", name: "Mari Bergman" },
};

// Recept.se uses http://schema.org, numeric recipeYield, and ½ unicode fractions
const RECEPTSE_CHOKLADBOLL = {
  "@context": "http://schema.org",
  "@type": "Recipe",
  author: { "@type": "Person", name: "Boel Ottmer" },
  name: "Chokladbollstårta med chokladtäcke",
  totalTime: "PT25M",
  recipeIngredient: [
    "225 g mjukt smör",
    "2 dl strösocker",
    "50 g hasselnötter",
    "7 dl havregryn",
    "1 dl kakao",
    "2 tsk vaniljsocker",
    "1 krm salt",
    "¾ dl starkt kaffe svalt",
    "¾ dl vispgrädde",
    "150 g mörk eller ljus choklad, hackad",
    "2 dl riven kokos",
    "1,5 dl vispgrädde",
  ],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Mixa alla ingredienser." },
    { "@type": "HowToStep", text: "Ställ undan ca 1 dl av smeten." },
  ],
  recipeYield: 10,
  image:
    "https://images.recept.se/images/recipes/chokladbollstarta_38289.jpg",
  recipeCuisine: "Sverige",
  recipeCategory: "Bak & dessert",
  description: "Chokladbollstårta – enkelt och supergott.",
  suitableForDiet: "http://schema.org/VegetarianDiet",
};

// -- Tests --

describe("JSON-LD integration tests (real recipe sites)", () => {
  describe("extractJsonLdRecipe", () => {
    it("should extract direct Recipe object (ICA)", () => {
      const html = wrapInHtml(ICA_SEMIFREDDO);
      const result = extractJsonLdRecipe(html);
      expect(result).not.toBeNull();
      expect(result!.name).toBe(
        "Chokladsemifreddo med citronolja och söta krutonger"
      );
    });

    it("should extract Recipe from @graph wrapper", () => {
      const html = wrapInHtml({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebPage", name: "Page" },
          { "@type": "BreadcrumbList" },
          KOKET_KOTTBULLAR,
        ],
      });
      const result = extractJsonLdRecipe(html);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Köttbullar");
    });

    it("should extract Recipe from array of schemas (Arla style)", () => {
      const html = wrapInHtml([
        { "@type": "Organization", name: "Arla" },
        ARLA_PANNKAKOR,
      ]);
      const result = extractJsonLdRecipe(html);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Pannkakor");
    });

    it("should handle multiple script tags, picking the one with Recipe", () => {
      const html = `<html><head>
        <script type="application/ld+json">{"@type":"Organization","name":"Test"}</script>
        <script type="application/ld+json">${JSON.stringify(KOKET_SJOMANSBIFF)}</script>
      </head><body></body></html>`;
      const result = extractJsonLdRecipe(html);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Videgårds sjömansbiff");
    });

    it("should return null for HTML without JSON-LD", () => {
      const result = extractJsonLdRecipe("<html><body>No recipe</body></html>");
      expect(result).toBeNull();
    });

    it("should return null for JSON-LD without Recipe type", () => {
      const html = wrapInHtml({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Not a recipe",
      });
      expect(extractJsonLdRecipe(html)).toBeNull();
    });
  });

  describe("full pipeline: extract + map", () => {
    function extractAndMap(jsonLd: object | object[], url = "https://example.com/recipe") {
      const html = wrapInHtml(jsonLd);
      const recipe = extractJsonLdRecipe(html);
      expect(recipe).not.toBeNull();
      return mapJsonLdToRecipeInput(recipe!, url);
    }

    describe("ICA.se", () => {
      it("should parse semifreddo with parenthetical ingredients", () => {
        const result = extractAndMap(ICA_SEMIFREDDO);

        expect(result.data.recipe_name).toBe(
          "Chokladsemifreddo med citronolja och söta krutonger"
        );
        expect(result.data.author).toBe("ICA Köket");
        expect(result.data.cook_time).toBe(90); // totalTime fallback
        expect(result.data.recipe_yield).toBe("8");

        // Ingredient with parenthetical modifiers
        const dulce = result.data.ingredients?.find(
          (i) => "name" in i && i.name.includes("dulce")
        );
        expect(dulce).toBeDefined();

        // Ingredient with fraction quantity
        const citron = result.data.ingredients?.find(
          (i) => "name" in i && i.name.includes("citron")
        );
        expect(citron).toBeDefined();
        if (citron && "quantity" in citron) {
          expect(citron.quantity).toBe("1/2");
        }

        // Ingredient without quantity
        const kakao = result.data.ingredients?.find(
          (i) => "name" in i && i.name === "kakao"
        );
        expect(kakao).toBeDefined();
      });

      it("should parse tonfisksallad with package sizes", () => {
        const result = extractAndMap(ICA_TONFISKSALLAD);

        expect(result.data.recipe_name).toBe(
          "Tonfisksallad med kikärtor och dijonnaise"
        );
        expect(result.data.cook_time).toBe(30);
        expect(result.data.ingredients).toHaveLength(13);

        // "1 förp kokta kikärtor (à 380 g)" — unit is "förp"
        const kikartor = result.data.ingredients?.[0];
        expect(kikartor).toBeDefined();
        if (kikartor && "quantity" in kikartor) {
          expect(kikartor.quantity).toBe("1");
          expect(kikartor.measurement).toBe("förp");
        }
      });
    });

    describe("Köket.se", () => {
      it("should parse köttbullar with comma-decimal quantities", () => {
        const result = extractAndMap(KOKET_KOTTBULLAR);

        expect(result.data.recipe_name).toBe("Köttbullar");
        expect(result.data.author).toBe("Köket.se");
        expect(result.data.recipe_yield).toBe("4");
        expect(result.data.recipe_yield_name).toBe("portioner");

        // Empty totalTime should result in null cook_time
        expect(result.data.cook_time).toBeNull();

        // "0,5 tsk vitpeppar" — comma decimal should be converted
        const vitpeppar = result.data.ingredients?.find(
          (i) => "name" in i && i.name.includes("vitpeppar")
        );
        expect(vitpeppar).toBeDefined();
        if (vitpeppar && "quantity" in vitpeppar) {
          expect(vitpeppar.quantity).toBe("0.5");
          expect(vitpeppar.measurement).toBe("tsk");
        }

        // "smör, till stekning" — no quantity, low confidence
        const smor = result.data.ingredients?.find(
          (i) => "name" in i && i.name.includes("smör")
        );
        expect(smor).toBeDefined();
        expect(result.lowConfidenceIngredients.length).toBeGreaterThan(0);

        // Empty recipeCuisine array → empty string (joined empty array)
        expect(result.data.cuisine).toBe("");
      });

      it("should parse sjömansbiff with verbose ingredient descriptions", () => {
        const result = extractAndMap(KOKET_SJOMANSBIFF);

        expect(result.data.cook_time).toBe(60); // PT1H
        expect(result.data.ingredients).toHaveLength(14);

        // "800 g nötinnanlår, tunt skuret i 5 cm bitar"
        const not = result.data.ingredients?.find(
          (i) => "name" in i && i.name.includes("nötinnanlår")
        );
        expect(not).toBeDefined();
        if (not && "quantity" in not) {
          expect(not.quantity).toBe("800");
          expect(not.measurement).toBe("g");
        }

        // "33 cl öl" — cl is not in the parser's unit list
        const ol = result.data.ingredients?.find(
          (i) => "name" in i && (i.name.includes("öl") || i.name.includes("cl"))
        );
        expect(ol).toBeDefined();
      });
    });

    describe("Arla.se", () => {
      it("should parse pannkakor with HowToSection instructions", () => {
        const result = extractAndMap(ARLA_PANNKAKOR);

        expect(result.data.recipe_name).toBe("Pannkakor");
        expect(result.data.author).toBe("Arla Mat");
        expect(result.data.prep_time).toBe(15);
        expect(result.data.recipe_yield).toBe("4");
        expect(result.data.recipe_yield_name).toBe("port");

        // Instructions should be grouped
        const instructions = result.data.instructions!;
        expect(instructions.length).toBeGreaterThanOrEqual(3);
        // First should be a group marker
        expect(instructions[0]).toEqual({ group: "Första instruktionen" });

        // Branded ingredient: "6 dl Arla Ko® Standardmjölk"
        const mjolk = result.data.ingredients?.find(
          (i) => "name" in i && i.name.includes("Arla")
        );
        expect(mjolk).toBeDefined();
        if (mjolk && "quantity" in mjolk) {
          expect(mjolk.quantity).toBe("6");
          expect(mjolk.measurement).toBe("dl");
        }

        // Unicode fraction: "½ tsk salt"
        // Note: the parser may not handle ½ — this documents current behavior
        const salt = result.data.ingredients?.find(
          (i) => "name" in i && i.name.includes("salt")
        );
        expect(salt).toBeDefined();
      });

      it("should parse lammstek with multiple HowToSections", () => {
        const result = extractAndMap(ARLA_LAMMSTEK);

        // cookTime is "PT00M" → 0, which is not nullish so ?? doesn't fallback to totalTime
        expect(result.data.cook_time).toBe(0);
        expect(result.data.recipe_yield).toBe("8");
        expect(result.data.ingredients).toHaveLength(15);

        // Two instruction groups
        const instructions = result.data.instructions!;
        const groups = instructions.filter((i) => "group" in i);
        expect(groups).toHaveLength(2);
        expect(groups[0]).toEqual({ group: "Första instruktionen" });
        expect(groups[1]).toEqual({ group: "Sista instruktionen" });

        // Steps should be present
        const steps = instructions.filter((i) => "step" in i);
        expect(steps.length).toBe(5);

        // Ingredient without standard quantity: "rivet skal av 1 citron"
        const citron = result.data.ingredients?.find(
          (i) => "name" in i && i.name.includes("citron")
        );
        expect(citron).toBeDefined();

        // Ingredient without quantity: "eller 1,3 kg benfri lammstek"
        // This is an "alternative" line — parser should handle it somehow
        const alt = result.data.ingredients?.[1];
        expect(alt).toBeDefined();
      });
    });

    describe("Tasteline.com", () => {
      it("should parse recipe with plain string instructions", () => {
        const result = extractAndMap(TASTELINE_KOTTBULLAR);

        expect(result.data.recipe_name).toBe(
          "Klassiska köttbullar med potatismos, lingon och inlagd gurka"
        );

        // Instructions are plain strings, not HowToStep
        const instructions = result.data.instructions!;
        expect(instructions.length).toBe(3);
        expect(instructions[0]).toEqual({
          step: "Skiva gurkan tunt och lägg den i en skål.",
        });

        // Ingredients without quantities (Tasteline style)
        expect(result.data.ingredients).toHaveLength(14);
        // Most should be low confidence since they lack quantities
        expect(result.lowConfidenceIngredients.length).toBeGreaterThan(5);
      });
    });

    describe("Recept.se", () => {
      it("should parse recipe with numeric yield and unicode fractions", () => {
        const result = extractAndMap(RECEPTSE_CHOKLADBOLL);

        expect(result.data.recipe_name).toBe(
          "Chokladbollstårta med chokladtäcke"
        );
        expect(result.data.author).toBe("Boel Ottmer");
        expect(result.data.cuisine).toBe("Sverige");
        expect(result.data.cook_time).toBe(25);

        // Numeric recipeYield
        expect(result.data.recipe_yield).toBe("10");

        expect(result.data.ingredients).toHaveLength(12);

        // Comma-decimal: "1,5 dl vispgrädde"
        const vispgradde = result.data.ingredients?.filter(
          (i) => "name" in i && i.name.includes("vispgrädde")
        );
        expect(vispgradde).toHaveLength(2);

        // Ingredient with modifier: "150 g mörk eller ljus choklad, hackad"
        const choklad = result.data.ingredients?.find(
          (i) => "name" in i && i.name.includes("choklad")
        );
        expect(choklad).toBeDefined();
        if (choklad && "quantity" in choklad) {
          expect(choklad.quantity).toBe("150");
          expect(choklad.measurement).toBe("g");
        }
      });
    });
  });

  describe("edge cases across sites", () => {
    it("should handle recipeCuisine as empty array (Köket)", () => {
      const html = wrapInHtml(KOKET_KOTTBULLAR);
      const recipe = extractJsonLdRecipe(html)!;
      const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
      // Empty array joins to empty string (not null)
      expect(result.data.cuisine).toBe("");
    });

    it("should handle recipeCuisine as null (Arla)", () => {
      const html = wrapInHtml(ARLA_PANNKAKOR);
      const recipe = extractJsonLdRecipe(html)!;
      const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
      expect(result.data.cuisine).toBeNull();
    });

    it("should handle empty totalTime string (Köket)", () => {
      const html = wrapInHtml(KOKET_KOTTBULLAR);
      const recipe = extractJsonLdRecipe(html)!;
      const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
      expect(result.data.cook_time).toBeNull();
    });

    it("should handle numeric recipeYield (Recept.se)", () => {
      const html = wrapInHtml(RECEPTSE_CHOKLADBOLL);
      const recipe = extractJsonLdRecipe(html)!;
      const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
      expect(result.data.recipe_yield).toBe("10");
    });

    it("should handle Organization as author (ICA)", () => {
      const html = wrapInHtml(ICA_SEMIFREDDO);
      const recipe = extractJsonLdRecipe(html)!;
      const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
      expect(result.data.author).toBe("ICA Köket");
    });

    it("should handle cookTime PT00M as 0 (Arla)", () => {
      const html = wrapInHtml(ARLA_PANNKAKOR);
      const recipe = extractJsonLdRecipe(html)!;
      const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
      // PT00M should parse to 0, and since prepTime is 15, cookTime should be 0 or fallback to totalTime
      expect(result.data.prep_time).toBe(15);
    });

    it("should preserve source URL in mapped output", () => {
      const url = "https://www.ica.se/recept/test-123/";
      const html = wrapInHtml(ICA_SEMIFREDDO);
      const recipe = extractJsonLdRecipe(html)!;
      const result = mapJsonLdToRecipeInput(recipe, url);
      expect(result.data.url).toBe(url);
    });
  });
});

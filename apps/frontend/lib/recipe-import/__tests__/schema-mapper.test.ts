import { describe, it, expect } from "vitest";
import { mapJsonLdToRecipeInput } from "../schema-mapper";
import { JsonLdRecipe } from "../types";

describe("schema-mapper", () => {
  describe("mapJsonLdToRecipeInput", () => {
    const baseRecipe: JsonLdRecipe = {
      "@type": "Recipe",
      name: "Test Recipe",
    };

    describe("basic mapping", () => {
      it("should map recipe name and URL", () => {
        const result = mapJsonLdToRecipeInput(baseRecipe, "https://example.com/recipe");

        expect(result.data.recipe_name).toBe("Test Recipe");
        expect(result.data.url).toBe("https://example.com/recipe");
      });

      it("should map description", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          description: "A delicious test recipe",
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.description).toBe("A delicious test recipe");
      });

      it("should fall back to recipe name if description is missing", () => {
        const result = mapJsonLdToRecipeInput(baseRecipe, "https://example.com");
        expect(result.data.description).toBe("Test Recipe");
      });
    });

    describe("image extraction", () => {
      it("should extract string image URL", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          image: "https://example.com/image.jpg",
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.image).toBe("https://example.com/image.jpg");
        expect(result.data.thumbnail).toBe("https://example.com/image.jpg");
      });

      it("should extract image URL from array", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          image: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.image).toBe("https://example.com/image1.jpg");
      });

      it("should extract image URL from object with url property", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          image: { url: "https://example.com/image.jpg" },
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.image).toBe("https://example.com/image.jpg");
      });

      it("should extract image URL from array of objects", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          image: [{ url: "https://example.com/image1.jpg" }],
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.image).toBe("https://example.com/image1.jpg");
      });

      it("should return null for missing image", () => {
        const result = mapJsonLdToRecipeInput(baseRecipe, "https://example.com");
        expect(result.data.image).toBeNull();
      });
    });

    describe("author extraction", () => {
      it("should extract string author", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          author: "John Doe",
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.author).toBe("John Doe");
      });

      it("should extract author from object with name", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          author: { name: "Jane Doe" },
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.author).toBe("Jane Doe");
      });

      it("should extract first author from array", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          author: [{ name: "Author 1" }, { name: "Author 2" }],
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.author).toBe("Author 1");
      });

      it("should return null for missing author", () => {
        const result = mapJsonLdToRecipeInput(baseRecipe, "https://example.com");
        expect(result.data.author).toBeNull();
      });
    });

    describe("duration parsing", () => {
      it("should parse prep and cook times", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          prepTime: "PT15M",
          cookTime: "PT30M",
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.prep_time).toBe(15);
        expect(result.data.cook_time).toBe(30);
      });

      it("should use totalTime as cook_time fallback", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          totalTime: "PT45M",
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.prep_time).toBeNull();
        expect(result.data.cook_time).toBe(45);
      });

      it("should prefer explicit cookTime over totalTime", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          cookTime: "PT30M",
          totalTime: "PT60M",
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.cook_time).toBe(30);
      });
    });

    describe("recipe yield parsing", () => {
      it("should parse numeric yield", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          recipeYield: "4",
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.recipe_yield).toBe("4");
        expect(result.data.recipe_yield_name).toBeNull();
      });

      it("should parse yield with unit", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          recipeYield: "4 servings",
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.recipe_yield).toBe("4");
        expect(result.data.recipe_yield_name).toBe("servings");
      });

      it("should parse Swedish yield format", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          recipeYield: "ca 30 st",
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.recipe_yield).toBe("30");
        expect(result.data.recipe_yield_name).toBe("st");
      });

      it("should handle array yield (take first)", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          recipeYield: ["4 servings", "4"],
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.recipe_yield).toBe("4");
        expect(result.data.recipe_yield_name).toBe("servings");
      });
    });

    describe("cuisine mapping", () => {
      it("should map single cuisine", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          recipeCuisine: "Swedish",
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.cuisine).toBe("Swedish");
      });

      it("should join array of cuisines", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          recipeCuisine: ["Swedish", "Nordic"],
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.cuisine).toBe("Swedish, Nordic");
      });
    });

    describe("ingredients mapping", () => {
      it("should parse ingredients", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          recipeIngredient: ["2 dl mjölk", "500 g mjöl", "3 st ägg"],
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.ingredients).toHaveLength(3);
        expect(result.data.ingredients?.[0]).toEqual({
          quantity: "2",
          measurement: "dl",
          name: "mjölk",
        });
      });

      it("should track low confidence ingredients", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          recipeIngredient: ["2 dl mjölk", "Salt och peppar"],
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.lowConfidenceIngredients).toContain(1);
      });
    });

    describe("instructions mapping", () => {
      it("should parse string instructions", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          recipeInstructions: "Mix all ingredients together.",
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.instructions).toEqual([
          { step: "Mix all ingredients together." },
        ]);
      });

      it("should parse array of strings", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          recipeInstructions: ["Step 1", "Step 2", "Step 3"],
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.instructions).toEqual([
          { step: "Step 1" },
          { step: "Step 2" },
          { step: "Step 3" },
        ]);
      });

      it("should parse HowToStep objects", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          recipeInstructions: [
            { "@type": "HowToStep", text: "First step" },
            { "@type": "HowToStep", text: "Second step" },
          ],
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.instructions).toEqual([
          { step: "First step" },
          { step: "Second step" },
        ]);
      });

      it("should parse HowToSection with groups", () => {
        const recipe: JsonLdRecipe = {
          ...baseRecipe,
          recipeInstructions: [
            {
              "@type": "HowToSection",
              name: "Prepare dough",
              itemListElement: [
                { "@type": "HowToStep", text: "Mix flour and water" },
                { "@type": "HowToStep", text: "Knead dough" },
              ],
            },
            {
              "@type": "HowToSection",
              name: "Bake",
              itemListElement: [
                { "@type": "HowToStep", text: "Preheat oven" },
              ],
            },
          ],
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com");
        expect(result.data.instructions).toEqual([
          { group: "Prepare dough" },
          { step: "Mix flour and water" },
          { step: "Knead dough" },
          { group: "Bake" },
          { step: "Preheat oven" },
        ]);
      });

      it("should add warning for missing instructions", () => {
        const result = mapJsonLdToRecipeInput(baseRecipe, "https://example.com");
        expect(result.warnings).toContain("Inga instruktioner hittades i receptet");
      });
    });

    describe("complete recipe mapping", () => {
      it("should map a complete recipe", () => {
        const recipe: JsonLdRecipe = {
          "@type": "Recipe",
          name: "Pannkakor",
          description: "Svenska pannkakor",
          image: "https://example.com/pannkakor.jpg",
          author: { name: "Kocken" },
          prepTime: "PT10M",
          cookTime: "PT20M",
          recipeYield: "4 portioner",
          recipeCuisine: "Swedish",
          recipeIngredient: ["3 dl mjöl", "6 dl mjölk", "3 st ägg"],
          recipeInstructions: [
            { "@type": "HowToStep", text: "Blanda mjöl och mjölk" },
            { "@type": "HowToStep", text: "Vispa i äggen" },
            { "@type": "HowToStep", text: "Stek pannkakorna" },
          ],
        };

        const result = mapJsonLdToRecipeInput(recipe, "https://example.com/recept/pannkakor");

        expect(result.data).toMatchObject({
          recipe_name: "Pannkakor",
          description: "Svenska pannkakor",
          url: "https://example.com/recept/pannkakor",
          author: "Kocken",
          prep_time: 10,
          cook_time: 20,
          recipe_yield: "4",
          recipe_yield_name: "portioner",
          cuisine: "Swedish",
          image: "https://example.com/pannkakor.jpg",
        });

        expect(result.data.ingredients).toHaveLength(3);
        expect(result.data.instructions).toHaveLength(3);
        expect(result.warnings).toHaveLength(0);
      });
    });
  });
});

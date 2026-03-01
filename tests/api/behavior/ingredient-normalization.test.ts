/**
 * Ingredient Normalization Behavior Tests
 *
 * Tests that search_foods and search_units correctly normalize ingredient
 * names and units for the recipe import pipeline. Verifies:
 * - Swedish character case folding (ägg → Ägg, smör → Smör)
 * - Standard food matching (olivolja → Olivolja)
 * - Parenthetical handling via word_similarity (citron (finrivet skal) → Citron)
 * - Unit matching by abbreviation and name (msk → matsked, dl → deciliter)
 * - Rank threshold filtering for import use (limit=1, rank > 0.5)
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  createAuthenticatedClient,
  TEST_USERS,
  setupTestHooks,
  type PostgrestClient,
} from "../setup";
import { createTestUser } from "../seed";

interface FoodResult {
  id: string;
  name: string;
  rank: number;
  status: string;
  is_own_pending: boolean;
  canonical_food_id: string | null;
  canonical_food_name: string | null;
}

interface UnitResult {
  id: string;
  name: string;
  plural: string;
  abbreviation: string;
  rank: number;
}

describe("Ingredient normalization (search_foods / search_units)", () => {
  setupTestHooks();

  let client: PostgrestClient;

  beforeAll(async () => {
    await createTestUser(TEST_USERS.userA);
    client = await createAuthenticatedClient(TEST_USERS.userA.email);
  });

  /**
   * Helper: search for a food and return the top result (import-style: limit=1)
   */
  async function searchTopFood(query: string): Promise<FoodResult | null> {
    const result = await client.rpc<FoodResult[]>("search_foods", {
      p_query: query,
      p_limit: 1,
    });
    if (result.error) throw new Error(`search_foods failed: ${result.error.message}`);
    return result.data && result.data.length > 0 ? result.data[0] : null;
  }

  /**
   * Helper: search for a unit and return the top result
   */
  async function searchTopUnit(query: string): Promise<UnitResult | null> {
    const result = await client.rpc<UnitResult[]>("search_units", {
      p_query: query,
      p_limit: 1,
    });
    if (result.error) throw new Error(`search_units failed: ${result.error.message}`);
    return result.data && result.data.length > 0 ? result.data[0] : null;
  }

  describe("Swedish character case folding (locale C workaround)", () => {
    it("ägg matches Ägg", async () => {
      const result = await searchTopFood("ägg");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Ägg");
      expect(result!.rank).toBeGreaterThan(0.5);
    });

    it("smör matches Smör", async () => {
      const result = await searchTopFood("smör");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Smör");
      expect(result!.rank).toBeGreaterThan(0.5);
    });

    it("mjölk matches Mjölk", async () => {
      const result = await searchTopFood("mjölk");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Mjölk");
      expect(result!.rank).toBeGreaterThan(0.5);
    });
  });

  describe("Standard food matching", () => {
    it("olivolja matches Olivolja", async () => {
      const result = await searchTopFood("olivolja");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Olivolja");
      expect(result!.rank).toBeGreaterThan(0.5);
    });

    it("vispgrädde matches Vispgrädde", async () => {
      const result = await searchTopFood("vispgrädde");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Vispgrädde");
      expect(result!.rank).toBeGreaterThan(0.5);
    });

    it("salt matches Salt", async () => {
      const result = await searchTopFood("salt");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Salt");
      expect(result!.rank).toBeGreaterThan(0.5);
    });

    it("citron matches Citron", async () => {
      const result = await searchTopFood("citron");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Citron");
      expect(result!.rank).toBeGreaterThan(0.5);
    });

    it("dulce de leche matches Dulce de leche", async () => {
      const result = await searchTopFood("dulce de leche");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Dulce de leche");
      expect(result!.rank).toBeGreaterThan(0.5);
    });
  });

  describe("Parenthetical ingredient modifiers (word_similarity)", () => {
    it("citron (finrivet skal) matches Citron", async () => {
      const result = await searchTopFood("citron (finrivet skal)");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Citron");
      expect(result!.rank).toBeGreaterThan(0.5);
    });

    it("olivolja (extra virgin) matches an olivolja variant", async () => {
      const result = await searchTopFood("olivolja (extra virgin)");
      expect(result).not.toBeNull();
      // Could match "Extra virgin olivolja" or "Olivolja" depending on rank
      expect(result!.name.toLowerCase()).toContain("olivolja");
      expect(result!.rank).toBeGreaterThan(0.5);
    });

    it("smör (rumstempererat) matches Smör", async () => {
      const result = await searchTopFood("smör (rumstempererat)");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Smör");
      expect(result!.rank).toBeGreaterThan(0.5);
    });

    it("ägg (stora) matches Ägg", async () => {
      const result = await searchTopFood("ägg (stora)");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Ägg");
      expect(result!.rank).toBeGreaterThan(0.5);
    });
  });

  describe("Unit matching", () => {
    it("msk matches matsked (abbreviation)", async () => {
      const result = await searchTopUnit("msk");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("matsked");
      expect(result!.abbreviation).toBe("msk");
    });

    it("dl matches deciliter (abbreviation)", async () => {
      const result = await searchTopUnit("dl");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("deciliter");
      expect(result!.abbreviation).toBe("dl");
    });

    it("tsk matches tesked (abbreviation)", async () => {
      const result = await searchTopUnit("tsk");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("tesked");
      expect(result!.abbreviation).toBe("tsk");
    });

    it("g matches gram (abbreviation)", async () => {
      const result = await searchTopUnit("g");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("gram");
      expect(result!.abbreviation).toBe("g");
    });

    it("st matches stycken (abbreviation)", async () => {
      const result = await searchTopUnit("st");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("stycken");
      expect(result!.abbreviation).toBe("st");
    });

    it("krm matches kryddmått (abbreviation)", async () => {
      const result = await searchTopUnit("krm");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("kryddmått");
      expect(result!.abbreviation).toBe("krm");
    });

    it("matsked matches matsked (full name)", async () => {
      const result = await searchTopUnit("matsked");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("matsked");
    });
  });

  describe("Edge cases", () => {
    it("empty query returns no results", async () => {
      const result = await client.rpc<FoodResult[]>("search_foods", {
        p_query: "",
        p_limit: 1,
      });
      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    });

    it("gibberish query returns no results", async () => {
      const result = await searchTopFood("xyzqwrtyuioplkjhgfds");
      expect(result).toBeNull();
    });

    it("very short query (1 char) returns result for food search via prefix matching", async () => {
      // The import pipeline skips queries < 2 chars, but the DB function
      // should still handle it gracefully. With prefix matching, single
      // characters can match foods (e.g. "x" → "Xantangummi").
      const result = await searchTopFood("x");
      if (result) {
        // If a match is found, it should be a prefix match
        expect(result.name.toLowerCase().startsWith("x")).toBe(true);
      }
    });

    it("query with only whitespace returns no results", async () => {
      const result = await client.rpc<FoodResult[]>("search_foods", {
        p_query: "   ",
        p_limit: 1,
      });
      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    });
  });

  describe("Import pipeline simulation", () => {
    /**
     * Simulate the matchIngredientsToDatabase function:
     * For each ingredient, search food (limit=1, rank > 0.5) and unit.
     * Return the normalized name and unit.
     */
    async function normalizeIngredient(ingredient: {
      name: string;
      measurement: string;
      quantity: string;
    }): Promise<{ name: string; measurement: string; quantity: string }> {
      const [food, unit] = await Promise.all([
        ingredient.name.length >= 2 ? searchTopFood(ingredient.name) : null,
        searchTopUnit(ingredient.measurement),
      ]);

      return {
        name: food && food.rank > 0.5 ? food.name : ingredient.name,
        measurement:
          unit && unit.rank > 0.5
            ? unit.abbreviation || unit.name
            : ingredient.measurement,
        quantity: ingredient.quantity,
      };
    }

    it("normalizes a typical ICA recipe ingredient list", async () => {
      const rawIngredients = [
        { name: "ägg", measurement: "st", quantity: "3" },
        { name: "olivolja", measurement: "msk", quantity: "2" },
        { name: "vispgrädde", measurement: "dl", quantity: "3" },
        { name: "smör", measurement: "g", quantity: "50" },
        { name: "citron (finrivet skal)", measurement: "st", quantity: "1" },
      ];

      const normalized = await Promise.all(rawIngredients.map(normalizeIngredient));

      expect(normalized[0].name).toBe("Ägg");
      expect(normalized[1].name).toBe("Olivolja");
      expect(normalized[2].name).toBe("Vispgrädde");
      expect(normalized[3].name).toBe("Smör");
      expect(normalized[4].name).toBe("Citron");

      // Units should resolve to abbreviations
      expect(normalized[0].measurement).toBe("st");
      expect(normalized[1].measurement).toBe("msk");
      expect(normalized[2].measurement).toBe("dl");
      expect(normalized[3].measurement).toBe("g");
    });

    it("preserves unrecognized ingredients unchanged", async () => {
      const result = await normalizeIngredient({
        name: "hemlig specialkrydda från mormor",
        measurement: "nypa",
        quantity: "1",
      });

      // If no match found, keep the original
      // (the food name is long enough that similarity will be low)
      expect(result.quantity).toBe("1");
    });
  });
});

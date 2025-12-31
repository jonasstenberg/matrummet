import { describe, it, expect } from "vitest";
import { parseIngredient } from "../ingredient-parser";

describe("ingredient-parser", () => {
  describe("parseIngredient", () => {
    describe("Swedish units", () => {
      it("should parse volume units", () => {
        expect(parseIngredient("2 dl mjölk")).toEqual({
          quantity: "2",
          measurement: "dl",
          name: "mjölk",
          confidence: "high",
        });

        expect(parseIngredient("5 ml vaniljextrakt")).toEqual({
          quantity: "5",
          measurement: "ml",
          name: "vaniljextrakt",
          confidence: "high",
        });

        expect(parseIngredient("1 msk olivolja")).toEqual({
          quantity: "1",
          measurement: "msk",
          name: "olivolja",
          confidence: "high",
        });

        expect(parseIngredient("2 tsk salt")).toEqual({
          quantity: "2",
          measurement: "tsk",
          name: "salt",
          confidence: "high",
        });

        expect(parseIngredient("1 krm svartpeppar")).toEqual({
          quantity: "1",
          measurement: "krm",
          name: "svartpeppar",
          confidence: "high",
        });
      });

      it("should parse weight units", () => {
        expect(parseIngredient("500 g köttfärs")).toEqual({
          quantity: "500",
          measurement: "g",
          name: "köttfärs",
          confidence: "high",
        });

        expect(parseIngredient("1 kg potatis")).toEqual({
          quantity: "1",
          measurement: "kg",
          name: "potatis",
          confidence: "high",
        });

        expect(parseIngredient("2 hg ost")).toEqual({
          quantity: "2",
          measurement: "hg",
          name: "ost",
          confidence: "high",
        });
      });

      it("should parse piece units", () => {
        expect(parseIngredient("3 st ägg")).toEqual({
          quantity: "3",
          measurement: "st",
          name: "ägg",
          confidence: "high",
        });

        expect(parseIngredient("2 klyftor vitlök")).toEqual({
          quantity: "2",
          measurement: "klyftor",
          name: "vitlök",
          confidence: "high",
        });

        expect(parseIngredient("4 skivor bacon")).toEqual({
          quantity: "4",
          measurement: "skivor",
          name: "bacon",
          confidence: "high",
        });
      });

      it("should parse container units", () => {
        expect(parseIngredient("1 burk krossade tomater")).toEqual({
          quantity: "1",
          measurement: "burk",
          name: "krossade tomater",
          confidence: "high",
        });

        expect(parseIngredient("2 påsar frysta ärtor")).toEqual({
          quantity: "2",
          measurement: "påsar",
          name: "frysta ärtor",
          confidence: "high",
        });
      });
    });

    describe("English units", () => {
      it("should parse English volume units", () => {
        expect(parseIngredient("2 cups flour")).toEqual({
          quantity: "2",
          measurement: "cups",
          name: "flour",
          confidence: "high",
        });

        expect(parseIngredient("1 tablespoon butter")).toEqual({
          quantity: "1",
          measurement: "tablespoon",
          name: "butter",
          confidence: "high",
        });

        expect(parseIngredient("2 tsp vanilla")).toEqual({
          quantity: "2",
          measurement: "tsp",
          name: "vanilla",
          confidence: "high",
        });
      });

      it("should parse English weight units", () => {
        expect(parseIngredient("1 pound chicken")).toEqual({
          quantity: "1",
          measurement: "pound",
          name: "chicken",
          confidence: "high",
        });

        expect(parseIngredient("8 oz cream cheese")).toEqual({
          quantity: "8",
          measurement: "oz",
          name: "cream cheese",
          confidence: "high",
        });
      });

      it("should parse English piece units", () => {
        expect(parseIngredient("3 cloves garlic")).toEqual({
          quantity: "3",
          measurement: "cloves",
          name: "garlic",
          confidence: "high",
        });

        expect(parseIngredient("2 slices bread")).toEqual({
          quantity: "2",
          measurement: "slices",
          name: "bread",
          confidence: "high",
        });
      });
    });

    describe("quantity formats", () => {
      it("should parse decimal quantities with dot", () => {
        expect(parseIngredient("1.5 dl grädde")).toEqual({
          quantity: "1.5",
          measurement: "dl",
          name: "grädde",
          confidence: "high",
        });
      });

      it("should parse decimal quantities with comma and convert to dot", () => {
        expect(parseIngredient("1,5 dl grädde")).toEqual({
          quantity: "1.5",
          measurement: "dl",
          name: "grädde",
          confidence: "high",
        });
      });

      it("should parse fractions", () => {
        expect(parseIngredient("1/2 dl socker")).toEqual({
          quantity: "1/2",
          measurement: "dl",
          name: "socker",
          confidence: "high",
        });
      });

      it("should parse approximate quantities with ca.", () => {
        expect(parseIngredient("ca. 500 g potatis")).toEqual({
          quantity: "ca. 500",
          measurement: "g",
          name: "potatis",
          confidence: "high",
        });

        expect(parseIngredient("ca 2 dl mjöl")).toEqual({
          quantity: "ca 2",
          measurement: "dl",
          name: "mjöl",
          confidence: "high",
        });
      });

      it("should parse quantity ranges", () => {
        expect(parseIngredient("2-3 dl vatten")).toEqual({
          quantity: "2-3",
          measurement: "dl",
          name: "vatten",
          confidence: "high",
        });
      });
    });

    describe("no quantity or unit", () => {
      it("should handle ingredients without quantity", () => {
        expect(parseIngredient("Salt och peppar")).toEqual({
          quantity: "",
          measurement: "",
          name: "Salt och peppar",
          confidence: "low",
        });

        expect(parseIngredient("Persilja till garnering")).toEqual({
          quantity: "",
          measurement: "",
          name: "Persilja till garnering",
          confidence: "low",
        });
      });

      it("should handle quantity without unit", () => {
        expect(parseIngredient("2 ägg")).toEqual({
          quantity: "2",
          measurement: "",
          name: "ägg",
          confidence: "medium",
        });

        expect(parseIngredient("3 tomater")).toEqual({
          quantity: "3",
          measurement: "",
          name: "tomater",
          confidence: "medium",
        });
      });
    });

    describe("edge cases", () => {
      it("should handle ingredients with additional descriptions", () => {
        expect(parseIngredient("1 kg potatis, skalad")).toEqual({
          quantity: "1",
          measurement: "kg",
          name: "potatis, skalad",
          confidence: "high",
        });

        expect(parseIngredient("200 g smör, rumstempererat")).toEqual({
          quantity: "200",
          measurement: "g",
          name: "smör, rumstempererat",
          confidence: "high",
        });
      });

      it("should handle whitespace", () => {
        expect(parseIngredient("  2 dl mjölk  ")).toEqual({
          quantity: "2",
          measurement: "dl",
          name: "mjölk",
          confidence: "high",
        });
      });

      it("should handle unit-only without name (medium confidence)", () => {
        const result = parseIngredient("2 dl");
        expect(result.quantity).toBe("2");
        expect(result.measurement).toBe("dl");
        expect(result.confidence).toBe("medium");
      });

      it("should be case-insensitive for units", () => {
        expect(parseIngredient("2 DL mjölk")).toEqual({
          quantity: "2",
          measurement: "dl",
          name: "mjölk",
          confidence: "high",
        });

        expect(parseIngredient("500 G flour")).toEqual({
          quantity: "500",
          measurement: "g",
          name: "flour",
          confidence: "high",
        });
      });
    });
  });
});

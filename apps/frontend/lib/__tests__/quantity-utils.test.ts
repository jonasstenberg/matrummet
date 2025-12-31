import { describe, it, expect } from "vitest";
import {
  parseQuantity,
  formatAsFraction,
  scaleQuantity,
} from "../quantity-utils";

describe("quantity-utils", () => {
  describe("parseQuantity", () => {
    it("should return null for empty string", () => {
      expect(parseQuantity("")).toBeNull();
      expect(parseQuantity("   ")).toBeNull();
    });

    it("should parse whole numbers", () => {
      expect(parseQuantity("1")).toBe(1);
      expect(parseQuantity("10")).toBe(10);
      expect(parseQuantity("100")).toBe(100);
    });

    it("should parse decimal numbers with dot", () => {
      expect(parseQuantity("1.5")).toBe(1.5);
      expect(parseQuantity("0.25")).toBe(0.25);
      expect(parseQuantity("2.75")).toBe(2.75);
    });

    it("should parse decimal numbers with comma (Swedish format)", () => {
      expect(parseQuantity("1,5")).toBe(1.5);
      expect(parseQuantity("0,25")).toBe(0.25);
      expect(parseQuantity("2,75")).toBe(2.75);
    });

    it("should parse fraction characters", () => {
      expect(parseQuantity("½")).toBe(0.5);
      expect(parseQuantity("¼")).toBe(0.25);
      expect(parseQuantity("¾")).toBe(0.75);
      expect(parseQuantity("⅓")).toBeCloseTo(1 / 3);
      expect(parseQuantity("⅔")).toBeCloseTo(2 / 3);
    });

    it("should parse whole number with fraction character", () => {
      expect(parseQuantity("1½")).toBe(1.5);
      expect(parseQuantity("2¼")).toBe(2.25);
      expect(parseQuantity("3¾")).toBe(3.75);
      expect(parseQuantity("1⅓")).toBeCloseTo(1 + 1 / 3);
    });

    it("should parse slash fractions", () => {
      expect(parseQuantity("1/2")).toBe(0.5);
      expect(parseQuantity("1/4")).toBe(0.25);
      expect(parseQuantity("3/4")).toBe(0.75);
      expect(parseQuantity("2/3")).toBeCloseTo(2 / 3);
    });

    it("should parse whole number with slash fraction", () => {
      expect(parseQuantity("1 1/2")).toBe(1.5);
      expect(parseQuantity("2 1/4")).toBe(2.25);
      expect(parseQuantity("3 3/4")).toBe(3.75);
    });

    it("should return null for division by zero", () => {
      expect(parseQuantity("1/0")).toBeNull();
      expect(parseQuantity("5 1/0")).toBeNull();
    });

    it("should return null for non-numeric strings", () => {
      expect(parseQuantity("some")).toBeNull();
      expect(parseQuantity("to taste")).toBeNull();
      expect(parseQuantity("lite")).toBeNull();
    });

    it("should handle whitespace", () => {
      expect(parseQuantity("  2  ")).toBe(2);
      expect(parseQuantity("  1 1/2  ")).toBe(1.5);
    });

    it("should parse less common fraction characters", () => {
      expect(parseQuantity("⅛")).toBe(0.125);
      expect(parseQuantity("⅜")).toBe(0.375);
      expect(parseQuantity("⅝")).toBe(0.625);
      expect(parseQuantity("⅞")).toBe(0.875);
      expect(parseQuantity("⅕")).toBe(0.2);
    });
  });

  describe("formatAsFraction", () => {
    it("should return '0' for zero or negative numbers", () => {
      expect(formatAsFraction(0)).toBe("0");
      expect(formatAsFraction(-1)).toBe("0");
    });

    it("should format whole numbers without fractions", () => {
      expect(formatAsFraction(1)).toBe("1");
      expect(formatAsFraction(5)).toBe("5");
      expect(formatAsFraction(10)).toBe("10");
    });

    it("should format common fractions", () => {
      expect(formatAsFraction(0.5)).toBe("½");
      expect(formatAsFraction(0.25)).toBe("¼");
      expect(formatAsFraction(0.75)).toBe("¾");
    });

    it("should format whole numbers with fractions", () => {
      expect(formatAsFraction(1.5)).toBe("1½");
      expect(formatAsFraction(2.25)).toBe("2¼");
      expect(formatAsFraction(3.75)).toBe("3¾");
    });

    it("should format thirds", () => {
      expect(formatAsFraction(1 / 3)).toBe("⅓");
      expect(formatAsFraction(2 / 3)).toBe("⅔");
      expect(formatAsFraction(1 + 1 / 3)).toBe("1⅓");
    });

    it("should format eighths", () => {
      expect(formatAsFraction(0.125)).toBe("⅛");
      expect(formatAsFraction(0.375)).toBe("⅜");
      expect(formatAsFraction(0.625)).toBe("⅝");
      expect(formatAsFraction(0.875)).toBe("⅞");
    });

    it("should format fifths", () => {
      expect(formatAsFraction(0.2)).toBe("⅕");
      expect(formatAsFraction(0.4)).toBe("⅖");
      expect(formatAsFraction(0.6)).toBe("⅗");
      expect(formatAsFraction(0.8)).toBe("⅘");
    });

    it("should fall back to decimal with comma for non-standard fractions", () => {
      // Values outside the 0.05 tolerance of any known fraction
      // 0.93 is 0.055 from ⅞ (0.875), the closest fraction
      expect(formatAsFraction(1.93)).toBe("1,9");
      // 0.96 is 0.085 from ⅞ (0.875)
      expect(formatAsFraction(2.96)).toBe("3");
    });

    it("should round to one decimal place for non-standard values", () => {
      expect(formatAsFraction(1.07)).toBe("1,1"); // Not close to any fraction
      expect(formatAsFraction(2.93)).toBe("2,9"); // Not close to ⅞ (0.875)
    });
  });

  describe("scaleQuantity", () => {
    it("should scale whole numbers", () => {
      expect(scaleQuantity("2", 2)).toBe("4");
      expect(scaleQuantity("3", 3)).toBe("9");
    });

    it("should scale and format fractions", () => {
      expect(scaleQuantity("1", 0.5)).toBe("½");
      expect(scaleQuantity("2", 0.5)).toBe("1");
      expect(scaleQuantity("1", 1.5)).toBe("1½");
    });

    it("should scale fraction inputs", () => {
      expect(scaleQuantity("½", 2)).toBe("1");
      expect(scaleQuantity("1/2", 2)).toBe("1");
      expect(scaleQuantity("1½", 2)).toBe("3");
    });

    it("should return original string for non-numeric quantities", () => {
      expect(scaleQuantity("some", 2)).toBe("some");
      expect(scaleQuantity("to taste", 3)).toBe("to taste");
      expect(scaleQuantity("lite", 0.5)).toBe("lite");
    });

    it("should handle complex scaling", () => {
      expect(scaleQuantity("1 1/2", 2)).toBe("3");
      expect(scaleQuantity("2¼", 2)).toBe("4½");
      expect(scaleQuantity("3", 1 / 3)).toBe("1");
    });

    it("should handle scale factor of 1", () => {
      expect(scaleQuantity("2", 1)).toBe("2");
      expect(scaleQuantity("½", 1)).toBe("½");
    });
  });
});

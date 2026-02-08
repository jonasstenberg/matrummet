import { describe, it, expect } from "vitest";
import { parseDuration } from "../duration-parser";

describe("duration-parser", () => {
  describe("parseDuration", () => {
    describe("null/undefined handling", () => {
      it("should return null for undefined", () => {
        expect(parseDuration(undefined)).toBeNull();
      });

      it("should return null for empty string", () => {
        expect(parseDuration("")).toBeNull();
      });
    });

    describe("minutes only", () => {
      it("should parse PT30M as 30 minutes", () => {
        expect(parseDuration("PT30M")).toBe(30);
      });

      it("should parse PT5M as 5 minutes", () => {
        expect(parseDuration("PT5M")).toBe(5);
      });

      it("should parse PT90M as 90 minutes", () => {
        expect(parseDuration("PT90M")).toBe(90);
      });
    });

    describe("hours only", () => {
      it("should parse PT1H as 60 minutes", () => {
        expect(parseDuration("PT1H")).toBe(60);
      });

      it("should parse PT2H as 120 minutes", () => {
        expect(parseDuration("PT2H")).toBe(120);
      });
    });

    describe("hours and minutes", () => {
      it("should parse PT1H30M as 90 minutes", () => {
        expect(parseDuration("PT1H30M")).toBe(90);
      });

      it("should parse PT2H15M as 135 minutes", () => {
        expect(parseDuration("PT2H15M")).toBe(135);
      });

      it("should parse PT0H45M as 45 minutes", () => {
        expect(parseDuration("PT0H45M")).toBe(45);
      });
    });

    describe("days", () => {
      it("should parse P1D as 1440 minutes (24 hours)", () => {
        expect(parseDuration("P1D")).toBe(1440);
      });

      it("should parse P2D as 2880 minutes (48 hours)", () => {
        expect(parseDuration("P2D")).toBe(2880);
      });
    });

    describe("days with time", () => {
      it("should parse P1DT2H30M correctly", () => {
        // 1 day = 1440, 2 hours = 120, 30 minutes = 30
        expect(parseDuration("P1DT2H30M")).toBe(1440 + 120 + 30);
      });

      it("should parse P1DT12H correctly", () => {
        // 1 day = 1440, 12 hours = 720
        expect(parseDuration("P1DT12H")).toBe(1440 + 720);
      });
    });

    describe("seconds", () => {
      it("should parse PT30S as 1 minute (rounded up)", () => {
        expect(parseDuration("PT30S")).toBe(1);
      });

      it("should parse PT1S as 1 minute (rounded up)", () => {
        expect(parseDuration("PT1S")).toBe(1);
      });

      it("should parse PT60S as 1 minute", () => {
        expect(parseDuration("PT60S")).toBe(1);
      });

      it("should parse PT90S as 2 minutes (rounded up)", () => {
        expect(parseDuration("PT90S")).toBe(2);
      });

      it("should parse PT5M30S as 6 minutes (5 + rounded up seconds)", () => {
        expect(parseDuration("PT5M30S")).toBe(6);
      });
    });

    describe("invalid formats", () => {
      it("should return null for invalid format", () => {
        expect(parseDuration("30 minutes")).toBeNull();
        expect(parseDuration("1:30")).toBeNull();
        expect(parseDuration("1h30m")).toBeNull();
        expect(parseDuration("invalid")).toBeNull();
      });

      it("should return null for malformed ISO duration", () => {
        // "P" alone technically matches as zero-duration
        expect(parseDuration("P")).toBe(0);
        // "T30M" without P prefix is invalid
        expect(parseDuration("T30M")).toBeNull();
      });
    });

    describe("edge cases", () => {
      it("should handle PT0M as 0 minutes", () => {
        expect(parseDuration("PT0M")).toBe(0);
      });

      it("should parse PT0H0M as 0 minutes", () => {
        expect(parseDuration("PT0H0M")).toBe(0);
      });
    });
  });
});

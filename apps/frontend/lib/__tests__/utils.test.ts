import { describe, it, expect } from "vitest";
import { cn, getImageUrl, getImageSrcSet, IMAGE_BLUR_DATA_URL } from "../utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge class names", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("should handle conditional classes", () => {
      expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
      expect(cn("foo", true && "bar", "baz")).toBe("foo bar baz");
    });

    it("should merge Tailwind classes correctly", () => {
      // Later class should override earlier one
      expect(cn("p-4", "p-2")).toBe("p-2");
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("should handle arrays", () => {
      expect(cn(["foo", "bar"])).toBe("foo bar");
    });

    it("should handle objects", () => {
      expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
    });

    it("should handle undefined and null", () => {
      expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
    });
  });

  describe("getImageUrl", () => {
    it("should return null for null input", () => {
      expect(getImageUrl(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(getImageUrl(undefined)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(getImageUrl("")).toBeNull();
    });

    it("should generate URL with default size (full)", () => {
      expect(getImageUrl("abc123")).toBe("/api/images/abc123/full");
    });

    it("should generate URL with thumb size", () => {
      expect(getImageUrl("abc123", "thumb")).toBe("/api/images/abc123/thumb");
    });

    it("should generate URL with small size", () => {
      expect(getImageUrl("abc123", "small")).toBe("/api/images/abc123/small");
    });

    it("should generate URL with medium size", () => {
      expect(getImageUrl("abc123", "medium")).toBe("/api/images/abc123/medium");
    });

    it("should generate URL with large size", () => {
      expect(getImageUrl("abc123", "large")).toBe("/api/images/abc123/large");
    });
  });

  describe("getImageSrcSet", () => {
    it("should return null for null input", () => {
      expect(getImageSrcSet(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(getImageSrcSet(undefined)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(getImageSrcSet("")).toBeNull();
    });

    it("should generate srcset with all sizes", () => {
      const result = getImageSrcSet("abc123");
      expect(result).toBe(
        "/api/images/abc123/thumb 320w, " +
        "/api/images/abc123/small 640w, " +
        "/api/images/abc123/medium 960w, " +
        "/api/images/abc123/large 1280w, " +
        "/api/images/abc123/full 1920w"
      );
    });

    it("should include all expected breakpoints", () => {
      const result = getImageSrcSet("test");
      expect(result).toContain("320w");
      expect(result).toContain("640w");
      expect(result).toContain("960w");
      expect(result).toContain("1280w");
      expect(result).toContain("1920w");
    });
  });

  describe("IMAGE_BLUR_DATA_URL", () => {
    it("should be a valid data URL", () => {
      expect(IMAGE_BLUR_DATA_URL).toMatch(/^data:image\/jpeg;base64,/);
    });

    it("should have base64 encoded content", () => {
      const base64Part = IMAGE_BLUR_DATA_URL.split(",")[1];
      expect(base64Part).toBeTruthy();
      expect(base64Part.length).toBeGreaterThan(0);
    });
  });
});

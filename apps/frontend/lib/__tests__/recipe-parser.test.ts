import { describe, it, expect } from "vitest";
import {
  extractUrl,
  parseJsonLdFromHtml,
  parseJsonLdContent,
  parseJsonLdFromScripts,
} from "../recipe-parser/json-ld";

describe("recipe-parser", () => {
  describe("extractUrl", () => {
    it("should extract URL at start of text with remaining text", () => {
      const result = extractUrl("https://example.com/recipe check this out");
      expect(result.url).toBe("https://example.com/recipe");
      expect(result.remainingText).toBe("check this out");
    });

    it("should extract URL from middle of text", () => {
      const result = extractUrl("Check out https://example.com/recipe please");
      expect(result.url).toBe("https://example.com/recipe");
      expect(result.remainingText).toBe("Check out  please");
    });

    it("should extract URL alone", () => {
      const result = extractUrl("https://example.com/recipe");
      expect(result.url).toBe("https://example.com/recipe");
      expect(result.remainingText).toBe("");
    });

    it("should return null for text with no URL", () => {
      const result = extractUrl("This is just plain text without a link");
      expect(result.url).toBeNull();
      expect(result.remainingText).toBe("This is just plain text without a link");
    });

    it("should extract first URL when multiple URLs present", () => {
      const result = extractUrl(
        "First https://first.com/recipe then https://second.com/recipe"
      );
      expect(result.url).toBe("https://first.com/recipe");
      expect(result.remainingText).toBe("First  then https://second.com/recipe");
    });

    it("should handle http URLs", () => {
      const result = extractUrl("http://insecure.com/recipe");
      expect(result.url).toBe("http://insecure.com/recipe");
      expect(result.remainingText).toBe("");
    });

    it("should handle URLs with query parameters", () => {
      const result = extractUrl("https://example.com/recipe?id=123&format=json");
      expect(result.url).toBe("https://example.com/recipe?id=123&format=json");
      expect(result.remainingText).toBe("");
    });

    it("should handle empty string", () => {
      const result = extractUrl("");
      expect(result.url).toBeNull();
      expect(result.remainingText).toBe("");
    });
  });

  describe("parseJsonLdContent", () => {
    it("should parse direct Recipe @type", () => {
      const json = JSON.stringify({
        "@type": "Recipe",
        name: "Chocolate Cake",
        description: "A delicious chocolate cake",
      });

      const result = parseJsonLdContent(json);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Chocolate Cake");
      expect(result?.["@type"]).toBe("Recipe");
    });

    it("should parse Recipe in @graph array", () => {
      const json = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", name: "Recipe Site" },
          {
            "@type": "Recipe",
            name: "Pasta Carbonara",
            description: "Classic Italian pasta",
          },
          { "@type": "Organization", name: "Food Inc" },
        ],
      });

      const result = parseJsonLdContent(json);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Pasta Carbonara");
      expect(result?.["@type"]).toBe("Recipe");
    });

    it("should return null for invalid JSON", () => {
      const result = parseJsonLdContent("{ invalid json }");
      expect(result).toBeNull();
    });

    it("should return null for non-recipe JSON-LD", () => {
      const json = JSON.stringify({
        "@type": "WebSite",
        name: "Just a website",
      });

      const result = parseJsonLdContent(json);
      expect(result).toBeNull();
    });

    it("should return null for @graph without Recipe", () => {
      const json = JSON.stringify({
        "@graph": [
          { "@type": "WebSite", name: "Recipe Site" },
          { "@type": "Organization", name: "Food Inc" },
        ],
      });

      const result = parseJsonLdContent(json);
      expect(result).toBeNull();
    });

    it("should handle Recipe with full schema.org properties", () => {
      const json = JSON.stringify({
        "@type": "Recipe",
        name: "Swedish Meatballs",
        description: "Traditional Swedish meatballs",
        recipeIngredient: ["500g ground beef", "1 onion"],
        recipeInstructions: [
          { "@type": "HowToStep", text: "Mix the ingredients" },
        ],
        prepTime: "PT30M",
        cookTime: "PT45M",
        recipeYield: "4 servings",
      });

      const result = parseJsonLdContent(json);
      expect(result).not.toBeNull();
      expect(result?.recipeIngredient).toHaveLength(2);
      expect(result?.prepTime).toBe("PT30M");
    });
  });

  describe("parseJsonLdFromScripts", () => {
    it("should find Recipe from array of script contents", () => {
      const scripts = [
        JSON.stringify({ "@type": "WebSite", name: "Site" }),
        JSON.stringify({ "@type": "Recipe", name: "Apple Pie" }),
      ];

      const result = parseJsonLdFromScripts(scripts);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Apple Pie");
    });

    it("should handle null values in array", () => {
      const scripts = [
        null,
        JSON.stringify({ "@type": "Recipe", name: "Banana Bread" }),
        null,
      ];

      const result = parseJsonLdFromScripts(scripts);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Banana Bread");
    });

    it("should return null for empty array", () => {
      const result = parseJsonLdFromScripts([]);
      expect(result).toBeNull();
    });

    it("should return null for array with only invalid JSON", () => {
      const result = parseJsonLdFromScripts(["invalid", "{ broken }"]);
      expect(result).toBeNull();
    });

    it("should return first Recipe when multiple present", () => {
      const scripts = [
        JSON.stringify({ "@type": "Recipe", name: "First Recipe" }),
        JSON.stringify({ "@type": "Recipe", name: "Second Recipe" }),
      ];

      const result = parseJsonLdFromScripts(scripts);
      expect(result?.name).toBe("First Recipe");
    });

    it("should skip invalid JSON and find valid Recipe", () => {
      const scripts = [
        "{ broken json",
        JSON.stringify({ "@type": "Recipe", name: "Valid Recipe" }),
      ];

      const result = parseJsonLdFromScripts(scripts);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Valid Recipe");
    });
  });

  describe("parseJsonLdFromHtml", () => {
    it("should extract direct Recipe @type from HTML", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
            {"@type": "Recipe", "name": "Pancakes", "description": "Fluffy pancakes"}
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = parseJsonLdFromHtml(html);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Pancakes");
    });

    it("should extract Recipe from @graph array in HTML", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [
                {"@type": "WebSite", "name": "Recipes Site"},
                {"@type": "Recipe", "name": "Waffles", "description": "Crispy waffles"}
              ]
            }
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = parseJsonLdFromHtml(html);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Waffles");
    });

    it("should return null when no JSON-LD script tags present", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>No JSON-LD here</title>
        </head>
        <body><p>Just regular HTML</p></body>
        </html>
      `;

      const result = parseJsonLdFromHtml(html);
      expect(result).toBeNull();
    });

    it("should handle invalid JSON in script tag gracefully", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
            { this is not valid json }
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = parseJsonLdFromHtml(html);
      expect(result).toBeNull();
    });

    it("should find Recipe among multiple JSON-LD scripts", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
            {"@type": "Organization", "name": "Food Corp"}
          </script>
          <script type="application/ld+json">
            {"@type": "Recipe", "name": "Cookies", "description": "Chocolate chip cookies"}
          </script>
          <script type="application/ld+json">
            {"@type": "BreadcrumbList", "itemListElement": []}
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = parseJsonLdFromHtml(html);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Cookies");
    });

    it("should handle script tag with single quotes in type attribute", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type='application/ld+json'>
            {"@type": "Recipe", "name": "Brownies"}
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = parseJsonLdFromHtml(html);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Brownies");
    });

    it("should return null for JSON-LD without Recipe type", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
            {"@type": "WebPage", "name": "About Us"}
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = parseJsonLdFromHtml(html);
      expect(result).toBeNull();
    });

    it("should handle multiline JSON in script tag", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "Recipe",
              "name": "Multiline Recipe",
              "description": "A recipe with\\nmultiline content",
              "recipeIngredient": [
                "1 cup flour",
                "2 eggs"
              ]
            }
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = parseJsonLdFromHtml(html);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Multiline Recipe");
      expect(result?.recipeIngredient).toHaveLength(2);
    });

    it("should handle empty HTML", () => {
      const result = parseJsonLdFromHtml("");
      expect(result).toBeNull();
    });

    it("should skip invalid JSON and find valid Recipe in multiple scripts", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
            { broken json here }
          </script>
          <script type="application/ld+json">
            {"@type": "Recipe", "name": "Valid Recipe After Invalid"}
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = parseJsonLdFromHtml(html);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Valid Recipe After Invalid");
    });
  });
});

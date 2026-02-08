import { describe, it, expect, beforeAll } from "vitest";
import {
  autolink,
  nl2br,
  formatMessage,
  renderTemplate,
  registerHelpers,
} from "../template.js";

describe("Template Helpers", () => {
  describe("autolink", () => {
    it("should return empty string for empty input", () => {
      expect(autolink("").toString()).toBe("");
    });

    it("should return empty string for null/undefined input", () => {
      expect(autolink(null as unknown as string)).toBe("");
      expect(autolink(undefined as unknown as string)).toBe("");
    });

    it("should convert http URLs to links", () => {
      const result = autolink("Check out http://example.com for more").toString();
      expect(result).toContain('<a href="http://example.com"');
      expect(result).toContain("http://example.com</a>");
    });

    it("should convert https URLs to links", () => {
      const result = autolink("Visit https://secure.example.com").toString();
      expect(result).toContain('<a href="https://secure.example.com"');
    });

    it("should handle multiple URLs", () => {
      const result = autolink("Visit http://one.com and http://two.com").toString();
      expect(result).toContain('<a href="http://one.com"');
      expect(result).toContain('<a href="http://two.com"');
    });

    it("should preserve non-URL text", () => {
      const result = autolink("Hello world").toString();
      expect(result).toBe("Hello world");
    });

    it("should apply correct styling to links", () => {
      const result = autolink("http://test.com").toString();
      expect(result).toContain('style="color: #3498db; text-decoration: none;"');
    });
  });

  describe("nl2br", () => {
    it("should return empty string for empty input", () => {
      expect(nl2br("").toString()).toBe("");
    });

    it("should return empty string for null/undefined input", () => {
      expect(nl2br(null as unknown as string)).toBe("");
      expect(nl2br(undefined as unknown as string)).toBe("");
    });

    it("should convert single newline to br", () => {
      const result = nl2br("Line 1\nLine 2").toString();
      expect(result).toBe("Line 1<br>Line 2");
    });

    it("should convert multiple newlines to br tags", () => {
      const result = nl2br("Line 1\nLine 2\nLine 3").toString();
      expect(result).toBe("Line 1<br>Line 2<br>Line 3");
    });

    it("should handle text without newlines", () => {
      const result = nl2br("No newlines here").toString();
      expect(result).toBe("No newlines here");
    });
  });

  describe("formatMessage", () => {
    it("should return empty string for empty input", () => {
      expect(formatMessage("").toString()).toBe("");
    });

    it("should return empty string for null/undefined input", () => {
      expect(formatMessage(null as unknown as string)).toBe("");
      expect(formatMessage(undefined as unknown as string)).toBe("");
    });

    it("should convert URLs to links and newlines to br", () => {
      const result = formatMessage("Check http://example.com\nNew line").toString();
      expect(result).toContain('<a href="http://example.com"');
      expect(result).toContain("<br>");
    });

    it("should apply word-break styling for long URLs", () => {
      const result = formatMessage("http://example.com").toString();
      expect(result).toContain("word-break: break-all");
    });
  });
});

describe("renderTemplate", () => {
  beforeAll(() => {
    registerHelpers();
  });

  it("should render simple template with variables", () => {
    const result = renderTemplate("Hello {{name}}", { name: "World" });
    expect(result).toBe("Hello World");
  });

  it("should render template with multiple variables", () => {
    const result = renderTemplate("{{greeting}} {{name}}!", {
      greeting: "Hello",
      name: "User",
    });
    expect(result).toBe("Hello User!");
  });

  it("should handle nested object variables", () => {
    const result = renderTemplate("Welcome {{user.name}}", {
      user: { name: "John" },
    });
    expect(result).toBe("Welcome John");
  });

  it("should handle missing variables gracefully", () => {
    const result = renderTemplate("Hello {{missing}}", {});
    expect(result).toBe("Hello ");
  });

  it("should escape HTML by default", () => {
    const result = renderTemplate("{{content}}", {
      content: "<script>alert('xss')</script>",
    });
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("should allow triple braces for unescaped HTML", () => {
    const result = renderTemplate("{{{content}}}", {
      content: "<strong>Bold</strong>",
    });
    expect(result).toContain("<strong>Bold</strong>");
  });

  it("should work with registered helpers", () => {
    const result = renderTemplate("{{autolink text}}", {
      text: "Visit http://test.com",
    });
    expect(result).toContain('<a href="http://test.com"');
  });

  it("should handle complex email template", () => {
    const template = `
      <h1>Hello {{name}}</h1>
      <p>{{formatMessage message}}</p>
      <p>Event: {{event.title}} at {{event.location}}</p>
    `;
    const result = renderTemplate(template, {
      name: "User",
      message: "Check http://example.com\nfor details",
      event: { title: "Meeting", location: "Room A" },
    });
    expect(result).toContain("Hello User");
    expect(result).toContain("Meeting");
    expect(result).toContain("Room A");
    expect(result).toContain('<a href="http://example.com"');
    expect(result).toContain("<br>");
  });
});

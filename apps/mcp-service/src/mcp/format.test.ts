import { describe, expect, it } from "vitest";

import { capResult } from "./format.js";

// test-setup sets MCP_MAX_RESULT_CHARS = 1500
describe("capResult", () => {
  it("returns a small array whole and valid", () => {
    const data = [{ id: 1 }, { id: 2 }];
    expect(JSON.parse(capResult(data))).toEqual(data);
  });

  it("truncates a large array by item count, keeping valid JSON + a page note", () => {
    const data = Array.from({ length: 200 }, (_, i) => ({ id: i, name: "recipe ".repeat(8) }));
    const out = capResult(data);
    expect(out).toContain("[Truncated:");
    const json = out.slice(0, out.indexOf("\n\n[Truncated:"));
    const parsed = JSON.parse(json) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.length).toBeLessThan(data.length);
  });

  it("keeps at least one row even if a single row exceeds the cap (no false note)", () => {
    const big = { id: 1, blob: "x".repeat(5000) };
    const out = capResult([big]);
    expect(out).not.toContain("[Truncated:");
    expect(JSON.parse(out)).toEqual([big]);
  });

  it("never slices a non-array result mid-JSON — returns it whole", () => {
    const obj = { plan: "x".repeat(5000) };
    const out = capResult(obj);
    expect(out).not.toContain("[Truncated");
    expect(JSON.parse(out)).toEqual(obj);
  });

  it("handles null and strings", () => {
    expect(capResult(null)).toBe("(no result)");
    expect(capResult("hello")).toBe("hello");
  });
});

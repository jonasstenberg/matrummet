import { config } from "../config.js";

/**
 * Serialize a tool result. The only results that get large in this API are
 * arrays (recipe lists / searches), so we cap ONLY arrays — by item count, so
 * the emitted JSON stays valid (never sliced mid-body) — keeping at least one
 * row and appending a note to page. Non-array results pass through untouched.
 */
export function capResult(data: unknown): string {
  const max = config.maxResultChars;
  if (Array.isArray(data)) {
    const full = JSON.stringify(data, null, 2);
    if (full.length <= max) return full;
    const kept: unknown[] = [];
    let size = 2;
    for (const item of data) {
      const piece = JSON.stringify(item).length + 2;
      if (kept.length > 0 && size + piece > max) break;
      kept.push(item);
      size += piece;
    }
    const json = JSON.stringify(kept, null, 2);
    if (kept.length === data.length) return json;
    return (
      `${json}\n\n` +
      `[Truncated: returned ${String(kept.length)} of ${String(data.length)} rows ` +
      `(result exceeded ${String(max)} chars). Pass a smaller limit, an offset, or a ` +
      `narrower query to page through the rest.]`
    );
  }
  if (data === null || data === undefined) return "(no result)";
  if (typeof data === "string") return data;
  return JSON.stringify(data, null, 2);
}

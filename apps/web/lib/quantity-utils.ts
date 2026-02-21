// Fraction characters mapped to their decimal values
const FRACTION_MAP: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅐": 1 / 7,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
  "⅑": 1 / 9,
  "⅒": 0.1,
};

// Reverse mapping: decimal to fraction character (ordered by priority)
const DECIMAL_TO_FRACTION: [number, string][] = [
  [0.5, "½"],
  [0.25, "¼"],
  [0.75, "¾"],
  [1 / 3, "⅓"],
  [2 / 3, "⅔"],
  [0.125, "⅛"],
  [0.375, "⅜"],
  [0.625, "⅝"],
  [0.875, "⅞"],
  [0.2, "⅕"],
  [0.4, "⅖"],
  [0.6, "⅗"],
  [0.8, "⅘"],
  [1 / 6, "⅙"],
  [5 / 6, "⅚"],
];

/**
 * Parse a quantity string into a number.
 * Handles: "1", "1.5", "1/2", "1 1/2", "½", "1½", etc.
 * Returns null for non-numeric quantities (e.g., "some", "to taste")
 */
export function parseQuantity(str: string): number | null {
  if (!str || str.trim() === "") return null;

  const trimmed = str.trim();

  // Check for fraction characters (e.g., "½", "1½")
  for (const [fractionChar, fractionValue] of Object.entries(FRACTION_MAP)) {
    if (trimmed.includes(fractionChar)) {
      const parts = trimmed.split(fractionChar);
      const wholePart = parts[0].trim();
      const whole = wholePart ? parseFloat(wholePart) : 0;
      if (isNaN(whole)) return null;
      return whole + fractionValue;
    }
  }

  // Check for "1/2" style fractions
  if (trimmed.includes("/")) {
    // Could be "1 1/2" or "1/2"
    const spaceMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (spaceMatch) {
      const whole = parseInt(spaceMatch[1], 10);
      const num = parseInt(spaceMatch[2], 10);
      const denom = parseInt(spaceMatch[3], 10);
      if (denom === 0) return null;
      return whole + num / denom;
    }

    const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
    if (fractionMatch) {
      const num = parseInt(fractionMatch[1], 10);
      const denom = parseInt(fractionMatch[2], 10);
      if (denom === 0) return null;
      return num / denom;
    }
  }

  // Try parsing as a regular number
  const num = parseFloat(trimmed.replace(",", "."));
  if (isNaN(num)) return null;

  return num;
}

/**
 * Format a number as a fraction string for display.
 * E.g., 1.5 -> "1½", 0.25 -> "¼", 2.333 -> "2⅓"
 */
export function formatAsFraction(num: number): string {
  if (num <= 0) return "0";

  const whole = Math.floor(num);
  const decimal = num - whole;

  // If it's a whole number, return as-is
  if (decimal < 0.01) {
    return whole.toString();
  }

  // Find the closest fraction
  let closestFraction = "";
  let closestDiff = 1;

  for (const [fractionValue, fractionChar] of DECIMAL_TO_FRACTION) {
    const diff = Math.abs(decimal - fractionValue);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestFraction = fractionChar;
    }
  }

  // If close enough to a known fraction (within 0.05), use it
  if (closestDiff < 0.05 && closestFraction) {
    if (whole === 0) {
      return closestFraction;
    }
    return `${whole}${closestFraction}`;
  }

  // Otherwise, round to one decimal place
  const rounded = Math.round(num * 10) / 10;
  // Use comma as decimal separator for Swedish locale
  return rounded.toString().replace(".", ",");
}

/**
 * Scale a quantity string by a factor and return the formatted result.
 * Returns the original string if the quantity cannot be parsed.
 */
export function scaleQuantity(
  originalQuantity: string,
  scaleFactor: number
): string {
  const parsed = parseQuantity(originalQuantity);

  if (parsed === null) {
    // Non-numeric quantity (e.g., "some", "to taste")
    return originalQuantity;
  }

  const scaled = parsed * scaleFactor;
  return formatAsFraction(scaled);
}

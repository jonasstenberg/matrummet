/**
 * Test helper utilities and assertions
 */

import { expect } from "vitest";
import type { PostgrestResponse } from "./setup";

/**
 * Assert that a PostgREST response was successful
 */
export function expectSuccess<T>(
  response: PostgrestResponse<T>,
  message?: string
): asserts response is PostgrestResponse<T> & { data: T; error: null } {
  if (response.error) {
    const errorMsg = message
      ? `${message}: ${response.error.message}`
      : response.error.message;
    throw new Error(errorMsg);
  }
  expect(response.error).toBeNull();
  expect(response.data).not.toBeNull();
}

/**
 * Assert that a PostgREST response was an error
 */
export function expectError(
  response: PostgrestResponse<unknown>,
  expectedCode?: string
): void {
  expect(response.error).not.toBeNull();
  if (expectedCode) {
    expect(response.error?.code).toBe(expectedCode);
  }
}

/**
 * Assert that a PostgREST response has no error (for void-returning functions)
 *
 * Use this instead of expectSuccess for RPC functions that return void,
 * as those functions return null data on success.
 */
export function expectNoError(response: PostgrestResponse<unknown>): void {
  if (response.error) {
    throw new Error(`Unexpected error: ${response.error.message}`);
  }
  expect(response.error).toBeNull();
}

/**
 * Assert that an RLS policy blocked the operation
 * PostgREST returns empty array or null for blocked reads,
 * and 0 affected rows for blocked writes
 */
export function expectRlsBlocked(response: PostgrestResponse<unknown>): void {
  if (Array.isArray(response.data)) {
    expect(response.data).toHaveLength(0);
  } else if (response.data === null) {
    // This is expected for blocked operations
    expect(response.data).toBeNull();
  } else {
    // For updates/deletes that return representation, check for empty
    expect(response.data).toBeFalsy();
  }
}

/**
 * Assert that a response contains a valid UUID
 */
export function expectValidUuid(value: unknown): asserts value is string {
  expect(typeof value).toBe("string");
  expect(value).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  );
}

/**
 * Assert that a response matches the expected recipe shape
 */
export function expectRecipeShape(recipe: unknown): void {
  expect(recipe).toMatchObject({
    id: expect.any(String),
    name: expect.any(String),
    description: expect.any(String),
    owner: expect.any(String),
  });

  const r = recipe as Record<string, unknown>;

  // Arrays should be present
  expect(Array.isArray(r.categories)).toBe(true);
  expect(Array.isArray(r.ingredients)).toBe(true);
  expect(Array.isArray(r.instructions)).toBe(true);
}

/**
 * Assert that a response matches the expected shopping list item shape
 */
export function expectShoppingListItemShape(item: unknown): void {
  expect(item).toMatchObject({
    id: expect.any(String),
    shopping_list_id: expect.any(String),
    display_name: expect.any(String),
    quantity: expect.any(Number),
    is_checked: expect.any(Boolean),
  });
}

/**
 * Assert that a response matches the expected user shape
 */
export function expectUserShape(user: unknown): void {
  expect(user).toMatchObject({
    id: expect.any(String),
    name: expect.any(String),
    email: expect.any(String),
  });
}

/**
 * Assert that a response matches the expected home shape
 */
export function expectHomeShape(home: unknown): void {
  expect(home).toMatchObject({
    id: expect.any(String),
    name: expect.any(String),
  });
}

/**
 * Assert that a response matches the expected pantry item shape
 */
export function expectPantryItemShape(item: unknown): void {
  expect(item).toMatchObject({
    id: expect.any(String),
    food_id: expect.any(String),
    food_name: expect.any(String),
  });
}

/**
 * Assert that a response matches the expected API key shape
 */
export function expectApiKeyShape(key: unknown): void {
  expect(key).toMatchObject({
    id: expect.any(String),
    name: expect.any(String),
    prefix: expect.any(String),
  });
}

/**
 * Assert that a response matches the expected food shape
 */
export function expectFoodShape(food: unknown): void {
  expect(food).toMatchObject({
    id: expect.any(String),
    name: expect.any(String),
  });
}

/**
 * Assert that a response matches the expected unit shape
 */
export function expectUnitShape(unit: unknown): void {
  expect(unit).toMatchObject({
    id: expect.any(String),
    name: expect.any(String),
  });
}

/**
 * Assert that a response matches the expected invitation shape
 */
export function expectInvitationShape(invitation: unknown): void {
  expect(invitation).toMatchObject({
    id: expect.any(String),
    home_id: expect.any(String),
    invited_email: expect.any(String),
    status: expect.stringMatching(/^(pending|accepted|declined|expired|cancelled)$/),
  });
}

/**
 * Create a delay promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
  }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const initialDelay = options?.initialDelay ?? 100;
  const maxDelay = options?.maxDelay ?? 5000;

  let lastError: Error | undefined;
  let currentDelay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await delay(currentDelay);
        currentDelay = Math.min(currentDelay * 2, maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Generate a random email for testing
 */
export function randomEmail(): string {
  const id = Math.random().toString(36).slice(2, 10);
  return `test-${id}@example.com`;
}

/**
 * Generate a random string
 */
export function randomString(length = 8): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length);
}

/**
 * Type guard for checking if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep pick specific keys from an object
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from an object
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

/**
 * Compare two objects for structural equality (ignoring extra keys in actual)
 */
export function matchesShape(
  actual: unknown,
  expected: Record<string, unknown>
): boolean {
  if (!isObject(actual)) {
    return false;
  }

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];

    if (expectedValue === null) {
      if (actualValue !== null) return false;
    } else if (typeof expectedValue === "object") {
      if (!matchesShape(actualValue, expectedValue as Record<string, unknown>)) {
        return false;
      }
    } else if (typeof expectedValue === "function") {
      // Matcher function
      if (!(expectedValue as (v: unknown) => boolean)(actualValue)) {
        return false;
      }
    } else {
      if (actualValue !== expectedValue) return false;
    }
  }

  return true;
}

/**
 * Matcher for any string
 */
export const anyString = (): ((v: unknown) => boolean) => {
  return (v) => typeof v === "string";
};

/**
 * Matcher for any number
 */
export const anyNumber = (): ((v: unknown) => boolean) => {
  return (v) => typeof v === "number";
};

/**
 * Matcher for any boolean
 */
export const anyBoolean = (): ((v: unknown) => boolean) => {
  return (v) => typeof v === "boolean";
};

/**
 * Matcher for any array
 */
export const anyArray = (): ((v: unknown) => boolean) => {
  return (v) => Array.isArray(v);
};

/**
 * Matcher for optional value (null or type)
 */
export const optional = (
  matcher: (v: unknown) => boolean
): ((v: unknown) => boolean) => {
  return (v) => v === null || matcher(v);
};

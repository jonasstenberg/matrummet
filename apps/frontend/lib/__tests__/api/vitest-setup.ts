/**
 * Vitest global setup for API tests
 */

import { beforeAll, afterAll } from "vitest";
import { globalSetup, globalTeardown } from "./setup";

beforeAll(async () => {
  await globalSetup();
});

afterAll(async () => {
  await globalTeardown();
});

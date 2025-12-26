// Test utilities
export {
  createMockRequest,
  createMockResponse,
  createMockNext,
  wait,
  createDeferred,
  randomString,
  randomEmail,
  randomUuid,
} from "./utils/index.js";

// Common mocks
export {
  createMockLogger,
  createMockPgClient,
  createMockPgPool,
  createMockFile,
  createMockAxios,
} from "./mocks/index.js";

// Vitest config creators (re-exported for convenience)
export { createNodeTestConfig } from "./vitest/node.js";
export { createJsdomTestConfig } from "./vitest/jsdom.js";

// Types
export type { NodeTestConfigOptions } from "./vitest/node.js";
export type { JsdomTestConfigOptions } from "./vitest/jsdom.js";

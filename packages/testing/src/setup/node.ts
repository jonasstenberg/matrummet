import { vi, beforeEach, afterEach } from "vitest";

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Suppress console output during tests (optional - can be overridden)
if (process.env.SUPPRESS_CONSOLE !== "false") {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // Keep console.error for debugging test failures
}

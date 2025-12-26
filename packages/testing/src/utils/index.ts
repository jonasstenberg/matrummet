import { vi, type Mock } from "vitest";

interface MockRequest {
  body: Record<string, unknown>;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, string>;
  get: Mock;
  [key: string]: unknown;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Creates a mock Express request object
 */
export function createMockRequest(overrides: Record<string, unknown> = {}): MockRequest {
  const headers: Record<string, string> = isStringRecord(overrides.headers)
    ? overrides.headers
    : {};
  return {
    body: {},
    params: {},
    query: {},
    headers,
    get: vi.fn((header: string) => headers[header]),
    ...overrides,
  };
}

interface MockResponse {
  status: Mock;
  json: Mock;
  send: Mock;
  set: Mock;
  setHeader: Mock;
  end: Mock;
}

/**
 * Creates a mock Express response object
 */
export function createMockResponse(): MockResponse {
  const res: MockResponse = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    set: vi.fn(),
    setHeader: vi.fn(),
    end: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  res.set.mockReturnValue(res);
  res.setHeader.mockReturnValue(res);
  res.end.mockReturnValue(res);
  return res;
}

/**
 * Creates a mock Express next function
 */
export function createMockNext(): Mock {
  return vi.fn();
}

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

/**
 * Creates a deferred promise for testing async behavior
 */
export function createDeferred<T = void>(): Deferred<T> {
  let resolveRef: ((value: T) => void) | undefined;
  let rejectRef: ((reason?: unknown) => void) | undefined;

  const promise = new Promise<T>((res, rej) => {
    resolveRef = res;
    rejectRef = rej;
  });

  // The Promise executor runs synchronously, so these are guaranteed to be set
  const resolve = (value: T): void => {
    if (resolveRef) resolveRef(value);
  };
  const reject = (reason?: unknown): void => {
    if (rejectRef) rejectRef(reason);
  };

  return {
    promise,
    resolve,
    reject,
  };
}

/**
 * Generates a random string for test data
 */
export function randomString(length = 10): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/**
 * Generates a random email for test data
 */
export function randomEmail(): string {
  return `test-${randomString(8)}@example.com`;
}

/**
 * Generates a UUID v4 for test data
 */
export function randomUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

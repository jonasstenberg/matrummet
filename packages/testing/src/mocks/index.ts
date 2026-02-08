import { vi, type Mock } from "vitest";

interface MockLogger {
  info: Mock;
  error: Mock;
  warn: Mock;
  debug: Mock;
  trace: Mock;
  fatal: Mock;
  child: Mock;
}

/**
 * Creates a mock pino logger
 */
export function createMockLogger(): MockLogger {
  const logger: MockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger;
}

interface MockPgClient {
  query: Mock;
  connect: Mock;
  end: Mock;
  release: Mock;
  on: Mock;
}

/**
 * Creates a mock PostgreSQL client
 */
export function createMockPgClient(): MockPgClient {
  return {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    release: vi.fn(),
    on: vi.fn(),
  };
}

interface MockPgPool {
  query: Mock;
  connect: Mock;
  end: Mock;
  on: Mock;
  _mockClient: MockPgClient;
}

/**
 * Creates a mock PostgreSQL pool
 */
export function createMockPgPool(): MockPgPool {
  const mockClient = createMockPgClient();
  return {
    query: vi.fn(),
    connect: vi.fn().mockResolvedValue(mockClient),
    end: vi.fn(),
    on: vi.fn(),
    _mockClient: mockClient,
  };
}

export interface MockFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

/**
 * Creates a mock file object for upload testing
 */
export function createMockFile(overrides: Partial<MockFile> = {}): MockFile {
  return {
    fieldname: "file",
    originalname: "test-file.jpg",
    encoding: "7bit",
    mimetype: "image/jpeg",
    size: 1024,
    destination: "/tmp/uploads",
    filename: "abc123.jpg",
    path: "/tmp/uploads/abc123.jpg",
    buffer: Buffer.from("test"),
    ...overrides,
  };
}

interface MockAxios {
  get: Mock;
  post: Mock;
  put: Mock;
  patch: Mock;
  delete: Mock;
  request: Mock;
  defaults: {
    headers: {
      common: Record<string, string>;
    };
  };
  interceptors: {
    request: { use: Mock; eject: Mock };
    response: { use: Mock; eject: Mock };
  };
}

/**
 * Creates a mock Axios instance
 */
export function createMockAxios(): MockAxios {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    defaults: {
      headers: {
        common: {},
      },
    },
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  };
}

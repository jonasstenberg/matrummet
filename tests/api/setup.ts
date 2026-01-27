/**
 * Test infrastructure for PostgREST API tests
 *
 * Provides:
 * - PostgREST client factory with JWT authentication
 * - Test user management
 * - Database seeding utilities
 */

import { SignJWT } from "jose";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { beforeAll, afterAll } from "vitest";

// Test environment configuration
export const TEST_CONFIG = {
  POSTGREST_URL: process.env.TEST_POSTGREST_URL || "http://localhost:4445",
  JWT_SECRET:
    process.env.TEST_JWT_SECRET ||
    "recept-jwt-secret-change-in-production-min-32-chars",
  DB_HOST: process.env.TEST_DB_HOST || "localhost",
  DB_PORT: process.env.TEST_DB_PORT || "5432",
  DB_NAME: process.env.TEST_DB_NAME || "recept",
  DB_USER: process.env.TEST_DB_USER || "recept",
  DB_PASSWORD: process.env.TEST_DB_PASSWORD || "recept",
};

// Test user definitions
export const TEST_USERS = {
  userA: {
    email: "test-user-a@example.com",
    name: "Test User A",
    password: "TestPassword123!",
  },
  userB: {
    email: "test-user-b@example.com",
    name: "Test User B",
    password: "TestPassword456!",
  },
  admin: {
    email: "test-admin@example.com",
    name: "Test Admin",
    password: "AdminPassword789!",
    role: "admin" as const,
  },
};

/**
 * Sign a PostgREST JWT token for a user
 */
export async function signPostgrestToken(
  email: string,
  role: "authenticated" | "anon" = "authenticated"
): Promise<string> {
  const secret = new TextEncoder().encode(TEST_CONFIG.JWT_SECRET);

  const token = await new SignJWT({ email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

  return token;
}

/**
 * PostgREST client for making API calls
 */
export interface PostgrestClient {
  /**
   * Call an RPC function
   */
  rpc: <T = unknown>(
    functionName: string,
    params?: Record<string, unknown>
  ) => Promise<PostgrestResponse<T>>;

  /**
   * Query a table or view
   */
  from: (table: string) => PostgrestQueryBuilder;

  /**
   * Get the current JWT token
   */
  getToken: () => string | null;
}

export interface PostgrestResponse<T = unknown> {
  data: T | null;
  error: PostgrestError | null;
  status: number;
  count?: number;
}

export interface PostgrestError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

export interface PostgrestQueryBuilder {
  select: (columns?: string) => PostgrestQueryBuilder;
  insert: (data: Record<string, unknown> | Record<string, unknown>[]) => PostgrestQueryBuilder;
  update: (data: Record<string, unknown>) => PostgrestQueryBuilder;
  delete: () => PostgrestQueryBuilder;
  eq: (column: string, value: unknown) => PostgrestQueryBuilder;
  neq: (column: string, value: unknown) => PostgrestQueryBuilder;
  gt: (column: string, value: unknown) => PostgrestQueryBuilder;
  lt: (column: string, value: unknown) => PostgrestQueryBuilder;
  gte: (column: string, value: unknown) => PostgrestQueryBuilder;
  lte: (column: string, value: unknown) => PostgrestQueryBuilder;
  like: (column: string, pattern: string) => PostgrestQueryBuilder;
  ilike: (column: string, pattern: string) => PostgrestQueryBuilder;
  is: (column: string, value: null | boolean) => PostgrestQueryBuilder;
  in: (column: string, values: unknown[]) => PostgrestQueryBuilder;
  cs: (column: string, values: unknown[]) => PostgrestQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => PostgrestQueryBuilder;
  limit: (count: number) => PostgrestQueryBuilder;
  single: () => PostgrestQueryBuilder;
  maybeSingle: () => PostgrestQueryBuilder;
  then: <T = unknown>(
    resolve: (value: PostgrestResponse<T>) => void
  ) => Promise<PostgrestResponse<T>>;
}

/**
 * Create a PostgREST client
 */
export function createClient(options?: {
  jwt?: string | null;
  email?: string;
}): PostgrestClient {
  const token: string | null = options?.jwt ?? null;

  const getHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  };

  const rpc = async <T = unknown>(
    functionName: string,
    params?: Record<string, unknown>
  ): Promise<PostgrestResponse<T>> => {
    const response = await fetch(
      `${TEST_CONFIG.POSTGREST_URL}/rpc/${functionName}`,
      {
        method: "POST",
        headers: getHeaders(),
        body: params ? JSON.stringify(params) : undefined,
      }
    );

    const status = response.status;

    if (!response.ok) {
      const errorText = await response.text();
      let error: PostgrestError;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { message: errorText };
      }
      return { data: null, error, status };
    }

    const text = await response.text();
    if (!text) {
      return { data: null, error: null, status };
    }

    try {
      const data = JSON.parse(text) as T;
      return { data, error: null, status };
    } catch {
      return { data: text as unknown as T, error: null, status };
    }
  };

  const from = (table: string): PostgrestQueryBuilder => {
    let method: "GET" | "POST" | "PATCH" | "DELETE" = "GET";
    let body: Record<string, unknown> | Record<string, unknown>[] | undefined;
    const filters: string[] = [];
    let selectColumns = "*";
    let orderClause = "";
    let limitCount: number | undefined;
    let returnSingle = false;
    let returnMaybeSingle = false;
    let prefer = "";

    const builder: PostgrestQueryBuilder = {
      select(columns = "*") {
        // Only set method to GET if no write operation has been set
        // This allows chaining like .update().select() to return the updated rows
        if (method === "GET") {
          method = "GET";
        }
        selectColumns = columns;
        return builder;
      },
      insert(data) {
        method = "POST";
        body = data;
        prefer = "return=representation";
        return builder;
      },
      update(data) {
        method = "PATCH";
        body = data;
        prefer = "return=representation";
        return builder;
      },
      delete() {
        method = "DELETE";
        prefer = "return=representation";
        return builder;
      },
      eq(column, value) {
        filters.push(`${column}=eq.${encodeURIComponent(String(value))}`);
        return builder;
      },
      neq(column, value) {
        filters.push(`${column}=neq.${encodeURIComponent(String(value))}`);
        return builder;
      },
      gt(column, value) {
        filters.push(`${column}=gt.${encodeURIComponent(String(value))}`);
        return builder;
      },
      lt(column, value) {
        filters.push(`${column}=lt.${encodeURIComponent(String(value))}`);
        return builder;
      },
      gte(column, value) {
        filters.push(`${column}=gte.${encodeURIComponent(String(value))}`);
        return builder;
      },
      lte(column, value) {
        filters.push(`${column}=lte.${encodeURIComponent(String(value))}`);
        return builder;
      },
      like(column, pattern) {
        filters.push(`${column}=like.${encodeURIComponent(pattern)}`);
        return builder;
      },
      ilike(column, pattern) {
        filters.push(`${column}=ilike.${encodeURIComponent(pattern)}`);
        return builder;
      },
      is(column, value) {
        filters.push(`${column}=is.${value}`);
        return builder;
      },
      in(column, values) {
        const formattedValues = values.map((v) => encodeURIComponent(String(v))).join(",");
        filters.push(`${column}=in.(${formattedValues})`);
        return builder;
      },
      cs(column, values) {
        const formattedValues = values.map((v) => `"${v}"`).join(",");
        filters.push(`${column}=cs.{${formattedValues}}`);
        return builder;
      },
      order(column, options) {
        const direction = options?.ascending === false ? "desc" : "asc";
        orderClause = `order=${column}.${direction}`;
        return builder;
      },
      limit(count) {
        limitCount = count;
        return builder;
      },
      single() {
        returnSingle = true;
        return builder;
      },
      maybeSingle() {
        returnMaybeSingle = true;
        return builder;
      },
      async then<T = unknown>(
        resolve: (value: PostgrestResponse<T>) => void
      ): Promise<PostgrestResponse<T>> {
        const queryParams: string[] = [`select=${encodeURIComponent(selectColumns)}`];

        queryParams.push(...filters);

        if (orderClause) {
          queryParams.push(orderClause);
        }

        if (limitCount !== undefined) {
          queryParams.push(`limit=${limitCount}`);
        }

        const url = `${TEST_CONFIG.POSTGREST_URL}/${table}?${queryParams.join("&")}`;

        const headers = getHeaders();
        if (prefer) {
          headers["Prefer"] = prefer;
        }
        if (returnSingle || returnMaybeSingle) {
          headers["Accept"] = "application/vnd.pgrst.object+json";
        }

        // Don't send body with GET/HEAD requests (Node fetch throws an error)
        const fetchOptions: RequestInit = {
          method,
          headers,
        };
        if (body && method !== "GET" && method !== "HEAD") {
          fetchOptions.body = JSON.stringify(body);
        }
        const response = await fetch(url, fetchOptions);

        const status = response.status;

        if (!response.ok) {
          const errorText = await response.text();
          let error: PostgrestError;
          try {
            error = JSON.parse(errorText);
          } catch {
            error = { message: errorText };
          }

          if (returnMaybeSingle && status === 406) {
            // No rows returned
            const result = { data: null, error: null, status: 200 } as PostgrestResponse<T>;
            resolve(result);
            return result;
          }

          const result = { data: null, error, status } as PostgrestResponse<T>;
          resolve(result);
          return result;
        }

        const text = await response.text();
        if (!text) {
          const result = { data: (method === "GET" ? [] : null) as T, error: null, status } as PostgrestResponse<T>;
          resolve(result);
          return result;
        }

        try {
          const data = JSON.parse(text) as T;
          const result = { data, error: null, status } as PostgrestResponse<T>;
          resolve(result);
          return result;
        } catch {
          const result = { data: text as unknown as T, error: null, status } as PostgrestResponse<T>;
          resolve(result);
          return result;
        }
      },
    };

    return builder;
  };

  // If email provided, sign token asynchronously
  if (options?.email && !token) {
    // We need to handle this differently since we can't use await in constructor
    // The caller should use createAuthenticatedClient instead
  }

  return {
    rpc,
    from,
    getToken: () => token,
  };
}

/**
 * Create an authenticated client for a specific user email
 */
export async function createAuthenticatedClient(
  email: string
): Promise<PostgrestClient> {
  const token = await signPostgrestToken(email);
  return createClient({ jwt: token });
}

/**
 * Create an anonymous client (no JWT)
 */
export function createAnonymousClient(): PostgrestClient {
  return createClient({ jwt: null });
}

/**
 * Seed the admin test user via direct SQL.
 * Uses psql to INSERT/UPDATE the admin user with role='admin'.
 * This must run before tests because signup() assigns role='user'.
 */
function seedAdminUser(): void {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = TEST_CONFIG;
  const sqlFile = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "seed-admin.sql"
  );
  try {
    execSync(
      `psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -f ${sqlFile}`,
      {
        env: { ...process.env, PGPASSWORD: DB_PASSWORD },
        stdio: "pipe",
        timeout: 10000,
      }
    );
  } catch {
    // psql not available — assume admin was seeded externally (e.g. CI step)
  }
}

/**
 * Global test setup - run once before all tests
 */
export async function globalSetup(): Promise<void> {
  // Verify PostgREST is accessible
  try {
    const response = await fetch(`${TEST_CONFIG.POSTGREST_URL}/`);
    if (!response.ok) {
      throw new Error(`PostgREST not accessible: ${response.status}`);
    }
  } catch (error) {
    throw new Error(
      `PostgREST connection failed at ${TEST_CONFIG.POSTGREST_URL}: ${error}`
    );
  }

  // Seed admin user with role='admin' via direct SQL
  seedAdminUser();
}

/**
 * Global test teardown - run once after all tests
 * Cleans up test users and their associated data
 */
export async function globalTeardown(): Promise<void> {
  const testUsers = [
    { email: TEST_USERS.userA.email, password: TEST_USERS.userA.password },
    { email: TEST_USERS.userB.email, password: TEST_USERS.userB.password },
    { email: TEST_USERS.admin.email, password: TEST_USERS.admin.password },
  ];

  for (const { email, password } of testUsers) {
    try {
      const client = await createAuthenticatedClient(email);

      // Delete user account (requires password, cascades to most related data)
      const deleteResult = await client.rpc("delete_account", {
        p_password: password,
      });

      // Only log successful deletions - failures are expected when user doesn't exist
      if (!deleteResult.error) {
        console.log(`[Test Cleanup] Deleted user: ${email}`);
      }
    } catch {
      // Auth failed - user doesn't exist, which is expected
    }
  }
}

/**
 * Setup hooks for test files
 */
export function setupTestHooks(): void {
  beforeAll(async () => {
    await globalSetup();
  });

  afterAll(async () => {
    await globalTeardown();
  });
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  options?: { timeout?: number; interval?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 5000;
  const interval = options?.interval ?? 100;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

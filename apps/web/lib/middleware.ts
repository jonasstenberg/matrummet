import { createMiddleware } from '@tanstack/react-start'
import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { getSession, signPostgrestToken, type JWTPayload } from '@/lib/auth'

// ---------------------------------------------------------------------------
// Server function middleware (for use with createServerFn().middleware([...]))
// ---------------------------------------------------------------------------

/**
 * Middleware that requires authentication for server functions.
 * Adds `session` to the server function context.
 * **Throws redirect** — use only in `beforeLoad` or loader contexts.
 *
 * Usage:
 *   const myFn = createServerFn({ method: 'GET' })
 *     .middleware([authMiddleware])
 *     .handler(async ({ context }) => {
 *       const { session } = context // JWTPayload
 *     })
 */
export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return next({ context: { session } })
  },
)

/**
 * Middleware that requires admin authentication for server functions.
 * Adds `session` to the server function context.
 * **Throws redirect** — use only in `beforeLoad` or loader contexts.
 *
 * Usage:
 *   const myFn = createServerFn({ method: 'GET' })
 *     .middleware([adminMiddleware])
 *     .handler(async ({ context }) => {
 *       const { session } = context // JWTPayload with role === 'admin'
 *     })
 */
export const adminMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login', search: { returnUrl: '/admin' } })
    }
    if (session.role !== 'admin') {
      throw redirect({ to: '/' })
    }
    return next({ context: { session } })
  },
)

// ---------------------------------------------------------------------------
// Action middleware (for use with server function actions)
// These do NOT redirect — they provide token/session via context so handlers
// can return `{ error: '...' }` objects that the UI consumes.
// ---------------------------------------------------------------------------

/**
 * Middleware for server function actions that need authentication.
 * Resolves session and PostgREST token, providing both via context.
 * Does **not** redirect or throw on auth failure — the handler must check
 * `context.postgrestToken` and return an error object if null.
 *
 * Usage:
 *   const myFn = createServerFn({ method: 'POST' })
 *     .middleware([actionAuthMiddleware])
 *     .handler(async ({ context }) => {
 *       if (!context.postgrestToken) return { error: 'Du måste vara inloggad' }
 *       // context.postgrestToken is a valid PostgREST JWT string
 *       // context.session is the user's JWTPayload
 *     })
 */
export const actionAuthMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await getSession()
    let postgrestToken: string | null = null

    if (session?.email) {
      postgrestToken = await signPostgrestToken(session.email, session.role)
    }

    return next({ context: { session, postgrestToken } })
  },
)

/**
 * Middleware for admin server function actions.
 * Resolves session and PostgREST token (with admin role), providing both
 * via context. Does **not** redirect or throw on auth/role failure.
 *
 * Usage:
 *   const myFn = createServerFn({ method: 'POST' })
 *     .middleware([actionAdminMiddleware])
 *     .handler(async ({ context }) => {
 *       if (!context.postgrestToken) return { success: false, error: 'Unauthorized' }
 *       // context.postgrestToken is a valid admin PostgREST JWT string
 *       // context.session is the admin's JWTPayload
 *     })
 */
export const actionAdminMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await getSession()
    let postgrestToken: string | null = null

    if (session?.email && session.role === 'admin') {
      postgrestToken = await signPostgrestToken(session.email, session.role)
    }

    return next({ context: { session, postgrestToken } })
  },
)

// ---------------------------------------------------------------------------
// API route handler middleware (for use with server: { middleware: [...] })
// These return HTTP responses (401/403) on auth failure instead of redirecting.
// ---------------------------------------------------------------------------

/**
 * Middleware for API route handlers that require authentication.
 * Returns 401 on failure. Adds `session` and `postgrestToken` to handler context.
 *
 * Usage:
 *   export const Route = createFileRoute('/api/my-endpoint')({
 *     server: {
 *       middleware: [apiAuthMiddleware],
 *       handlers: {
 *         GET: async ({ context }) => {
 *           const { session, postgrestToken } = context
 *         },
 *       },
 *     },
 *   })
 */
export const apiAuthMiddleware = createMiddleware().server(
  async ({ next }) => {
    const session = await getSession()
    if (!session) {
      throw Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const postgrestToken = await signPostgrestToken(session.email, session.role)
    return next({ context: { session, postgrestToken } })
  },
)

/**
 * Middleware for API route handlers that require admin authentication.
 * Returns 401/403 on failure. Adds `session` and `postgrestToken` to handler context.
 *
 * Usage:
 *   export const Route = createFileRoute('/api/admin/endpoint')({
 *     server: {
 *       middleware: [apiAdminMiddleware],
 *       handlers: {
 *         GET: async ({ context }) => {
 *           const { session, postgrestToken } = context
 *         },
 *       },
 *     },
 *   })
 */
export const apiAdminMiddleware = createMiddleware().server(
  async ({ next }) => {
    const session = await getSession()
    if (!session) {
      throw Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.role !== 'admin') {
      throw Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    const postgrestToken = await signPostgrestToken(session.email, session.role)
    return next({ context: { session, postgrestToken } })
  },
)

// ---------------------------------------------------------------------------
// Context type helpers
// ---------------------------------------------------------------------------

export type ActionAuthContext = {
  session: JWTPayload | null
  postgrestToken: string | null
}

export type ActionAdminContext = ActionAuthContext

export type ApiAuthContext = {
  session: JWTPayload
  postgrestToken: string
}

export type ApiAdminContext = ApiAuthContext

// ---------------------------------------------------------------------------
// beforeLoad helpers (for use in route definitions)
// ---------------------------------------------------------------------------

/**
 * Server function for checking auth in beforeLoad.
 * Returns the session so it can be passed as route context.
 *
 * Usage:
 *   beforeLoad: async () => {
 *     const session = await checkAuth()
 *     return { session }
 *   }
 */
export const checkAuth = createServerFn({ method: 'GET' }).handler(
  async (): Promise<JWTPayload> => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return session
  },
)

/**
 * Server function for checking admin auth in beforeLoad.
 * Returns the session so it can be passed as route context.
 *
 * Usage:
 *   beforeLoad: async () => {
 *     const session = await checkAdminAuth()
 *     return { session }
 *   }
 */
export const checkAdminAuth = createServerFn({ method: 'GET' }).handler(
  async (): Promise<JWTPayload> => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login', search: { returnUrl: '/admin' } })
    }
    if (session.role !== 'admin') {
      throw redirect({ to: '/' })
    }
    return session
  },
)

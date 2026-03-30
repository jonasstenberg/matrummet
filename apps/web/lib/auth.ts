import { SignJWT, jwtVerify } from 'jose'
import { getCookie, setCookie } from '@tanstack/react-start/server'
import { env } from './env'
import { logger as rootLogger } from './logger'

const logger = rootLogger.child({ module: 'auth' })

let jwtSecret: Uint8Array | null = null
let postgrestJwtSecret: Uint8Array | null = null

function getJwtSecret(): Uint8Array {
  if (!jwtSecret) {
    jwtSecret = new TextEncoder().encode(env.JWT_SECRET)
  }
  return jwtSecret
}

function getPostgrestJwtSecret(): Uint8Array {
  if (!postgrestJwtSecret) {
    postgrestJwtSecret = new TextEncoder().encode(env.POSTGREST_JWT_SECRET)
  }
  return postgrestJwtSecret
}

// ---------------------------------------------------------------------------
// Cookie & token constants
// ---------------------------------------------------------------------------

export const ACCESS_TOKEN_COOKIE = 'auth-token'
export const REFRESH_TOKEN_COOKIE = 'refresh-token'

const ACCESS_TOKEN_MAX_AGE = 60 * 60 // 1 hour
export const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 // 30 days
export const REFRESH_TOKEN_MAX_AGE_MS = REFRESH_TOKEN_MAX_AGE * 1000

export function getAccessTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: '/',
  }
}

export function getRefreshTokenCookieOptions() {
  // Path is '/' because getSession() reads this cookie on any request
  // to transparently refresh expired access tokens. The cookie is httpOnly
  // + secure + sameSite=lax, so XSS cannot read it and CSRF is mitigated.
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: '/',
  }
}

// ---------------------------------------------------------------------------
// JWT types and signing
// ---------------------------------------------------------------------------

export interface JWTPayload {
  email: string
  name: string
  role?: 'user' | 'admin'
}

export async function signToken(payload: JWTPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(getJwtSecret())

  return token
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())

    if (
      payload &&
      typeof payload.email === 'string' &&
      typeof payload.name === 'string'
    ) {
      return {
        email: payload.email,
        name: payload.name,
        role: (payload.role === 'admin' || payload.role === 'user')
          ? payload.role
          : undefined,
      }
    }

    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Refresh token helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random refresh token and its SHA-256 hash.
 * The raw token goes to the client cookie; only the hash is stored in DB.
 */
export async function generateRefreshToken(): Promise<{ raw: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const raw = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hash = Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('')
  return { raw, hash }
}

/**
 * Hash a raw refresh token for DB lookup.
 */
export async function hashRefreshToken(raw: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------
// System PostgREST token (admin role for internal RPC calls)
// ---------------------------------------------------------------------------

export async function signSystemPostgrestToken(): Promise<string> {
  const token = await new SignJWT({ role: 'admin', system: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(getPostgrestJwtSecret())
  return token
}

/**
 * Get auth headers for internal PostgREST calls (admin/system role).
 */
export async function getSystemHeaders(): Promise<Record<string, string>> {
  const token = await signSystemPostgrestToken()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

// ---------------------------------------------------------------------------
// Session token creation (shared by server functions and API routes)
// ---------------------------------------------------------------------------

/**
 * Create a new session: sign access token, generate refresh token,
 * store refresh hash in DB, set both cookies.
 * Used by login, signup, Google OAuth, and token refresh flows.
 */
export async function createSessionTokens(
  userEmail: string,
  userName: string,
  userRole?: string,
): Promise<{ accessToken: string; refreshRaw: string }> {
  const role = (userRole === 'admin' || userRole === 'user') ? userRole : undefined
  const accessToken = await signToken({ email: userEmail, name: userName, role })

  const { raw: refreshRaw, hash: refreshHash } = await generateRefreshToken()
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS).toISOString()

  const headers = await getSystemHeaders()
  const response = await fetch(`${env.POSTGREST_URL}/rpc/create_refresh_token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_user_email: userEmail,
      p_token_hash: refreshHash,
      p_expires_at: expiresAt,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error({ errorText }, 'Failed to store refresh token')
    throw new Error('Failed to store refresh token')
  }

  return { accessToken, refreshRaw }
}

/**
 * Set both access and refresh token cookies from pre-created tokens.
 */
export function setSessionCookies(accessToken: string, refreshRaw: string): void {
  setCookie(ACCESS_TOKEN_COOKIE, accessToken, getAccessTokenCookieOptions())
  setCookie(REFRESH_TOKEN_COOKIE, refreshRaw, getRefreshTokenCookieOptions())
}

/**
 * Clear both auth cookies.
 */
export function clearSessionCookies(): void {
  setCookie(ACCESS_TOKEN_COOKIE, '', { ...getAccessTokenCookieOptions(), maxAge: 0 })
  setCookie(REFRESH_TOKEN_COOKIE, '', { ...getRefreshTokenCookieOptions(), maxAge: 0 })
}

// ---------------------------------------------------------------------------
// Token rotation (used by refresh endpoint and transparent refresh)
// ---------------------------------------------------------------------------

/**
 * Rotate a refresh token in the database atomically.
 * Returns the new session, access token, and raw refresh token,
 * or null if rotation failed (token invalid/expired/revoked).
 */
export async function rotateRefreshToken(
  oldTokenRaw: string,
): Promise<{ session: JWTPayload; accessToken: string; refreshRaw: string } | null> {
  const oldHash = await hashRefreshToken(oldTokenRaw)
  const { raw: newRaw, hash: newHash } = await generateRefreshToken()
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS).toISOString()

  const headers = await getSystemHeaders()
  const response = await fetch(`${env.POSTGREST_URL}/rpc/rotate_refresh_token`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      p_old_token_hash: oldHash,
      p_new_token_hash: newHash,
      p_new_expires_at: newExpiresAt,
    }),
  })

  if (!response.ok) {
    logger.warn('Refresh token rotation failed: PostgREST error')
    return null
  }

  const rows = await response.json()
  if (!Array.isArray(rows) || rows.length === 0 || !rows[0].user_email) {
    return null
  }

  const { user_email, user_name, user_role } = rows[0]
  const session: JWTPayload = {
    email: user_email,
    name: user_name,
    role: (user_role === 'admin' || user_role === 'user') ? user_role : undefined,
  }

  const accessToken = await signToken(session)
  return { session, accessToken, refreshRaw: newRaw }
}

// ---------------------------------------------------------------------------
// Token revocation helpers
// ---------------------------------------------------------------------------

/**
 * Revoke a single refresh token by its raw value (single-device logout).
 */
export async function revokeSingleRefreshToken(tokenRaw: string): Promise<void> {
  const tokenHash = await hashRefreshToken(tokenRaw)
  const headers = await getSystemHeaders()
  await fetch(`${env.POSTGREST_URL}/rpc/revoke_refresh_token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_token_hash: tokenHash }),
  })
}

/**
 * Revoke all refresh tokens for a user (password change, logout-everywhere).
 */
export async function revokeAllRefreshTokens(userEmail: string): Promise<void> {
  const headers = await getSystemHeaders()
  const response = await fetch(`${env.POSTGREST_URL}/rpc/revoke_user_refresh_tokens`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_user_email: userEmail }),
  })

  if (!response.ok) {
    logger.error('Failed to revoke refresh tokens')
  }
}

// ---------------------------------------------------------------------------
// Session resolution
// ---------------------------------------------------------------------------

/**
 * Get the current user session from cookies.
 * First tries the access token. If expired, transparently refreshes
 * using the refresh token cookie (token rotation in DB).
 */
export async function getSession(): Promise<JWTPayload | null> {
  // Try access token first
  const token = getCookie(ACCESS_TOKEN_COOKIE)
  if (token) {
    const session = await verifyToken(token)
    if (session) return session
  }

  // Access token missing or expired — try refresh
  const refreshTokenRaw = getCookie(REFRESH_TOKEN_COOKIE)
  if (!refreshTokenRaw) return null

  try {
    const result = await rotateRefreshToken(refreshTokenRaw)
    if (!result) {
      // Token was invalid/expired/revoked — clear cookies
      logger.debug('Refresh token invalid or revoked, clearing cookies')
      clearSessionCookies()
      return null
    }

    // Set new cookies on the outgoing response
    setSessionCookies(result.accessToken, result.refreshRaw)
    logger.debug({ email: result.session.email }, 'Session refreshed via refresh token')
    return result.session
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : String(error) }, 'Refresh token rotation error')
    return null
  }
}

export async function signPostgrestToken(email: string, role?: 'user' | 'admin'): Promise<string> {
  const pgRole = role === 'admin' ? 'admin' : 'authenticated'
  const token = await new SignJWT({ email, role: pgRole })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(getPostgrestJwtSecret())

  return token
}

/**
 * Authenticate a request using either cookie JWT or x-api-key header.
 * Tries cookie-based auth first, then falls back to API key validation
 * via PostgREST's pre_request() hook.
 */
export async function getAuthFromRequest(request: Request): Promise<JWTPayload | null> {
  // Try cookie-based auth first
  const session = await getSession()
  if (session) return session

  // Fall back to x-api-key header
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey) return null

  try {
    const response = await fetch(`${env.POSTGREST_URL}/rpc/current_user_info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    })

    if (!response.ok) return null

    const data = await response.json()
    if (!data?.email) return null

    return {
      email: data.email,
      name: data.name || '',
    }
  } catch {
    return null
  }
}

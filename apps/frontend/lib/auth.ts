import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { env } from './env'

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

const COOKIE_NAME = 'auth-token'

export interface JWTPayload {
  email: string
  name: string
  role?: 'user' | 'admin'
}

export async function signToken(payload: JWTPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret())

  return token
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())

    // Validate payload has required fields
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

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  return verifyToken(token)
}

export async function signPostgrestToken(email: string): Promise<string> {
  const token = await new SignJWT({ email, role: 'authenticated' })
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
export async function getAuthFromRequest(request: NextRequest): Promise<JWTPayload | null> {
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

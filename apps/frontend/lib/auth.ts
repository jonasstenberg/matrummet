import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { env } from './env'

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET)

const POSTGREST_JWT_SECRET = new TextEncoder().encode(env.POSTGREST_JWT_SECRET)

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
    .sign(JWT_SECRET)

  return token
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)

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
  const token = await new SignJWT({ email, role: 'anon' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(POSTGREST_JWT_SECRET)

  return token
}

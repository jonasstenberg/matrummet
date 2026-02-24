import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'

export interface JWTPayload {
  email: string
  name: string
  role?: 'user' | 'admin'
}

function base64url(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64urlEncode(str: string): string {
  return base64url(new TextEncoder().encode(str))
}

function base64urlDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (str.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

function signHS256(data: string, secret: string): string {
  const key = new TextEncoder().encode(secret)
  const msg = new TextEncoder().encode(data)
  const sig = hmac(sha256, key, msg)
  return base64url(sig)
}

/**
 * Sign an app JWT token (7-day expiry).
 */
export async function signToken(payload: JWTPayload, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    ...payload,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 days
  }
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64urlEncode(JSON.stringify(claims))
  const signature = signHS256(`${header}.${body}`, secret)
  return `${header}.${body}.${signature}`
}

/**
 * Verify an app JWT token and extract payload.
 */
export async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [header, body, signature] = parts

    // Verify signature
    const expected = signHS256(`${header}.${body}`, secret)
    if (signature !== expected) return null

    // Decode and check expiry
    const payload = JSON.parse(base64urlDecode(body))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null

    if (
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

/**
 * Sign a PostgREST JWT token (1-hour expiry).
 */
export async function signPostgrestToken(
  email: string,
  role: 'user' | 'admin' | undefined,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const pgRole = role === 'admin' ? 'admin' : 'authenticated'
  const claims = {
    email,
    role: pgRole,
    iat: now,
    exp: now + 60 * 60, // 1 hour
  }
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64urlEncode(JSON.stringify(claims))
  const signature = signHS256(`${header}.${body}`, secret)
  return `${header}.${body}.${signature}`
}

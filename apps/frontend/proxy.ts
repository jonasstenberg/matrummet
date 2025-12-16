import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-256-bits-long-for-hs256'
)

const COOKIE_NAME = 'auth-token'

// Protected route patterns
const PROTECTED_ROUTES = [
  '/mina-recept',
  '/recept/nytt',
  '/admin',
]

// Pattern for /recept/[id]/redigera
const EDIT_ROUTE_PATTERN = /^\/recept\/[^/]+\/redigera$/

function isProtectedRoute(pathname: string): boolean {
  // Check exact matches and subpaths
  if (PROTECTED_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
    return true
  }

  // Check edit route pattern
  if (EDIT_ROUTE_PATTERN.test(pathname)) {
    return true
  }

  return false
}

async function verifyAuthToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)

    // Validate payload has required fields
    if (
      payload &&
      typeof payload.email === 'string' &&
      typeof payload.name === 'string'
    ) {
      return true
    }

    return false
  } catch {
    return false
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only check protected routes
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next()
  }

  // Get auth token from cookie
  const token = request.cookies.get(COOKIE_NAME)?.value

  // No token - redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verify token
  const isValid = await verifyAuthToken(token)

  if (!isValid) {
    // Invalid token - redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)

    // Clear invalid token
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete(COOKIE_NAME)

    return response
  }

  // Valid token - allow request
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match protected routes
    '/mina-recept/:path*',
    '/recept/nytt',
    '/recept/:id/redigera',
    '/admin/:path*',
  ],
}

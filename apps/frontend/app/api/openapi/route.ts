import { headers } from 'next/headers'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()

  const reqHeaders: Record<string, string> = {
    Accept: 'application/openapi+json',
  }

  if (session) {
    const postgrestToken = await signPostgrestToken(session.email, session.role)
    reqHeaders.Authorization = `Bearer ${postgrestToken}`
  }

  const response = await fetch(`${env.POSTGREST_URL}/`, {
    headers: reqHeaders,
    cache: 'no-store',
  })

  if (!response.ok) {
    return Response.json(
      { error: 'Failed to fetch OpenAPI spec' },
      { status: 502 }
    )
  }

  const spec = await response.json()

  // Route Swagger UI execute requests through the Next.js proxy
  // so the browser doesn't need direct access to PostgREST
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') || 'https'
  spec.host = host
  spec.basePath = '/api/postgrest'
  spec.schemes = [proto]

  return Response.json(spec, {
    headers: {
      'Cache-Control': 'private, max-age=300',
    },
  })
}

import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

async function proxy(request: Request) {
  const url = new URL(request.url)
  // Strip /api/postgrest prefix to get the PostgREST path
  const path = url.pathname.replace(/^\/api\/postgrest/, '')
  const target = `${env.POSTGREST_URL}${path}${url.search}`

  // Strip hop-by-hop headers that Node fetch (undici) rejects
  const HOP_BY_HOP = new Set(['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authorization', 'proxy-connection'])
  const headers = new Headers()
  for (const [key, value] of request.headers) {
    if (!HOP_BY_HOP.has(key)) headers.set(key, value)
  }

  const response = await fetch(target, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    cache: 'no-store',
    // @ts-expect-error -- Node fetch supports duplex for streaming request bodies
    duplex: 'half',
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const HEAD = proxy
export const OPTIONS = proxy

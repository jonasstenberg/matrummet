import { cache } from 'react'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { HomeInfo } from '@/lib/types'

export interface HomeInfoResult {
  home: HomeInfo | null
  userEmail: string
}

/**
 * Server-side function to fetch home info. Uses React's cache() to
 * deduplicate requests within a single request lifecycle.
 *
 * Both layout and sub-pages call this directly - no prop drilling needed.
 */
export const getHomeInfo = cache(async (): Promise<HomeInfoResult> => {
  const session = await getSession()

  if (!session) {
    throw new Error('Not authenticated')
  }

  const postgrestToken = await signPostgrestToken(session.email)

  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_home_info`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${postgrestToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  })

  if (!response.ok) {
    return {
      home: null,
      userEmail: session.email,
    }
  }

  const result = await response.json()

  // RPC returns JSONB directly (not wrapped in array)
  // If user is not in a home, function returns null
  if (result === null) {
    return {
      home: null,
      userEmail: session.email,
    }
  }

  return {
    home: {
      id: result.id,
      name: result.name,
      join_code: result.join_code,
      join_code_expires_at: result.join_code_expires_at,
      member_count: result.members?.length || 0,
      members: result.members || [],
    },
    userEmail: session.email,
  }
})

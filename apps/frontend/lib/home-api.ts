import { cache } from 'react'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { HomeInfo, UserHome } from '@/lib/types'

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
export const getHomeInfo = cache(async (homeId?: string): Promise<HomeInfoResult> => {
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
    body: JSON.stringify({ p_home_id: homeId ?? null }),
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

/**
 * Get the current JWT user's UUID. Used as fallback when user has no home.
 */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const session = await getSession()

  if (!session) {
    return null
  }

  const postgrestToken = await signPostgrestToken(session.email)

  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_current_user_uuid`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${postgrestToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  })

  if (!response.ok) {
    return null
  }

  const result = await response.json()
  return result as string | null
})

export const getUserHomes = cache(async (): Promise<UserHome[]> => {
  const session = await getSession()

  if (!session) {
    throw new Error('Not authenticated')
  }

  const postgrestToken = await signPostgrestToken(session.email)

  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_user_homes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${postgrestToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  })

  if (!response.ok) {
    return []
  }

  const result = await response.json()

  return result as UserHome[]
})

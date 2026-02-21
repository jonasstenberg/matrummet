import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { HomeInfo, UserHome, BookShareConnection } from '@/lib/types'

export interface HomeInfoResult {
  home: HomeInfo | null
  userEmail: string
}

/**
 * Server-side function to fetch home info.
 * Called from route loaders to fetch home info.
 */
export async function getHomeInfo(homeId?: string): Promise<HomeInfoResult> {
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
}

/**
 * Get the current JWT user's UUID. Used as fallback when user has no home.
 */
export async function getCurrentUserId(): Promise<string | null> {
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
}

export async function getUserHomes(): Promise<UserHome[]> {
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
}

export async function getSharedBookUsers(): Promise<BookShareConnection[]> {
  const session = await getSession()

  if (!session) {
    return []
  }

  const postgrestToken = await signPostgrestToken(session.email)

  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_shared_books`, {
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

  return await response.json()
}

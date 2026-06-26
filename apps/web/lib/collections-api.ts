import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import type { Collection, Recipe } from '@/lib/types'

/**
 * Server-side reads for collections, called from route loaders.
 * Mirrors home-api.ts: resolves the session + signs a PostgREST token internally.
 */

async function collectionRpc<T>(fn: string, body: unknown, fallback: T): Promise<T> {
  const session = await getSession()
  if (!session) return fallback

  const token = await signPostgrestToken(session.email)
  const response = await fetch(`${env.POSTGREST_URL}/rpc/${fn}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) return fallback
  return (await response.json()) as T
}

export async function listCollections(): Promise<Collection[]> {
  return collectionRpc<Collection[]>('list_collections', {}, [])
}

export interface CollectionRecipesResult {
  recipes: Recipe[]
  totalCount: number
}

export async function getCollectionRecipes(
  collectionId: string,
  options?: { limit?: number; offset?: number },
): Promise<CollectionRecipesResult> {
  const session = await getSession()
  if (!session) return { recipes: [], totalCount: 0 }

  const token = await signPostgrestToken(session.email)
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const [listRes, countRes] = await Promise.all([
    fetch(`${env.POSTGREST_URL}/rpc/list_recipes_by_collection`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_collection_id: collectionId,
        p_limit: options?.limit ?? 50,
        p_offset: options?.offset ?? 0,
      }),
      cache: 'no-store',
    }),
    fetch(`${env.POSTGREST_URL}/rpc/count_recipes_by_collection`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_collection_id: collectionId }),
      cache: 'no-store',
    }),
  ])

  const recipes: Recipe[] = listRes.ok ? await listRes.json() : []
  const totalCount = countRes.ok ? Number(await countRes.json()) : 0
  return { recipes, totalCount }
}

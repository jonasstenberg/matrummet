import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { Collection, CollectionForRecipe, CollectionShareInfo, SharedCollection } from '@/lib/types'
import { actionAuthMiddleware } from './middleware'
import { env } from '@/lib/env'

// ============================================================================
// Helpers
// ============================================================================

function rpcUrl(fn: string): string {
  return `${env.POSTGREST_URL}/rpc/${fn}`
}

function authHeaders(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

// ============================================================================
// CRUD server functions
// ============================================================================

const createCollectionFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      kind: z.enum(['personal', 'curated']).optional(),
    }),
  )
  .handler(async ({ data, context }): Promise<{ collection: Collection } | { error: string }> => {
    const { postgrestToken, logger } = context
    const log = logger.child({ module: 'collections' })
    if (!postgrestToken) return { error: 'Du måste vara inloggad' }

    try {
      const response = await fetch(rpcUrl('create_collection'), {
        method: 'POST',
        headers: authHeaders(postgrestToken),
        body: JSON.stringify({
          p_name: data.name,
          p_description: data.description ?? null,
          p_kind: data.kind ?? 'personal',
        }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText }, 'Failed to create collection')
        if (errorText.includes('not-allowed')) return { error: 'Du har inte behörighet att skapa den samlingen' }
        return { error: 'Kunde inte skapa samlingen. Försök igen.' }
      }
      const result = await response.json()
      const row = Array.isArray(result) ? result[0] : result
      return { collection: row as Collection }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error) }, 'Error creating collection')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const updateCollectionFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      coverImage: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }): Promise<{ collection: Collection } | { error: string }> => {
    const { postgrestToken, logger } = context
    const log = logger.child({ module: 'collections' })
    if (!postgrestToken) return { error: 'Du måste vara inloggad' }

    try {
      const response = await fetch(rpcUrl('update_collection'), {
        method: 'POST',
        headers: authHeaders(postgrestToken),
        body: JSON.stringify({
          p_id: data.id,
          p_name: data.name ?? null,
          p_description: data.description ?? null,
          p_cover_image: data.coverImage ?? null,
        }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText, id: data.id }, 'Failed to update collection')
        return { error: 'Kunde inte uppdatera samlingen. Försök igen.' }
      }
      const result = await response.json()
      const row = Array.isArray(result) ? result[0] : result
      return { collection: row as Collection }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), id: data.id }, 'Error updating collection')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const deleteCollectionFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }): Promise<{ success: boolean } | { error: string }> => {
    const { postgrestToken, logger } = context
    const log = logger.child({ module: 'collections' })
    if (!postgrestToken) return { error: 'Du måste vara inloggad' }

    try {
      const response = await fetch(rpcUrl('delete_collection'), {
        method: 'POST',
        headers: authHeaders(postgrestToken),
        body: JSON.stringify({ p_id: data.id }),
      })
      if (!response.ok) return { error: 'Kunde inte ta bort samlingen' }
      return { success: true }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), id: data.id }, 'Error deleting collection')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const addRecipeToCollectionFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ collectionId: z.string(), recipeId: z.string() }))
  .handler(async ({ data, context }): Promise<{ success: boolean } | { error: string }> => {
    const { postgrestToken, logger } = context
    const log = logger.child({ module: 'collections' })
    if (!postgrestToken) return { error: 'Du måste vara inloggad' }

    try {
      const response = await fetch(rpcUrl('add_recipe_to_collection'), {
        method: 'POST',
        headers: authHeaders(postgrestToken),
        body: JSON.stringify({ p_collection_id: data.collectionId, p_recipe_id: data.recipeId }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        if (errorText.includes('not-allowed')) return { error: 'Du kan bara lägga till dina egna recept' }
        log.error({ responseBody: errorText }, 'Failed to add recipe to collection')
        return { error: 'Kunde inte lägga till receptet i samlingen' }
      }
      return { success: true }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error) }, 'Error adding recipe to collection')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const removeRecipeFromCollectionFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ collectionId: z.string(), recipeId: z.string() }))
  .handler(async ({ data, context }): Promise<{ success: boolean } | { error: string }> => {
    const { postgrestToken, logger } = context
    const log = logger.child({ module: 'collections' })
    if (!postgrestToken) return { error: 'Du måste vara inloggad' }

    try {
      const response = await fetch(rpcUrl('remove_recipe_from_collection'), {
        method: 'POST',
        headers: authHeaders(postgrestToken),
        body: JSON.stringify({ p_collection_id: data.collectionId, p_recipe_id: data.recipeId }),
      })
      if (!response.ok) return { error: 'Kunde inte ta bort receptet från samlingen' }
      return { success: true }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error) }, 'Error removing recipe from collection')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

// Lazy read for the "Add to collection" dialog (which of the caller's collections contain the recipe).
const getCollectionsForRecipeFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ recipeId: z.string() }))
  .handler(async ({ data, context }): Promise<CollectionForRecipe[]> => {
    const { postgrestToken, logger } = context
    const log = logger.child({ module: 'collections' })
    if (!postgrestToken) return []

    try {
      const response = await fetch(rpcUrl('collections_for_recipe'), {
        method: 'POST',
        headers: authHeaders(postgrestToken),
        body: JSON.stringify({ p_recipe_id: data.recipeId }),
      })
      if (!response.ok) return []
      return await response.json()
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), recipeId: data.recipeId }, 'Error getting collections for recipe')
      return []
    }
  })

// ============================================================================
// Share-by-link server functions
// ============================================================================

const createCollectionShareLinkFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ collectionId: z.string(), expiresDays: z.number().optional() }))
  .handler(
    async ({ data, context }): Promise<{ token: string; url: string; expires_at: string | null } | { error: string }> => {
      const { postgrestToken, logger } = context
      const log = logger.child({ module: 'collections' })
      if (!postgrestToken) return { error: 'Du måste vara inloggad' }

      try {
        const response = await fetch(rpcUrl('create_collection_share_token'), {
          method: 'POST',
          headers: authHeaders(postgrestToken),
          body: JSON.stringify({ p_collection_id: data.collectionId, p_expires_days: data.expiresDays ?? null }),
        })
        if (!response.ok) {
          const errorText = await response.text()
          log.error({ responseBody: errorText }, 'Failed to create collection share link')
          if (errorText.includes('not-allowed')) return { error: 'Du kan bara dela dina egna samlingar' }
          return { error: 'Kunde inte skapa delningslänk. Försök igen.' }
        }
        const result = await response.json()
        const row = Array.isArray(result) ? result[0] : result
        if (!row || !row.token) return { error: 'Kunde inte skapa delningslänk' }

        const baseUrl = env.APP_URL || 'http://localhost:3000'
        return { token: row.token, url: `${baseUrl}/dela/samling/${row.token}`, expires_at: row.expires_at ?? null }
      } catch (error) {
        log.error({ err: error instanceof Error ? error : String(error) }, 'Error creating collection share link')
        return { error: 'Ett oväntat fel uppstod. Försök igen.' }
      }
    },
  )

const getCollectionShareInfoFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ shareToken: z.string() }))
  .handler(async ({ data, context }): Promise<CollectionShareInfo | null> => {
    const { postgrestToken, logger } = context
    const log = logger.child({ module: 'collections' })

    try {
      const response = await fetch(rpcUrl('get_collection_share_info'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(postgrestToken ? { Authorization: `Bearer ${postgrestToken}` } : {}),
        },
        body: JSON.stringify({ p_token: data.shareToken }),
      })
      if (!response.ok) return null
      const result = await response.json()
      const row = Array.isArray(result) ? result[0] : result
      if (!row || !row.collection_name) return null
      return row as CollectionShareInfo
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), shareToken: data.shareToken }, 'Error getting collection share info')
      return null
    }
  })

const acceptCollectionShareFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ shareToken: z.string() }))
  .handler(
    async ({ data, context }): Promise<{ collection_id: string; collection_name: string; sharer_name: string } | { error: string }> => {
      const { postgrestToken, logger } = context
      const log = logger.child({ module: 'collections' })
      if (!postgrestToken) return { error: 'Du måste vara inloggad för att acceptera' }

      try {
        const response = await fetch(rpcUrl('accept_collection_share'), {
          method: 'POST',
          headers: authHeaders(postgrestToken),
          body: JSON.stringify({ p_token: data.shareToken }),
        })
        if (!response.ok) {
          const errorText = await response.text()
          log.error({ responseBody: errorText, shareToken: data.shareToken }, 'Failed to accept collection share')
          try {
            const errorJson = JSON.parse(errorText)
            if (errorJson.message?.includes('cannot-share-with-self')) return { error: 'Du kan inte dela en samling med dig själv' }
            if (errorJson.message?.includes('invalid-or-expired-token')) return { error: 'Länken är ogiltig eller har gått ut' }
          } catch {
            // Fall through
          }
          return { error: 'Kunde inte acceptera delningen. Försök igen.' }
        }
        const result = await response.json()
        const row = Array.isArray(result) ? result[0] : result
        return { collection_id: row.collection_id, collection_name: row.collection_name, sharer_name: row.sharer_name }
      } catch (error) {
        log.error({ err: error instanceof Error ? error : String(error), shareToken: data.shareToken }, 'Error accepting collection share')
        return { error: 'Ett oväntat fel uppstod. Försök igen.' }
      }
    },
  )

const revokeCollectionShareLinkFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ shareToken: z.string() }))
  .handler(async ({ data, context }): Promise<{ success: boolean } | { error: string }> => {
    const { postgrestToken, logger } = context
    const log = logger.child({ module: 'collections' })
    if (!postgrestToken) return { error: 'Du måste vara inloggad' }

    try {
      const response = await fetch(rpcUrl('revoke_collection_share_token'), {
        method: 'POST',
        headers: authHeaders(postgrestToken),
        body: JSON.stringify({ p_token: data.shareToken }),
      })
      if (!response.ok) return { error: 'Kunde inte återkalla länken' }
      const result = await response.json()
      return { success: result === true }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), shareToken: data.shareToken }, 'Error revoking collection share link')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const getSharedCollectionsFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .handler(async ({ context }): Promise<SharedCollection[]> => {
    const { postgrestToken, logger } = context
    const log = logger.child({ module: 'collections' })
    if (!postgrestToken) return []

    try {
      const response = await fetch(rpcUrl('get_shared_collections'), {
        method: 'POST',
        headers: authHeaders(postgrestToken),
        body: JSON.stringify({}),
      })
      if (!response.ok) return []
      return await response.json()
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error) }, 'Error getting shared collections')
      return []
    }
  })

const removeCollectionShareConnectionFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ connectionId: z.string() }))
  .handler(async ({ data, context }): Promise<{ success: boolean } | { error: string }> => {
    const { postgrestToken, logger } = context
    const log = logger.child({ module: 'collections' })
    if (!postgrestToken) return { error: 'Du måste vara inloggad' }

    try {
      const response = await fetch(rpcUrl('remove_collection_share_connection'), {
        method: 'POST',
        headers: authHeaders(postgrestToken),
        body: JSON.stringify({ p_connection_id: data.connectionId }),
      })
      if (!response.ok) return { error: 'Kunde inte ta bort delningen' }
      const result = await response.json()
      return { success: result === true }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), connectionId: data.connectionId }, 'Error removing collection share connection')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

// ============================================================================
// Exported wrappers
// ============================================================================

export async function createCollection(
  input: { name: string; description?: string; kind?: 'personal' | 'curated' },
): Promise<{ collection: Collection } | { error: string }> {
  return createCollectionFn({ data: input })
}

export async function updateCollection(
  input: { id: string; name?: string; description?: string; coverImage?: string },
): Promise<{ collection: Collection } | { error: string }> {
  return updateCollectionFn({ data: input })
}

export async function deleteCollection(id: string): Promise<{ success: boolean } | { error: string }> {
  return deleteCollectionFn({ data: { id } })
}

export async function addRecipeToCollection(
  collectionId: string,
  recipeId: string,
): Promise<{ success: boolean } | { error: string }> {
  return addRecipeToCollectionFn({ data: { collectionId, recipeId } })
}

export async function removeRecipeFromCollection(
  collectionId: string,
  recipeId: string,
): Promise<{ success: boolean } | { error: string }> {
  return removeRecipeFromCollectionFn({ data: { collectionId, recipeId } })
}

export async function getCollectionsForRecipe(recipeId: string): Promise<CollectionForRecipe[]> {
  return getCollectionsForRecipeFn({ data: { recipeId } })
}

export async function createCollectionShareLink(
  collectionId: string,
  expiresDays?: number,
): Promise<{ token: string; url: string; expires_at: string | null } | { error: string }> {
  return createCollectionShareLinkFn({ data: { collectionId, expiresDays } })
}

export async function getCollectionShareInfo(shareToken: string): Promise<CollectionShareInfo | null> {
  return getCollectionShareInfoFn({ data: { shareToken } })
}

export async function acceptCollectionShare(
  shareToken: string,
): Promise<{ collection_id: string; collection_name: string; sharer_name: string } | { error: string }> {
  return acceptCollectionShareFn({ data: { shareToken } })
}

export async function revokeCollectionShareLink(shareToken: string): Promise<{ success: boolean } | { error: string }> {
  return revokeCollectionShareLinkFn({ data: { shareToken } })
}

export async function getSharedCollections(): Promise<SharedCollection[]> {
  return getSharedCollectionsFn()
}

export async function removeCollectionShareConnection(
  connectionId: string,
): Promise<{ success: boolean } | { error: string }> {
  return removeCollectionShareConnectionFn({ data: { connectionId } })
}

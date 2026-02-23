import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { BookShareConnection, BookShareInfo } from '@/lib/types'
import { actionAuthMiddleware } from './middleware'
import { env } from '@/lib/env'

// ============================================================================
// Server Functions
// ============================================================================

const createBookShareLinkFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ expiresDays: z.number().optional() }))
  .handler(async ({ data, context }): Promise<{ token: string; url: string; expires_at: string | null } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'book-share' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/create_book_share_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_expires_days: data.expiresDays ?? null }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText }, 'Failed to create book share link')
        return { error: 'Kunde inte skapa delningslänk. Försök igen.' }
      }

      const result = await response.json()
      const row = Array.isArray(result) ? result[0] : result

      if (!row || !row.token) {
        return { error: 'Kunde inte skapa delningslänk' }
      }

      const baseUrl = env.APP_URL || 'http://localhost:3000'
      const shareUrl = `${baseUrl}/dela/bok/${row.token}`

      return {
        token: row.token,
        url: shareUrl,
        expires_at: row.expires_at ?? null,
      }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error) }, 'Error creating book share link')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const getBookShareInfoFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ shareToken: z.string() }))
  .handler(async ({ data, context }): Promise<BookShareInfo | null> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'book-share' })

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/get_book_share_info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(postgrestToken ? { Authorization: `Bearer ${postgrestToken}` } : {}),
        },
        body: JSON.stringify({ p_token: data.shareToken }),
      })

      if (!response.ok) {
        return null
      }

      const result = await response.json()
      const row = Array.isArray(result) ? result[0] : result

      if (!row || !row.sharer_name) {
        return null
      }

      return row as BookShareInfo
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), shareToken: data.shareToken }, 'Error getting book share info')
      return null
    }
  })

const acceptBookShareFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ shareToken: z.string() }))
  .handler(async ({ data, context }): Promise<{ sharer_name: string; sharer_id: string } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'book-share' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att acceptera' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/accept_book_share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_token: data.shareToken }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText, shareToken: data.shareToken }, 'Failed to accept book share')

        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.message?.includes('cannot-share-with-self')) {
            return { error: 'Du kan inte dela din receptbok med dig själv' }
          }
          if (errorJson.message?.includes('invalid-or-expired-token')) {
            return { error: 'Länken är ogiltig eller har gått ut' }
          }
        } catch {
          // Fall through
        }

        return { error: 'Kunde inte acceptera delningen. Försök igen.' }
      }

      const result = await response.json()
      const row = Array.isArray(result) ? result[0] : result

      return { sharer_name: row.sharer_name, sharer_id: row.sharer_id }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), shareToken: data.shareToken }, 'Error accepting book share')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const revokeBookShareLinkFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ shareToken: z.string() }))
  .handler(async ({ data, context }): Promise<{ success: boolean } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'book-share' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/revoke_book_share_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_token: data.shareToken }),
      })

      if (!response.ok) {
        return { error: 'Kunde inte återkalla länken' }
      }

      const result = await response.json()
      return { success: result === true }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), shareToken: data.shareToken }, 'Error revoking book share link')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const getSharedBooksFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .handler(async ({ context }): Promise<BookShareConnection[]> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'book-share' })

    if (!postgrestToken) {
      return []
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/get_shared_books`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        return []
      }

      return await response.json()
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error) }, 'Error getting shared books')
      return []
    }
  })

const removeBookShareConnectionFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ connectionId: z.string() }))
  .handler(async ({ data, context }): Promise<{ success: boolean } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'book-share' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/remove_book_share_connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_connection_id: data.connectionId }),
      })

      if (!response.ok) {
        return { error: 'Kunde inte ta bort delningen' }
      }

      const result = await response.json()

      return { success: result === true }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), connectionId: data.connectionId }, 'Error removing book share connection')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

// ============================================================================
// Exported wrappers (preserve existing call signatures)
// ============================================================================

export async function createBookShareLink(
  expiresDays?: number
): Promise<{ token: string; url: string; expires_at: string | null } | { error: string }> {
  return createBookShareLinkFn({ data: { expiresDays } })
}

export async function getBookShareInfo(
  shareToken: string
): Promise<BookShareInfo | null> {
  return getBookShareInfoFn({ data: { shareToken } })
}

export async function acceptBookShare(
  shareToken: string
): Promise<{ sharer_name: string; sharer_id: string } | { error: string }> {
  return acceptBookShareFn({ data: { shareToken } })
}

export async function revokeBookShareLink(
  shareToken: string
): Promise<{ success: boolean } | { error: string }> {
  return revokeBookShareLinkFn({ data: { shareToken } })
}

export async function getSharedBooks(): Promise<BookShareConnection[]> {
  return getSharedBooksFn()
}

export async function removeBookShareConnection(
  connectionId: string
): Promise<{ success: boolean } | { error: string }> {
  return removeBookShareConnectionFn({ data: { connectionId } })
}

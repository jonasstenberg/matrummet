import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { setCookie } from '@tanstack/react-start/server'
import { ApiKey } from '@/lib/types'
import { signToken } from '@/lib/auth'
import { PostgrestClient } from '@matrummet/api-client'
import { actionAuthMiddleware } from './middleware'
import { apiKeysArraySchema } from './schemas'
import { env } from '@/lib/env'

// ============================================================================
// Server Functions
// ============================================================================

const getApiKeysFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .handler(async ({ context }): Promise<ApiKey[] | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'settings' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/get_user_api_keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText }, 'Failed to get API keys')
        return { error: 'Kunde inte hämta API-nycklar' }
      }

      const rawResult = await response.json()

      const mapped = rawResult.map((key: { id: string; name: string; api_key_prefix: string; last_used_at: string | null; date_published: string }) => ({
        id: key.id,
        name: key.name,
        prefix: key.api_key_prefix,
        last_used_at: key.last_used_at,
        date_published: key.date_published,
      }))

      const result = apiKeysArraySchema.safeParse(mapped)
      if (!result.success) {
        log.error({ detail: result.error.message }, 'API keys validation failed')
        return { error: 'Ogiltigt svar från servern' }
      }

      return result.data
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error) }, 'Error getting API keys')
      return { error: 'Kunde inte hämta API-nycklar' }
    }
  })

const createApiKeyFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.string())
  .handler(async ({ data, context }): Promise<{ apiKey: string; prefix: string; id: string } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'settings' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/create_user_api_key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_name: data }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText }, 'Failed to create API key')

        if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
          return { error: 'En nyckel med det namnet finns redan' }
        }

        return { error: 'Kunde inte skapa nyckel' }
      }

      const result = await response.json()

      return {
        apiKey: result.api_key,
        prefix: result.api_key_prefix,
        id: result.id,
      }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error) }, 'Error creating API key')
      return { error: 'Kunde inte skapa nyckel' }
    }
  })

const revokeApiKeyFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.string())
  .handler(async ({ data, context }): Promise<{ success: true } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'settings' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/revoke_api_key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_key_id: data }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText }, 'Failed to revoke API key')
        return { error: 'Kunde inte ta bort nyckel' }
      }

      return { success: true }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error) }, 'Error revoking API key')
      return { error: 'Kunde inte ta bort nyckel' }
    }
  })

export interface UpdateProfileState {
  error?: string
  success?: boolean
}

const updateProfileFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ name: z.string() }))
  .handler(async ({ data, context }): Promise<UpdateProfileState> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'settings' })
    const { name } = data

    try {
      if (!name || name.trim().length === 0) {
        return { error: 'Namn är obligatoriskt' }
      }

      if (!postgrestToken || !context.session?.email) {
        return { error: 'Du måste vara inloggad för att uppdatera profil' }
      }

      const client = new PostgrestClient({
        postgrestUrl: env.POSTGREST_URL,
        postgrestToken,
        session: context.session,
      })
      const updated = await client.updateProfile(name)

      const newToken = await signToken(updated)

      setCookie('auth-token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })

      return { success: true }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error) }, 'Error updating profile')
      return { error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

// ============================================================================
// Exported wrappers (preserve existing call signatures)
// ============================================================================

export async function getApiKeys(): Promise<ApiKey[] | { error: string }> {
  return getApiKeysFn()
}

export async function createApiKey(name: string): Promise<{ apiKey: string; prefix: string; id: string } | { error: string }> {
  return createApiKeyFn({ data: name })
}

export async function revokeApiKey(keyId: string): Promise<{ success: true } | { error: string }> {
  return revokeApiKeyFn({ data: keyId })
}

export async function updateProfileAction(name: string): Promise<UpdateProfileState> {
  return updateProfileFn({ data: { name } })
}

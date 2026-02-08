'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ApiKey } from '@/lib/types'
import { verifyToken, signToken } from '@/lib/auth'
import { getPostgrestToken } from './action-utils'
import { apiKeysArraySchema } from './schemas'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:4444'

export async function getApiKeys(): Promise<ApiKey[] | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/get_user_api_keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to get API keys:', errorText)
      return { error: 'Kunde inte hämta API-nycklar' }
    }

    const rawResult = await response.json()

    // Map database field names to ApiKey interface
    const mapped = rawResult.map((key: { id: string; name: string; api_key_prefix: string; last_used_at: string | null; date_published: string }) => ({
      id: key.id,
      name: key.name,
      prefix: key.api_key_prefix,
      last_used_at: key.last_used_at,
      date_published: key.date_published,
    }))

    // Validate with Zod schema
    const result = apiKeysArraySchema.safeParse(mapped)
    if (!result.success) {
      console.error('API keys validation failed:', result.error.message)
      return { error: 'Ogiltigt svar från servern' }
    }

    return result.data
  } catch (error) {
    console.error('Error getting API keys:', error)
    return { error: 'Kunde inte hämta API-nycklar' }
  }
}

export async function createApiKey(
  name: string
): Promise<{ apiKey: string; prefix: string; id: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/create_user_api_key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_name: name }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to create API key:', errorText)

      if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
        return { error: 'En nyckel med det namnet finns redan' }
      }

      return { error: 'Kunde inte skapa nyckel' }
    }

    const result = await response.json()

    revalidatePath('/installningar')

    return {
      apiKey: result.api_key,
      prefix: result.prefix,
      id: result.id,
    }
  } catch (error) {
    console.error('Error creating API key:', error)
    return { error: 'Kunde inte skapa nyckel' }
  }
}

export async function revokeApiKey(
  keyId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/revoke_api_key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_key_id: keyId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to revoke API key:', errorText)
      return { error: 'Kunde inte ta bort nyckel' }
    }

    revalidatePath('/installningar')

    return { success: true }
  } catch (error) {
    console.error('Error revoking API key:', error)
    return { error: 'Kunde inte ta bort nyckel' }
  }
}

export interface UpdateProfileState {
  error?: string
  success?: boolean
}

export async function updateProfileAction(
  _prevState: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const name = formData.get('name') as string

  try {
    // Validate name is not empty
    if (!name || name.trim().length === 0) {
      return { error: 'Namn är obligatoriskt' }
    }

    // Get current session
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return { error: 'Du måste vara inloggad för att uppdatera profil' }
    }

    const payload = await verifyToken(authToken)
    if (!payload?.email) {
      return { error: 'Du måste vara inloggad för att uppdatera profil' }
    }

    // Get PostgREST token
    const postgrestToken = await getPostgrestToken()
    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att uppdatera profil' }
    }

    // Update user profile in database
    const response = await fetch(
      `${POSTGREST_URL}/users?email=eq.${encodeURIComponent(payload.email)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ name: name.trim() }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to update profile:', errorText)
      return { error: 'Kunde inte uppdatera profil. Försök igen.' }
    }

    const updatedUsers = await response.json()
    const updatedUser = updatedUsers[0]

    if (!updatedUser) {
      return { error: 'Användaren hittades inte' }
    }

    // Sign new token with updated name
    const newToken = await signToken({
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
    })

    // Update the cookie with new token
    cookieStore.set({
      name: 'auth-token',
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    // Revalidate profile page
    revalidatePath('/installningar')

    return { success: true }
  } catch (error) {
    console.error('Error updating profile:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

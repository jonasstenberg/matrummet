'use server'

import { revalidatePath } from 'next/cache'
import type { BookShareConnection, BookShareInfo } from '@/lib/types'
import { getPostgrestToken } from './action-utils'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:4444'

export async function createBookShareLink(
  expiresDays?: number
): Promise<{ token: string; url: string; expires_at: string | null } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/create_book_share_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_expires_days: expiresDays ?? null }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to create book share link:', errorText)
      return { error: 'Kunde inte skapa delningslänk. Försök igen.' }
    }

    const result = await response.json()
    const row = Array.isArray(result) ? result[0] : result

    if (!row || !row.token) {
      return { error: 'Kunde inte skapa delningslänk' }
    }

    const baseUrl = process.env.APP_URL || 'http://localhost:3000'
    const shareUrl = `${baseUrl}/dela/bok/${row.token}`

    return {
      token: row.token,
      url: shareUrl,
      expires_at: row.expires_at ?? null,
    }
  } catch (error) {
    console.error('Error creating book share link:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function getBookShareInfo(
  shareToken: string
): Promise<BookShareInfo | null> {
  try {
    const token = await getPostgrestToken()

    const response = await fetch(`${POSTGREST_URL}/rpc/get_book_share_info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ p_token: shareToken }),
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
    console.error('Error getting book share info:', error)
    return null
  }
}

export async function acceptBookShare(
  shareToken: string
): Promise<{ sharer_name: string; sharer_id: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att acceptera' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/accept_book_share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_token: shareToken }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to accept book share:', errorText)

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

    revalidatePath('/')

    return { sharer_name: row.sharer_name, sharer_id: row.sharer_id }
  } catch (error) {
    console.error('Error accepting book share:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function revokeBookShareLink(
  shareToken: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/revoke_book_share_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_token: shareToken }),
    })

    if (!response.ok) {
      return { error: 'Kunde inte återkalla länken' }
    }

    const result = await response.json()
    return { success: result === true }
  } catch (error) {
    console.error('Error revoking book share link:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function getSharedBooks(): Promise<BookShareConnection[]> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return []
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/get_shared_books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      return []
    }

    return await response.json()
  } catch (error) {
    console.error('Error getting shared books:', error)
    return []
  }
}

export async function removeBookShareConnection(
  connectionId: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/remove_book_share_connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_connection_id: connectionId }),
    })

    if (!response.ok) {
      return { error: 'Kunde inte ta bort delningen' }
    }

    const result = await response.json()

    revalidatePath('/')
    revalidatePath('/installningar/delning')

    return { success: result === true }
  } catch (error) {
    console.error('Error removing book share connection:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

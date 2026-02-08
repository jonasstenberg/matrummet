'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { HomeInfo, HomeInvitation } from '@/lib/types'
import { verifyToken, signPostgrestToken } from '@/lib/auth'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:4444'

async function getPostgrestToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return null
  }

  // Verify the frontend token and extract the email
  const payload = await verifyToken(authToken)
  if (!payload?.email) {
    return null
  }

  // Create a PostgREST-specific token with role: 'anon'
  return signPostgrestToken(payload.email)
}

export async function createHome(
  name: string
): Promise<{ id: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att skapa ett hushåll' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/create_home`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_name: name }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to create home:', errorText)

      // Check for specific error codes
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'user-already-has-home') {
          return { error: 'Du är redan medlem i ett hushåll' }
        }
      } catch {
        // If we can't parse the error, fall through to generic message
      }

      return { error: 'Kunde inte skapa hushållet. Försök igen.' }
    }

    const result = await response.json()

    revalidatePath('/hushall', 'layout')

    return { id: result }
  } catch (error) {
    console.error('Error creating home:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function updateHomeName(
  name: string
): Promise<{ success: true } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att uppdatera hushållet' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/update_home_name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_name: name }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to update home name:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'user-has-no-home') {
          return { error: 'Du är inte medlem i något hushåll' }
        }
      } catch {
        // Fall through to generic message
      }

      return { error: 'Kunde inte uppdatera namnet. Försök igen.' }
    }

    revalidatePath('/hushall', 'layout')

    return { success: true }
  } catch (error) {
    console.error('Error updating home name:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function leaveHome(): Promise<{ success: true } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att lämna hushållet' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/leave_home`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to leave home:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'user-has-no-home') {
          return { error: 'Du är inte medlem i något hushåll' }
        }
      } catch {
        // Fall through to generic message
      }

      return { error: 'Kunde inte lämna hushållet. Försök igen.' }
    }

    revalidatePath('/hushall', 'layout')

    return { success: true }
  } catch (error) {
    console.error('Error leaving home:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function generateJoinCode(
  expiresHours?: number
): Promise<{ code: string; expires_at: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att skapa en inbjudningskod' }
    }

    const payload: { p_expires_hours?: number } = {}
    if (expiresHours !== undefined) {
      payload.p_expires_hours = expiresHours
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/generate_join_code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to generate join code:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'user-has-no-home') {
          return { error: 'Du är inte medlem i något hushåll' }
        }
      } catch {
        // Fall through to generic message
      }

      return { error: 'Kunde inte skapa inbjudningskoden. Försök igen.' }
    }

    const code = await response.json()

    // Calculate expiry based on the hours (default 168 = 7 days)
    const hours = expiresHours ?? 168
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

    revalidatePath('/hushall', 'layout')

    return { code, expires_at: expiresAt }
  } catch (error) {
    console.error('Error generating join code:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function disableJoinCode(): Promise<{ success: true } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att inaktivera inbjudningskoden' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/disable_join_code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to disable join code:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'user-has-no-home') {
          return { error: 'Du är inte medlem i något hushåll' }
        }
      } catch {
        // Fall through to generic message
      }

      return { error: 'Kunde inte inaktivera inbjudningskoden. Försök igen.' }
    }

    revalidatePath('/hushall', 'layout')

    return { success: true }
  } catch (error) {
    console.error('Error disabling join code:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function joinHomeByCode(
  code: string
): Promise<{ home_id: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att gå med i ett hushåll' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/join_home_by_code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_code: code }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to join home by code:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'user-already-has-home') {
          return { error: 'Du är redan medlem i ett hushåll' }
        }
        if (errorJson.message === 'invalid-join-code' || errorJson.message === 'join-code-expired') {
          return { error: 'Ogiltig eller utgången inbjudningskod' }
        }
      } catch {
        // Fall through to generic message
      }

      return { error: 'Kunde inte gå med i hushållet. Försök igen.' }
    }

    const result = await response.json()

    revalidatePath('/hushall', 'layout')

    return { home_id: result }
  } catch (error) {
    console.error('Error joining home by code:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function inviteToHome(
  email: string
): Promise<{ id: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att bjuda in någon' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/invite_to_home`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_email: email }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to invite to home:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'user-has-no-home') {
          return { error: 'Du är inte medlem i något hushåll' }
        }
        if (errorJson.message === 'user-already-member') {
          return { error: 'Personen är redan medlem i ditt hushåll' }
        }
        if (errorJson.message === 'invitation-already-pending') {
          return { error: 'Personen har redan en väntande inbjudan' }
        }
        if (errorJson.message === 'cannot-invite-self') {
          return { error: 'Du kan inte bjuda in dig själv' }
        }
      } catch {
        // Fall through to generic message
      }

      return { error: 'Kunde inte skicka inbjudan. Försök igen.' }
    }

    const result = await response.json()

    revalidatePath('/hushall', 'layout')

    return { id: result }
  } catch (error) {
    console.error('Error inviting to home:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function acceptInvitation(
  token: string
): Promise<{ home_id: string } | { error: string }> {
  try {
    const postgrestToken = await getPostgrestToken()

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att acceptera inbjudan' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/accept_invitation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${postgrestToken}`,
      },
      body: JSON.stringify({ p_token: token }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to accept invitation:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'invalid-invitation-token' || errorJson.message === 'invitation-expired') {
          return { error: 'Ogiltig eller utgången inbjudan' }
        }
        if (errorJson.message === 'user-already-has-home') {
          return { error: 'Du är redan medlem i ett hushåll' }
        }
        if (errorJson.message === 'invitation-not-for-user') {
          return { error: 'Inbjudan är inte avsedd för denna e-postadress' }
        }
      } catch {
        // Fall through to generic message
      }

      return { error: 'Kunde inte acceptera inbjudan. Försök igen.' }
    }

    const result = await response.json()

    revalidatePath('/hushall', 'layout')

    return { home_id: result }
  } catch (error) {
    console.error('Error accepting invitation:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function declineInvitation(
  token: string
): Promise<{ success: true } | { error: string }> {
  try {
    const postgrestToken = await getPostgrestToken()

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att avböja inbjudan' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/decline_invitation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${postgrestToken}`,
      },
      body: JSON.stringify({ p_token: token }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to decline invitation:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'invalid-invitation-token') {
          return { error: 'Ogiltig eller utgången inbjudan' }
        }
        if (errorJson.message === 'invitation-not-for-user') {
          return { error: 'Inbjudan är inte avsedd för denna e-postadress' }
        }
      } catch {
        // Fall through to generic message
      }

      return { error: 'Kunde inte avböja inbjudan. Försök igen.' }
    }

    revalidatePath('/hushall', 'layout')

    return { success: true }
  } catch (error) {
    console.error('Error declining invitation:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function getHomeInfo(): Promise<HomeInfo | null> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return null
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/get_home_info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to get home info:', errorText)
      return null
    }

    const result = await response.json()

    // RPC returns JSONB directly (not wrapped in array)
    // If user is not in a home, function returns null
    if (result === null) {
      return null
    }

    return {
      id: result.id,
      name: result.name,
      join_code: result.join_code,
      join_code_expires_at: result.join_code_expires_at,
      member_count: result.members?.length || 0,
      members: result.members || [],
    }
  } catch (error) {
    console.error('Error getting home info:', error)
    return null
  }
}

export async function getPendingInvitations(): Promise<HomeInvitation[]> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return []
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/get_pending_invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to get pending invitations:', errorText)
      return []
    }

    const result = await response.json()

    return result as HomeInvitation[]
  } catch (error) {
    console.error('Error getting pending invitations:', error)
    return []
  }
}

export async function removeMember(
  email: string
): Promise<{ success: true } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att ta bort en medlem' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/remove_home_member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_member_email: email }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to remove member:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'user-has-no-home') {
          return { error: 'Du är inte medlem i något hushåll' }
        }
        if (errorJson.message === 'member-not-found') {
          return { error: 'Användaren hittades inte i ditt hushåll' }
        }
        if (errorJson.message === 'cannot-remove-self') {
          return { error: 'Du kan inte ta bort dig själv. Använd "Lämna hushållet" istället' }
        }
      } catch {
        // Fall through to generic message
      }

      return { error: 'Kunde inte ta bort medlemmen. Försök igen.' }
    }

    revalidatePath('/hushall', 'layout')

    return { success: true }
  } catch (error) {
    console.error('Error removing member:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function cancelInvitation(
  invitationId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att avbryta inbjudan' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/cancel_invitation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_invitation_id: invitationId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to cancel invitation:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'invitation-not-found') {
          return { error: 'Inbjudan hittades inte' }
        }
        if (errorJson.message === 'not-invitation-owner') {
          return { error: 'Du har inte behörighet att avbryta denna inbjudan' }
        }
      } catch {
        // Fall through to generic message
      }

      return { error: 'Kunde inte avbryta inbjudan. Försök igen.' }
    }

    revalidatePath('/hushall', 'layout')

    return { success: true }
  } catch (error) {
    console.error('Error cancelling invitation:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

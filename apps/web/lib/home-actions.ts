import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { HomeInfo, HomeInvitation, UserHome } from '@/lib/types'
import { postgrestHeaders } from '@/lib/action-utils'
import { actionAuthMiddleware } from './middleware'
import { env } from '@/lib/env'
import { logger as rootLogger } from '@/lib/logger'
const logger = rootLogger.child({ module: 'home' })

// ============================================================================
// Server Functions
// ============================================================================

const createHomeFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ name: z.string() }))
  .handler(async ({ data, context }): Promise<{ id: string } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att skapa ett hushåll' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/create_home`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_name: data.name }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email }, 'Failed to create home')
        return { error: 'Kunde inte skapa hushållet. Försök igen.' }
      }

      const result = await response.json()

      return { id: result }
    } catch (error) {
      logger.error({ err: error, email: context.session?.email }, 'Error creating home')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const updateHomeNameFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ name: z.string(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ success: true } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att uppdatera hushållet' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/update_home_name`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({ p_name: data.name }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email, homeId: data.homeId }, 'Failed to update home name')

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

      return { success: true }
    } catch (error) {
      logger.error({ err: error, email: context.session?.email, homeId: data.homeId }, 'Error updating home name')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const leaveHomeFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ success: true } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att lämna hushållet' }
    }

    try {
      const body: Record<string, string> = {}
      if (data.homeId) {
        body.p_home_id = data.homeId
      }

      const response = await fetch(`${env.POSTGREST_URL}/rpc/leave_home`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email, homeId: data.homeId }, 'Failed to leave home')

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

      return { success: true }
    } catch (error) {
      logger.error({ err: error, email: context.session?.email, homeId: data.homeId }, 'Error leaving home')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const generateJoinCodeFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ expiresHours: z.number().optional(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ code: string; expires_at: string } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att skapa en inbjudningskod' }
    }

    try {
      const payload: { p_expires_hours?: number } = {}
      if (data.expiresHours !== undefined) {
        payload.p_expires_hours = data.expiresHours
      }

      const response = await fetch(`${env.POSTGREST_URL}/rpc/generate_join_code`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email, homeId: data.homeId }, 'Failed to generate join code')

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

      const hours = data.expiresHours ?? 168
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

      return { code, expires_at: expiresAt }
    } catch (error) {
      logger.error({ err: error, email: context.session?.email, homeId: data.homeId }, 'Error generating join code')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const disableJoinCodeFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ success: true } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att inaktivera inbjudningskoden' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/disable_join_code`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email, homeId: data.homeId }, 'Failed to disable join code')

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

      return { success: true }
    } catch (error) {
      logger.error({ err: error, email: context.session?.email, homeId: data.homeId }, 'Error disabling join code')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const joinHomeByCodeFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ code: z.string() }))
  .handler(async ({ data, context }): Promise<{ home_id: string } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att gå med i ett hushåll' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/join_home_by_code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_code: data.code }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email }, 'Failed to join home by code')

        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.message === 'invalid-join-code' || errorJson.message === 'join-code-expired') {
            return { error: 'Ogiltig eller utgången inbjudningskod' }
          }
        } catch {
          // Fall through to generic message
        }

        return { error: 'Kunde inte gå med i hushållet. Försök igen.' }
      }

      const result = await response.json()

      return { home_id: result }
    } catch (error) {
      logger.error({ err: error, email: context.session?.email }, 'Error joining home by code')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const inviteToHomeFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ email: z.string(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ id: string } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att bjuda in någon' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/invite_to_home`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({ p_email: data.email }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email, homeId: data.homeId }, 'Failed to invite to home')

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

      return { id: result }
    } catch (error) {
      logger.error({ err: error, email: context.session?.email, homeId: data.homeId }, 'Error inviting to home')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const acceptInvitationFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data, context }): Promise<{ home_id: string } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att acceptera inbjudan' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/accept_invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_token: data.token }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email }, 'Failed to accept invitation')

        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.message === 'invalid-invitation-token' || errorJson.message === 'invitation-expired') {
            return { error: 'Ogiltig eller utgången inbjudan' }
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

      return { home_id: result }
    } catch (error) {
      logger.error({ err: error, email: context.session?.email }, 'Error accepting invitation')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const declineInvitationFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data, context }): Promise<{ success: true } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att avböja inbjudan' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/decline_invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_token: data.token }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email }, 'Failed to decline invitation')

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

      return { success: true }
    } catch (error) {
      logger.error({ err: error, email: context.session?.email }, 'Error declining invitation')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const getHomeInfoFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<HomeInfo | null> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return null
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/get_home_info`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken),
        body: JSON.stringify({ p_home_id: data.homeId ?? null }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email, homeId: data.homeId }, 'Failed to get home info')
        return null
      }

      const result = await response.json()

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
      logger.error({ err: error, email: context.session?.email, homeId: data.homeId }, 'Error getting home info')
      return null
    }
  })

const getPendingInvitationsFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .handler(async ({ context }): Promise<HomeInvitation[]> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return []
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/get_pending_invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email }, 'Failed to get pending invitations')
        return []
      }

      const result = await response.json()

      return result as HomeInvitation[]
    } catch (error) {
      logger.error({ err: error, email: context.session?.email }, 'Error getting pending invitations')
      return []
    }
  })

const removeMemberFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ email: z.string(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ success: true } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att ta bort en medlem' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/remove_home_member`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({ p_member_email: data.email }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email, homeId: data.homeId }, 'Failed to remove member')

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

      return { success: true }
    } catch (error) {
      logger.error({ err: error, email: context.session?.email, homeId: data.homeId }, 'Error removing member')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const cancelInvitationFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ invitationId: z.string(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ success: true } | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att avbryta inbjudan' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/cancel_invitation`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({ p_invitation_id: data.invitationId }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email, homeId: data.homeId, invitationId: data.invitationId }, 'Failed to cancel invitation')

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

      return { success: true }
    } catch (error) {
      logger.error({ err: error, email: context.session?.email, homeId: data.homeId, invitationId: data.invitationId }, 'Error cancelling invitation')
      return { error: 'Ett oväntat fel uppstod. Försök igen.' }
    }
  })

const getUserHomesFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .handler(async ({ context }): Promise<UserHome[] | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/get_user_homes`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken),
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ err: errorText, email: context.session?.email }, 'Failed to get user homes')
        return { error: 'Kunde inte hämta hushåll' }
      }

      const result = await response.json()

      return result as UserHome[]
    } catch (error) {
      logger.error({ err: error, email: context.session?.email }, 'Error getting user homes')
      return { error: 'Ett oväntat fel uppstod' }
    }
  })

// ============================================================================
// Exported wrappers (preserve existing call signatures)
// ============================================================================

export async function createHome(name: string): Promise<{ id: string } | { error: string }> {
  return createHomeFn({ data: { name } })
}

export async function updateHomeName(name: string, homeId?: string): Promise<{ success: true } | { error: string }> {
  return updateHomeNameFn({ data: { name, homeId } })
}

export async function leaveHome(homeId?: string): Promise<{ success: true } | { error: string }> {
  return leaveHomeFn({ data: { homeId } })
}

export async function generateJoinCode(expiresHours?: number, homeId?: string): Promise<{ code: string; expires_at: string } | { error: string }> {
  return generateJoinCodeFn({ data: { expiresHours, homeId } })
}

export async function disableJoinCode(homeId?: string): Promise<{ success: true } | { error: string }> {
  return disableJoinCodeFn({ data: { homeId } })
}

export async function joinHomeByCode(code: string): Promise<{ home_id: string } | { error: string }> {
  return joinHomeByCodeFn({ data: { code } })
}

export async function inviteToHome(email: string, homeId?: string): Promise<{ id: string } | { error: string }> {
  return inviteToHomeFn({ data: { email, homeId } })
}

export async function acceptInvitation(token: string): Promise<{ home_id: string } | { error: string }> {
  return acceptInvitationFn({ data: { token } })
}

export async function declineInvitation(token: string): Promise<{ success: true } | { error: string }> {
  return declineInvitationFn({ data: { token } })
}

export async function getHomeInfo(homeId?: string): Promise<HomeInfo | null> {
  return getHomeInfoFn({ data: { homeId } })
}

export async function getPendingInvitations(): Promise<HomeInvitation[]> {
  return getPendingInvitationsFn()
}

export async function removeMember(email: string, homeId?: string): Promise<{ success: true } | { error: string }> {
  return removeMemberFn({ data: { email, homeId } })
}

export async function cancelInvitation(invitationId: string, homeId?: string): Promise<{ success: true } | { error: string }> {
  return cancelInvitationFn({ data: { invitationId, homeId } })
}

export async function getUserHomes(): Promise<UserHome[] | { error: string }> {
  return getUserHomesFn()
}

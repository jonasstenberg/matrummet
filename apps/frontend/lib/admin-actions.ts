'use server'

import { revalidatePath } from 'next/cache'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import type { UserRole } from './admin-api'

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

async function requireAdminToken(): Promise<{ email: string; token: string }> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  if (session.role !== 'admin') {
    throw new Error('Forbidden')
  }
  const token = await signPostgrestToken(session.email, session.role)
  return { email: session.email, token }
}

// ============================================================================
// Food Actions
// ============================================================================

export async function approveFood(id: string): Promise<ActionResult> {
  try {
    const { token } = await requireAdminToken()

    const response = await fetch(`${env.POSTGREST_URL}/rpc/approve_food`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_food_id: id }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to approve food')
    }

    revalidatePath('/admin/matvaror')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

export async function rejectFood(id: string): Promise<ActionResult> {
  try {
    const { token } = await requireAdminToken()

    const response = await fetch(`${env.POSTGREST_URL}/rpc/reject_food`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_food_id: id }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to reject food')
    }

    revalidatePath('/admin/matvaror')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

export async function renameFood(id: string, name: string): Promise<ActionResult> {
  try {
    if (!name.trim()) {
      return { success: false, error: 'Matvarunamn kan inte vara tomt' }
    }

    const { token } = await requireAdminToken()

    const response = await fetch(`${env.POSTGREST_URL}/foods?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: name.trim() }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
        return { success: false, error: 'En matvara med detta namn finns redan' }
      }
      throw new Error(errorText || 'Failed to rename food')
    }

    revalidatePath('/admin/matvaror')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

export async function deleteFood(id: string): Promise<ActionResult> {
  try {
    const { token } = await requireAdminToken()

    const response = await fetch(`${env.POSTGREST_URL}/foods?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to delete food')
    }

    revalidatePath('/admin/matvaror')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

export async function createFood(name: string): Promise<ActionResult> {
  try {
    if (!name.trim()) {
      return { success: false, error: 'Matvarunamn kan inte vara tomt' }
    }

    const { token } = await requireAdminToken()

    const response = await fetch(`${env.POSTGREST_URL}/foods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ name: name.trim() }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
        return { success: false, error: 'En matvara med detta namn finns redan' }
      }
      throw new Error(errorText || 'Failed to create food')
    }

    revalidatePath('/admin/matvaror')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

export async function approveAsAlias(id: string, canonicalFoodId: string): Promise<ActionResult> {
  try {
    const { token } = await requireAdminToken()

    const response = await fetch(`${env.POSTGREST_URL}/rpc/approve_food_as_alias`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_food_id: id, p_canonical_food_id: canonicalFoodId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to approve food as alias')
    }

    revalidatePath('/admin/matvaror')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

export async function setCanonicalFood(id: string, canonicalFoodId: string | null): Promise<ActionResult> {
  try {
    const { token } = await requireAdminToken()

    const response = await fetch(`${env.POSTGREST_URL}/foods?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ canonical_food_id: canonicalFoodId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to set canonical food')
    }

    revalidatePath('/admin/matvaror')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

export async function bulkApproveFoods(ids: string[]): Promise<ActionResult<{ succeeded: number; failed: number }>> {
  try {
    const { token } = await requireAdminToken()
    let succeeded = 0
    let failed = 0

    await Promise.all(
      ids.map(async (id) => {
        const response = await fetch(`${env.POSTGREST_URL}/rpc/approve_food`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ p_food_id: id }),
        })
        if (response.ok) succeeded++
        else failed++
      })
    )

    revalidatePath('/admin/matvaror')
    return { success: true, data: { succeeded, failed } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

export async function bulkRejectFoods(ids: string[]): Promise<ActionResult<{ succeeded: number; failed: number }>> {
  try {
    const { token } = await requireAdminToken()
    let succeeded = 0
    let failed = 0

    await Promise.all(
      ids.map(async (id) => {
        const response = await fetch(`${env.POSTGREST_URL}/rpc/reject_food`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ p_food_id: id }),
        })
        if (response.ok) succeeded++
        else failed++
      })
    )

    revalidatePath('/admin/matvaror')
    return { success: true, data: { succeeded, failed } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

// ============================================================================
// User Actions
// ============================================================================

export async function updateUserRole(id: string, role: UserRole): Promise<ActionResult> {
  try {
    if (role !== 'user' && role !== 'admin') {
      return { success: false, error: 'Ogiltig roll' }
    }

    const { token } = await requireAdminToken()

    const response = await fetch(`${env.POSTGREST_URL}/rpc/admin_update_user_role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_user_id: id,
        p_new_role: role,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to update user role')
    }

    revalidatePath('/admin/anvandare')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

export async function updateUserName(id: string, name: string): Promise<ActionResult> {
  try {
    if (!name.trim()) {
      return { success: false, error: 'Namn kan inte vara tomt' }
    }

    const { token } = await requireAdminToken()

    const response = await fetch(`${env.POSTGREST_URL}/rpc/admin_update_user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_user_id: id,
        p_name: name.trim(),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to update user')
    }

    revalidatePath('/admin/anvandare')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

export async function deleteUser(id: string): Promise<ActionResult> {
  try {
    const { token } = await requireAdminToken()

    const response = await fetch(`${env.POSTGREST_URL}/rpc/admin_delete_user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_user_id: id,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to delete user')
    }

    revalidatePath('/admin/anvandare')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

export async function grantUserCredits(email: string, amount: number): Promise<ActionResult<{ balance: number }>> {
  try {
    if (!amount || amount < 1 || amount > 1000) {
      return { success: false, error: 'Antal måste vara mellan 1 och 1000' }
    }

    const { token } = await requireAdminToken()

    const response = await fetch(`${env.POSTGREST_URL}/rpc/add_credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_user_email: email,
        p_amount: amount,
        p_transaction_type: 'admin_grant',
        p_description: `Adminbeviljad: ${amount} AI-poäng`,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to grant credits')
    }

    const data = await response.json()
    revalidatePath('/admin/anvandare')
    return { success: true, data: { balance: data } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

// ============================================================================
// Recipe Actions
// ============================================================================

export async function setRecipeFeatured(recipeId: string, featured: boolean): Promise<ActionResult> {
  try {
    const { token } = await requireAdminToken()

    const response = await fetch(`${env.POSTGREST_URL}/rpc/set_recipe_featured`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_recipe_id: recipeId,
        p_featured: featured,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to update featured status')
    }

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
  }
}

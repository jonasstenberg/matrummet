import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { env } from '@/lib/env'
import { actionAdminMiddleware } from './middleware'
import type { UserRole } from './admin-api'

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

// ============================================================================
// Server Functions
// ============================================================================

const approveFoodFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/approve_food`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_food_id: data.id }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to approve food')
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

const rejectFoodFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/reject_food`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_food_id: data.id }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to reject food')
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

const renameFoodFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ id: z.string(), name: z.string() }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    if (!data.name.trim()) {
      return { success: false, error: 'Matvarunamn kan inte vara tomt' }
    }

    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/foods?id=eq.${data.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ name: data.name.trim() }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
          return { success: false, error: 'En matvara med detta namn finns redan' }
        }
        throw new Error(errorText || 'Failed to rename food')
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

const deleteFoodFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/foods?id=eq.${data.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${postgrestToken}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to delete food')
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

const createFoodFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ name: z.string() }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    if (!data.name.trim()) {
      return { success: false, error: 'Matvarunamn kan inte vara tomt' }
    }

    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/foods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ name: data.name.trim() }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
          return { success: false, error: 'En matvara med detta namn finns redan' }
        }
        throw new Error(errorText || 'Failed to create food')
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

const approveAsAliasFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ id: z.string(), canonicalFoodId: z.string() }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/approve_food_as_alias`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_food_id: data.id, p_canonical_food_id: data.canonicalFoodId }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to approve food as alias')
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

const setCanonicalFoodFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ id: z.string(), canonicalFoodId: z.string().nullable() }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/foods?id=eq.${data.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ canonical_food_id: data.canonicalFoodId }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to set canonical food')
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

const bulkApproveFoodsFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ data, context }): Promise<ActionResult<{ succeeded: number; failed: number }>> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      let succeeded = 0
      let failed = 0

      await Promise.all(
        data.ids.map(async (id) => {
          const response = await fetch(`${env.POSTGREST_URL}/rpc/approve_food`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${postgrestToken}`,
            },
            body: JSON.stringify({ p_food_id: id }),
          })
          if (response.ok) succeeded++
          else failed++
        })
      )

      return { success: true, data: { succeeded, failed } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

const bulkRejectFoodsFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ data, context }): Promise<ActionResult<{ succeeded: number; failed: number }>> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      let succeeded = 0
      let failed = 0

      await Promise.all(
        data.ids.map(async (id) => {
          const response = await fetch(`${env.POSTGREST_URL}/rpc/reject_food`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${postgrestToken}`,
            },
            body: JSON.stringify({ p_food_id: id }),
          })
          if (response.ok) succeeded++
          else failed++
        })
      )

      return { success: true, data: { succeeded, failed } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

const updateUserRoleFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ id: z.string(), role: z.string() }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    if (data.role !== 'user' && data.role !== 'admin') {
      return { success: false, error: 'Ogiltig roll' }
    }

    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/admin_update_user_role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({
          p_user_id: data.id,
          p_new_role: data.role,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to update user role')
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

const updateUserNameFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ id: z.string(), name: z.string() }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    if (!data.name.trim()) {
      return { success: false, error: 'Namn kan inte vara tomt' }
    }

    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/admin_update_user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({
          p_user_id: data.id,
          p_name: data.name.trim(),
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to update user')
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

const deleteUserFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/admin_delete_user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({
          p_user_id: data.id,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to delete user')
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

const grantUserCreditsFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ email: z.string(), amount: z.number() }))
  .handler(async ({ data, context }): Promise<ActionResult<{ balance: number }>> => {
    if (!data.amount || data.amount < 1 || data.amount > 1000) {
      return { success: false, error: 'Antal måste vara mellan 1 och 1000' }
    }

    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/add_credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({
          p_user_email: data.email,
          p_amount: data.amount,
          p_transaction_type: 'admin_grant',
          p_description: `Adminbeviljad: ${data.amount} AI-poäng`,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to grant credits')
      }

      const result = await response.json()
      return { success: true, data: { balance: result } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

const setRecipeFeaturedFn = createServerFn({ method: 'POST' })
  .middleware([actionAdminMiddleware])
  .inputValidator(z.object({ recipeId: z.string(), featured: z.boolean() }))
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { success: false, error: 'Unauthorized' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/set_recipe_featured`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({
          p_recipe_id: data.recipeId,
          p_featured: data.featured,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to update featured status')
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Ett fel uppstod' }
    }
  })

// ============================================================================
// Exported wrappers (preserve existing call signatures)
// ============================================================================

export async function approveFood(id: string): Promise<ActionResult> {
  return approveFoodFn({ data: { id } })
}

export async function rejectFood(id: string): Promise<ActionResult> {
  return rejectFoodFn({ data: { id } })
}

export async function renameFood(id: string, name: string): Promise<ActionResult> {
  return renameFoodFn({ data: { id, name } })
}

export async function deleteFood(id: string): Promise<ActionResult> {
  return deleteFoodFn({ data: { id } })
}

export async function createFood(name: string): Promise<ActionResult> {
  return createFoodFn({ data: { name } })
}

export async function approveAsAlias(id: string, canonicalFoodId: string): Promise<ActionResult> {
  return approveAsAliasFn({ data: { id, canonicalFoodId } })
}

export async function setCanonicalFood(id: string, canonicalFoodId: string | null): Promise<ActionResult> {
  return setCanonicalFoodFn({ data: { id, canonicalFoodId } })
}

export async function bulkApproveFoods(ids: string[]): Promise<ActionResult<{ succeeded: number; failed: number }>> {
  return bulkApproveFoodsFn({ data: { ids } })
}

export async function bulkRejectFoods(ids: string[]): Promise<ActionResult<{ succeeded: number; failed: number }>> {
  return bulkRejectFoodsFn({ data: { ids } })
}

export async function updateUserRole(id: string, role: UserRole): Promise<ActionResult> {
  return updateUserRoleFn({ data: { id, role } })
}

export async function updateUserName(id: string, name: string): Promise<ActionResult> {
  return updateUserNameFn({ data: { id, name } })
}

export async function deleteUser(id: string): Promise<ActionResult> {
  return deleteUserFn({ data: { id } })
}

export async function grantUserCredits(email: string, amount: number): Promise<ActionResult<{ balance: number }>> {
  return grantUserCreditsFn({ data: { email, amount } })
}

export async function setRecipeFeatured(recipeId: string, featured: boolean): Promise<ActionResult> {
  return setRecipeFeaturedFn({ data: { recipeId, featured } })
}

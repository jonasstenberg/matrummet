import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { ShoppingList } from '@/lib/types'
import { postgrestHeaders } from './action-utils'
import { actionAuthMiddleware } from './middleware'
import { shoppingListsArraySchema } from './schemas'
import { env } from '@/lib/env'

// ============================================================================
// Server Functions
// ============================================================================

const addRecipeToShoppingListFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({
    recipeId: z.string(),
    options: z.object({
      servings: z.number().optional(),
      ingredientIds: z.array(z.string()).optional(),
      listId: z.string().optional(),
    }).optional(),
    homeId: z.string().optional(),
  }))
  .handler(async ({ data, context }): Promise<{ success: true; listId: string; addedCount: number } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'shopping-list' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad för att lägga till i inköpslistan' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/add_recipe_to_shopping_list`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({
          p_recipe_id: data.recipeId,
          p_shopping_list_id: data.options?.listId ?? null,
          p_servings: data.options?.servings ?? null,
          p_ingredient_ids: data.options?.ingredientIds ?? null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText, recipeId: data.recipeId }, 'Failed to add recipe to shopping list')
        return { error: 'Kunde inte lägga till i inköpslistan' }
      }

      const result = await response.json()

      return {
        success: true,
        listId: result.list_id,
        addedCount: result.added_count,
      }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), recipeId: data.recipeId }, 'Error adding recipe to shopping list')
      return { error: 'Ett oväntat fel uppstod' }
    }
  })

const toggleShoppingListItemFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ itemId: z.string(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ checked: boolean } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'shopping-list' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/toggle_shopping_list_item`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({ p_item_id: data.itemId }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText, itemId: data.itemId }, 'Failed to toggle shopping list item')
        return { error: 'Kunde inte uppdatera objektet' }
      }

      const result = await response.json()

      return { checked: result.is_checked }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), itemId: data.itemId }, 'Error toggling shopping list item')
      return { error: 'Kunde inte uppdatera objektet' }
    }
  })

const clearCheckedItemsFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ listId: z.string().optional(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ success: true; cleared: number } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'shopping-list' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/clear_checked_items`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({ p_shopping_list_id: data.listId || null }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText, listId: data.listId }, 'Failed to clear checked items')
        return { error: 'Kunde inte rensa avbockade objekt' }
      }

      const result = await response.json()

      return { success: true, cleared: result.cleared ?? result }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), listId: data.listId }, 'Error clearing checked items')
      return { error: 'Kunde inte rensa avbockade objekt' }
    }
  })

const getUserShoppingListsFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<ShoppingList[] | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'shopping-list' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/get_user_shopping_lists`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText }, 'Failed to get shopping lists')
        return { error: 'Kunde inte hämta inköpslistor' }
      }

      const rawResult = await response.json()

      const result = shoppingListsArraySchema.safeParse(rawResult)
      if (!result.success) {
        log.error({ detail: result.error.message }, 'Shopping lists validation failed')
        return { error: 'Ogiltigt svar från servern' }
      }

      return result.data as ShoppingList[]
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error) }, 'Error getting shopping lists')
      return { error: 'Kunde inte hämta inköpslistor' }
    }
  })

const createShoppingListFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ name: z.string(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ id: string } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'shopping-list' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/create_shopping_list`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({ p_name: data.name, p_home_id: data.homeId ?? null }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText }, 'Failed to create shopping list')

        if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
          return { error: 'En lista med det namnet finns redan' }
        }

        return { error: 'Kunde inte skapa inköpslistan' }
      }

      const result = await response.json()

      return { id: result }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error) }, 'Error creating shopping list')
      return { error: 'Kunde inte skapa inköpslistan' }
    }
  })

const renameShoppingListFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ listId: z.string(), name: z.string(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ success: true } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'shopping-list' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/rename_shopping_list`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({ p_list_id: data.listId, p_name: data.name }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText, listId: data.listId }, 'Failed to rename shopping list')

        if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
          return { error: 'En lista med det namnet finns redan' }
        }

        return { error: 'Kunde inte byta namn på listan' }
      }

      return { success: true }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), listId: data.listId }, 'Error renaming shopping list')
      return { error: 'Kunde inte byta namn på listan' }
    }
  })

const deleteShoppingListFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ listId: z.string(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ success: true } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'shopping-list' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/delete_shopping_list`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({ p_list_id: data.listId }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText, listId: data.listId }, 'Failed to delete shopping list')
        return { error: 'Kunde inte ta bort listan' }
      }

      return { success: true }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), listId: data.listId }, 'Error deleting shopping list')
      return { error: 'Kunde inte ta bort listan' }
    }
  })

const addCustomShoppingListItemFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ name: z.string(), listId: z.string().optional(), foodId: z.string().optional(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ success: true; itemId: string; listId: string } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'shopping-list' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const trimmed = data.name.trim()
      if (!trimmed) {
        return { error: 'Ange ett namn för varan' }
      }

      const response = await fetch(`${env.POSTGREST_URL}/rpc/add_custom_shopping_list_item`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({
          p_name: trimmed,
          p_shopping_list_id: data.listId ?? null,
          p_food_id: data.foodId ?? null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText, listId: data.listId }, 'Failed to add custom item')
        return { error: 'Kunde inte lägga till varan' }
      }

      const result = await response.json()

      return {
        success: true,
        itemId: result.item_id,
        listId: result.list_id,
      }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), listId: data.listId }, 'Error adding custom item')
      return { error: 'Ett oväntat fel uppstod' }
    }
  })

const setDefaultShoppingListFn = createServerFn({ method: 'POST' })
  .middleware([actionAuthMiddleware])
  .inputValidator(z.object({ listId: z.string(), homeId: z.string().optional() }))
  .handler(async ({ data, context }): Promise<{ success: true } | { error: string }> => {
    const { postgrestToken, logger: requestLogger } = context
    const log = requestLogger.child({ module: 'shopping-list' })

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/set_default_shopping_list`, {
        method: 'POST',
        headers: await postgrestHeaders(postgrestToken, data.homeId),
        body: JSON.stringify({ p_list_id: data.listId }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error({ responseBody: errorText, listId: data.listId }, 'Failed to set default shopping list')
        return { error: 'Kunde inte ändra standardlista' }
      }

      return { success: true }
    } catch (error) {
      log.error({ err: error instanceof Error ? error : String(error), listId: data.listId }, 'Error setting default shopping list')
      return { error: 'Kunde inte ändra standardlista' }
    }
  })

// ============================================================================
// Exported wrappers (preserve existing call signatures)
// ============================================================================

export async function addRecipeToShoppingList(
  recipeId: string,
  options?: { servings?: number; ingredientIds?: string[]; listId?: string },
  homeId?: string
): Promise<{ success: true; listId: string; addedCount: number } | { error: string }> {
  return addRecipeToShoppingListFn({ data: { recipeId, options, homeId } })
}

export async function toggleShoppingListItem(
  itemId: string,
  homeId?: string
): Promise<{ checked: boolean } | { error: string }> {
  return toggleShoppingListItemFn({ data: { itemId, homeId } })
}

export async function clearCheckedItems(
  listId?: string,
  homeId?: string
): Promise<{ success: true; cleared: number } | { error: string }> {
  return clearCheckedItemsFn({ data: { listId, homeId } })
}

export async function getUserShoppingLists(
  homeId?: string
): Promise<ShoppingList[] | { error: string }> {
  return getUserShoppingListsFn({ data: { homeId } })
}

export async function createShoppingList(
  name: string,
  homeId?: string
): Promise<{ id: string } | { error: string }> {
  return createShoppingListFn({ data: { name, homeId } })
}

export async function renameShoppingList(
  listId: string,
  name: string,
  homeId?: string
): Promise<{ success: true } | { error: string }> {
  return renameShoppingListFn({ data: { listId, name, homeId } })
}

export async function deleteShoppingList(
  listId: string,
  homeId?: string
): Promise<{ success: true } | { error: string }> {
  return deleteShoppingListFn({ data: { listId, homeId } })
}

export async function addCustomShoppingListItem(
  name: string,
  listId?: string,
  foodId?: string,
  homeId?: string
): Promise<{ success: true; itemId: string; listId: string } | { error: string }> {
  return addCustomShoppingListItemFn({ data: { name, listId, foodId, homeId } })
}

export async function setDefaultShoppingList(
  listId: string,
  homeId?: string
): Promise<{ success: true } | { error: string }> {
  return setDefaultShoppingListFn({ data: { listId, homeId } })
}

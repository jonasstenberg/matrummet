'use server'

import { revalidatePath } from 'next/cache'
import { ShoppingList } from '@/lib/types'
import { getPostgrestToken } from './action-utils'
import { shoppingListsArraySchema } from './schemas'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:4444'

export async function addRecipeToShoppingList(
  recipeId: string,
  options?: {
    servings?: number
    ingredientIds?: string[]
    listId?: string
  }
): Promise<{ success: true; listId: string; addedCount: number } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att lägga till i inköpslistan' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/add_recipe_to_shopping_list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_recipe_id: recipeId,
        p_shopping_list_id: options?.listId ?? null,
        p_servings: options?.servings ?? null,
        p_ingredient_ids: options?.ingredientIds ?? null,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to add recipe to shopping list:', errorText)
      return { error: 'Kunde inte lägga till i inköpslistan' }
    }

    const result = await response.json()

    revalidatePath('/inkopslista')

    return {
      success: true,
      listId: result.list_id,
      addedCount: result.added_count,
    }
  } catch (error) {
    console.error('Error adding recipe to shopping list:', error)
    return { error: 'Ett oväntat fel uppstod' }
  }
}

export async function toggleShoppingListItem(
  itemId: string
): Promise<{ checked: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/toggle_shopping_list_item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_item_id: itemId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to toggle shopping list item:', errorText)
      return { error: 'Kunde inte uppdatera objektet' }
    }

    const result = await response.json()

    revalidatePath('/inkopslista')

    return { checked: result.checked }
  } catch (error) {
    console.error('Error toggling shopping list item:', error)
    return { error: 'Kunde inte uppdatera objektet' }
  }
}

export async function clearCheckedItems(
  listId?: string
): Promise<{ success: true; cleared: number } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/clear_checked_items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_shopping_list_id: listId || null }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to clear checked items:', errorText)
      return { error: 'Kunde inte rensa avbockade objekt' }
    }

    const result = await response.json()

    revalidatePath('/inkopslista')

    return { success: true, cleared: result.cleared ?? result }
  } catch (error) {
    console.error('Error clearing checked items:', error)
    return { error: 'Kunde inte rensa avbockade objekt' }
  }
}

export async function getUserShoppingLists(): Promise<ShoppingList[] | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/get_user_shopping_lists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to get shopping lists:', errorText)
      return { error: 'Kunde inte hämta inköpslistor' }
    }

    const rawResult = await response.json()

    // Validate with Zod schema
    const result = shoppingListsArraySchema.safeParse(rawResult)
    if (!result.success) {
      console.error('Shopping lists validation failed:', result.error.message)
      return { error: 'Ogiltigt svar från servern' }
    }

    return result.data as ShoppingList[]
  } catch (error) {
    console.error('Error getting shopping lists:', error)
    return { error: 'Kunde inte hämta inköpslistor' }
  }
}

export async function createShoppingList(
  name: string
): Promise<{ id: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/create_shopping_list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_name: name }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to create shopping list:', errorText)

      if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
        return { error: 'En lista med det namnet finns redan' }
      }

      return { error: 'Kunde inte skapa inköpslistan' }
    }

    const result = await response.json()

    revalidatePath('/inkopslista')

    return { id: result }
  } catch (error) {
    console.error('Error creating shopping list:', error)
    return { error: 'Kunde inte skapa inköpslistan' }
  }
}

export async function renameShoppingList(
  listId: string,
  name: string
): Promise<{ success: true } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/rename_shopping_list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_list_id: listId, p_name: name }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to rename shopping list:', errorText)

      if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
        return { error: 'En lista med det namnet finns redan' }
      }

      return { error: 'Kunde inte byta namn på listan' }
    }

    revalidatePath('/inkopslista')

    return { success: true }
  } catch (error) {
    console.error('Error renaming shopping list:', error)
    return { error: 'Kunde inte byta namn på listan' }
  }
}

export async function deleteShoppingList(
  listId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/delete_shopping_list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_list_id: listId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to delete shopping list:', errorText)
      return { error: 'Kunde inte ta bort listan' }
    }

    revalidatePath('/inkopslista')

    return { success: true }
  } catch (error) {
    console.error('Error deleting shopping list:', error)
    return { error: 'Kunde inte ta bort listan' }
  }
}

export async function addCustomShoppingListItem(
  name: string,
  listId?: string,
  foodId?: string
): Promise<{ success: true; itemId: string; listId: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const trimmed = name.trim()
    if (!trimmed) {
      return { error: 'Ange ett namn för varan' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/add_custom_shopping_list_item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_name: trimmed,
        p_shopping_list_id: listId ?? null,
        p_food_id: foodId ?? null,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to add custom item:', errorText)
      return { error: 'Kunde inte lägga till varan' }
    }

    const result = await response.json()

    revalidatePath('/inkopslista')

    return {
      success: true,
      itemId: result.item_id,
      listId: result.list_id,
    }
  } catch (error) {
    console.error('Error adding custom item:', error)
    return { error: 'Ett oväntat fel uppstod' }
  }
}

export async function setDefaultShoppingList(
  listId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad' }
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/set_default_shopping_list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_list_id: listId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to set default shopping list:', errorText)
      return { error: 'Kunde inte ändra standardlista' }
    }

    revalidatePath('/inkopslista')

    return { success: true }
  } catch (error) {
    console.error('Error setting default shopping list:', error)
    return { error: 'Kunde inte ändra standardlista' }
  }
}

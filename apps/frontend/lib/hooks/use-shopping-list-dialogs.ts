import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  createShoppingList,
  renameShoppingList,
  deleteShoppingList,
  setDefaultShoppingList,
} from '@/lib/actions'
import type { ShoppingList } from '@/lib/types'

// Discriminated union for dialog state
export type DialogState =
  | { type: 'closed' }
  | { type: 'create'; name: string; isSubmitting: boolean; error: string | null }
  | { type: 'rename'; list: ShoppingList; name: string; isSubmitting: boolean; error: string | null }
  | { type: 'delete'; list: ShoppingList; isSubmitting: boolean; error: string | null }

export interface UseShoppingListDialogsOptions {
  lists: ShoppingList[]
  selectedListId: string | null
  onSelectList: (listId: string) => void
}

export interface UseShoppingListDialogsReturn {
  dialog: DialogState
  error: string | null

  // Dialog openers
  openCreateDialog: () => void
  openRenameDialog: (list: ShoppingList) => void
  openDeleteDialog: (list: ShoppingList) => void
  closeDialog: () => void

  // Handlers
  handleCreate: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  handleRename: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  handleDelete: () => Promise<void>
  handleSetDefault: (list: ShoppingList) => Promise<void>

  // Setters for controlled inputs
  setCreateName: (name: string) => void
  setRenameName: (name: string) => void
  clearError: () => void
}

/**
 * Hook for managing shopping list dialog state and handlers
 *
 * Handles:
 * - Create, rename, delete dialog state
 * - Form submission with validation
 * - API calls to shopping list actions
 * - Error handling
 */
export function useShoppingListDialogs(
  options: UseShoppingListDialogsOptions
): UseShoppingListDialogsReturn {
  const { lists, selectedListId, onSelectList } = options
  const router = useRouter()

  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>({ type: 'closed' })

  const openCreateDialog = useCallback(() => {
    setDialog({ type: 'create', name: '', isSubmitting: false, error: null })
  }, [])

  const openRenameDialog = useCallback((list: ShoppingList) => {
    setDialog({ type: 'rename', list, name: list.name, isSubmitting: false, error: null })
  }, [])

  const openDeleteDialog = useCallback((list: ShoppingList) => {
    setDialog({ type: 'delete', list, isSubmitting: false, error: null })
  }, [])

  const closeDialog = useCallback(() => {
    setDialog({ type: 'closed' })
  }, [])

  const setCreateName = useCallback((name: string) => {
    setDialog((prev) => {
      if (prev.type !== 'create') return prev
      return { ...prev, name }
    })
  }, [])

  const setRenameName = useCallback((name: string) => {
    setDialog((prev) => {
      if (prev.type !== 'rename') return prev
      return { ...prev, name }
    })
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const handleCreate = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (dialog.type !== 'create') return

    if (!dialog.name.trim()) {
      setDialog({ ...dialog, error: 'Ange ett namn för listan' })
      return
    }

    setDialog({ ...dialog, isSubmitting: true, error: null })

    try {
      const result = await createShoppingList(dialog.name.trim())

      if ('error' in result) {
        setDialog({ ...dialog, isSubmitting: false, error: result.error })
        return
      }

      setDialog({ type: 'closed' })
      onSelectList(result.id)
      router.refresh()
    } catch {
      setDialog({ ...dialog, isSubmitting: false, error: 'Ett oväntat fel uppstod' })
    }
  }, [dialog, onSelectList, router])

  const handleRename = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (dialog.type !== 'rename') return

    if (!dialog.name.trim()) {
      setDialog({ ...dialog, error: 'Ange ett namn för listan' })
      return
    }

    if (dialog.name.trim() === dialog.list.name) {
      setDialog({ type: 'closed' })
      return
    }

    setDialog({ ...dialog, isSubmitting: true, error: null })

    try {
      const result = await renameShoppingList(dialog.list.id, dialog.name.trim())

      if ('error' in result) {
        setDialog({ ...dialog, isSubmitting: false, error: result.error })
        return
      }

      setDialog({ type: 'closed' })
      router.refresh()
    } catch {
      setDialog({ ...dialog, isSubmitting: false, error: 'Ett oväntat fel uppstod' })
    }
  }, [dialog, router])

  const handleDelete = useCallback(async () => {
    if (dialog.type !== 'delete') return

    setDialog({ ...dialog, isSubmitting: true, error: null })

    try {
      const result = await deleteShoppingList(dialog.list.id)

      if ('error' in result) {
        setDialog({ ...dialog, isSubmitting: false, error: result.error })
        return
      }

      // If we deleted the selected list, select the default or first list
      if (selectedListId === dialog.list.id) {
        const remainingLists = lists.filter((l) => l.id !== dialog.list.id)
        const newDefault = remainingLists.find((l) => l.is_default) || remainingLists[0]
        if (newDefault) {
          onSelectList(newDefault.id)
        }
      }

      setDialog({ type: 'closed' })
      router.refresh()
    } catch {
      setDialog({ ...dialog, isSubmitting: false, error: 'Ett oväntat fel uppstod' })
    }
  }, [dialog, selectedListId, lists, onSelectList, router])

  const handleSetDefault = useCallback(async (list: ShoppingList) => {
    if (list.is_default) return

    try {
      const result = await setDefaultShoppingList(list.id)

      if ('error' in result) {
        setError(result.error)
        return
      }

      router.refresh()
    } catch {
      setError('Ett oväntat fel uppstod')
    }
  }, [router])

  return {
    dialog,
    error,
    openCreateDialog,
    openRenameDialog,
    openDeleteDialog,
    closeDialog,
    handleCreate,
    handleRename,
    handleDelete,
    handleSetDefault,
    setCreateName,
    setRenameName,
    clearError,
  }
}

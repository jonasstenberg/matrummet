'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  createShoppingList,
  renameShoppingList,
  deleteShoppingList,
  setDefaultShoppingList,
} from '@/lib/actions'
import type { ShoppingList } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react'

interface ShoppingListManagerProps {
  lists: ShoppingList[]
  selectedListId: string | null
  onSelectList: (listId: string) => void
}

export function ShoppingListManager({
  lists,
  selectedListId,
  onSelectList,
}: ShoppingListManagerProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [listToRename, setListToRename] = useState<ShoppingList | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [listToDelete, setListToDelete] = useState<ShoppingList | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Actions menu state
  const [actionsMenuOpen, setActionsMenuOpen] = useState<string | null>(null)

  // Use tabs for 3 or fewer lists, otherwise use a custom selector
  const useTabs = lists.length <= 3

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreateError(null)

    if (!newListName.trim()) {
      setCreateError('Ange ett namn för listan')
      return
    }

    setIsCreating(true)

    try {
      const result = await createShoppingList(newListName.trim())

      if ('error' in result) {
        setCreateError(result.error)
        return
      }

      setCreateDialogOpen(false)
      setNewListName('')

      // Select the new list and refresh to get updated data
      onSelectList(result.id)
      router.refresh()
    } catch {
      setCreateError('Ett oväntat fel uppstod')
    } finally {
      setIsCreating(false)
    }
  }

  function openRenameDialog(list: ShoppingList) {
    setListToRename(list)
    setRenameValue(list.name)
    setRenameError(null)
    setRenameDialogOpen(true)
    setActionsMenuOpen(null)
  }

  async function handleRename(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!listToRename) return
    setRenameError(null)

    if (!renameValue.trim()) {
      setRenameError('Ange ett namn för listan')
      return
    }

    if (renameValue.trim() === listToRename.name) {
      setRenameDialogOpen(false)
      return
    }

    setIsRenaming(true)

    try {
      const result = await renameShoppingList(listToRename.id, renameValue.trim())

      if ('error' in result) {
        setRenameError(result.error)
        return
      }

      setRenameDialogOpen(false)
      setListToRename(null)
      router.refresh()
    } catch {
      setRenameError('Ett oväntat fel uppstod')
    } finally {
      setIsRenaming(false)
    }
  }

  function openDeleteDialog(list: ShoppingList) {
    setListToDelete(list)
    setDeleteError(null)
    setDeleteDialogOpen(true)
    setActionsMenuOpen(null)
  }

  async function handleDelete() {
    if (!listToDelete) return
    setDeleteError(null)
    setIsDeleting(true)

    try {
      const result = await deleteShoppingList(listToDelete.id)

      if ('error' in result) {
        setDeleteError(result.error)
        return
      }

      setDeleteDialogOpen(false)

      // If we deleted the selected list, select the default or first list
      if (selectedListId === listToDelete.id) {
        const remainingLists = lists.filter((l) => l.id !== listToDelete.id)
        const newDefault = remainingLists.find((l) => l.is_default) || remainingLists[0]
        if (newDefault) {
          onSelectList(newDefault.id)
        }
      }

      setListToDelete(null)
      router.refresh()
    } catch {
      setDeleteError('Ett oväntat fel uppstod')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleSetDefault(list: ShoppingList) {
    if (list.is_default) return
    setActionsMenuOpen(null)

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
  }

  function toggleActionsMenu(listId: string) {
    setActionsMenuOpen((prev) => (prev === listId ? null : listId))
  }

  const selectedList = lists.find((l) => l.id === selectedListId)

  if (lists.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Skapa inköpslista
        </Button>

        {/* Create dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Skapa ny inköpslista</DialogTitle>
              <DialogDescription>
                Ge din inköpslista ett namn.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="listName">Namn</Label>
                  <Input
                    id="listName"
                    type="text"
                    placeholder="t.ex. Veckohandling"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    disabled={isCreating}
                    autoFocus
                  />
                </div>
                {createError && (
                  <Alert variant="destructive">
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreateDialogOpen(false)
                    setNewListName('')
                    setCreateError(null)
                  }}
                  disabled={isCreating}
                >
                  Avbryt
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Skapar...' : 'Skapa lista'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2">
        {useTabs ? (
          // Tab-based interface for 3 or fewer lists
          <Tabs
            value={selectedListId || undefined}
            onValueChange={onSelectList}
            className="flex-1"
          >
            <TabsList className="h-auto flex-wrap justify-start">
              {lists.map((list) => (
                <div key={list.id} className="group relative">
                  <TabsTrigger
                    value={list.id}
                    className="relative pr-8"
                  >
                    {list.is_default && (
                      <Star className="mr-1 h-3 w-3 fill-current" />
                    )}
                    {list.name}
                    {list.item_count > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({list.item_count - list.checked_count})
                      </span>
                    )}
                  </TabsTrigger>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleActionsMenu(list.id)
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 data-[state=open]:opacity-100"
                    data-state={actionsMenuOpen === list.id ? 'open' : 'closed'}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {actionsMenuOpen === list.id && (
                    <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border bg-popover p-1 shadow-md">
                      <button
                        type="button"
                        onClick={() => openRenameDialog(list)}
                        className="flex w-full items-center gap-2 whitespace-nowrap rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <Pencil className="h-4 w-4" />
                        Byt namn
                      </button>
                      {!list.is_default && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(list)}
                          className="flex w-full items-center gap-2 whitespace-nowrap rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                        >
                          <Star className="h-4 w-4" />
                          Ange som standard
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openDeleteDialog(list)}
                        className="flex w-full items-center gap-2 whitespace-nowrap rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                      >
                        <Trash2 className="h-4 w-4" />
                        Ta bort
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          // Dropdown-based interface for more than 3 lists
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => toggleActionsMenu('selector')}
              className="flex w-full items-center justify-between rounded-lg border bg-background px-4 py-2 text-left hover:bg-muted/50"
            >
              <span className="flex items-center gap-2">
                {selectedList?.is_default && (
                  <Star className="h-4 w-4 fill-primary text-primary" />
                )}
                <span className="font-medium">
                  {selectedList?.name || 'Välj lista'}
                </span>
                {selectedList && selectedList.item_count > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ({selectedList.item_count - selectedList.checked_count} varor)
                  </span>
                )}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            {actionsMenuOpen === 'selector' && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover p-1 shadow-md">
                {lists.map((list) => (
                  <div
                    key={list.id}
                    className={cn(
                      'group flex items-center justify-between rounded-sm px-2 py-1.5 hover:bg-accent',
                      list.id === selectedListId && 'bg-accent'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectList(list.id)
                        setActionsMenuOpen(null)
                      }}
                      className="flex flex-1 items-center gap-2 text-sm"
                    >
                      {list.is_default && (
                        <Star className="h-3 w-3 fill-primary text-primary" />
                      )}
                      <span>{list.name}</span>
                      {list.item_count > 0 && (
                        <span className="text-muted-foreground">
                          ({list.item_count - list.checked_count})
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openRenameDialog(list)
                        }}
                        className="rounded p-1 hover:bg-muted"
                        title="Byt namn"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      {!list.is_default && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSetDefault(list)
                          }}
                          className="rounded p-1 hover:bg-muted"
                          title="Ange som standard"
                        >
                          <Star className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDeleteDialog(list)
                        }}
                        className="rounded p-1 text-destructive hover:bg-muted"
                        title="Ta bort"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Ny lista
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skapa ny inköpslista</DialogTitle>
            <DialogDescription>
              Ge din inköpslista ett namn.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="listName">Namn</Label>
                <Input
                  id="listName"
                  type="text"
                  placeholder="t.ex. Veckohandling"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  disabled={isCreating}
                  autoFocus
                />
              </div>
              {createError && (
                <Alert variant="destructive">
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false)
                  setNewListName('')
                  setCreateError(null)
                }}
                disabled={isCreating}
              >
                Avbryt
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Skapar...' : 'Skapa lista'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Byt namn på lista</DialogTitle>
            <DialogDescription>
              Ange ett nytt namn för inköpslistan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="renameName">Namn</Label>
                <Input
                  id="renameName"
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  disabled={isRenaming}
                  autoFocus
                />
              </div>
              {renameError && (
                <Alert variant="destructive">
                  <AlertDescription>{renameError}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRenameDialogOpen(false)
                  setListToRename(null)
                  setRenameError(null)
                }}
                disabled={isRenaming}
              >
                Avbryt
              </Button>
              <Button type="submit" disabled={isRenaming}>
                {isRenaming ? 'Sparar...' : 'Spara'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort inköpslista?</DialogTitle>
            <DialogDescription>
              Är du säker på att du vill ta bort &quot;{listToDelete?.name}&quot;?
              Alla varor i listan kommer att tas bort.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Avbryt
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Tar bort...' : 'Ta bort'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Click outside handler for menus */}
      {actionsMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActionsMenuOpen(null)}
        />
      )}
    </div>
  )
}

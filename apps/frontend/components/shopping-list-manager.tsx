'use client'

import { useState } from 'react'
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
import { CreateListDialog } from '@/components/create-list-dialog'
import { useShoppingListDialogs } from '@/lib/hooks/use-shopping-list-dialogs'
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
  homeId?: string
}

export function ShoppingListManager({
  lists,
  selectedListId,
  onSelectList,
  homeId,
}: ShoppingListManagerProps) {
  const [actionsMenuOpen, setActionsMenuOpen] = useState<string | null>(null)

  const {
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
  } = useShoppingListDialogs({ lists, selectedListId, onSelectList, homeId })

  const useTabs = lists.length <= 3

  function toggleActionsMenu(listId: string) {
    setActionsMenuOpen((prev) => (prev === listId ? null : listId))
  }

  function handleOpenRenameDialog(list: ShoppingList) {
    openRenameDialog(list)
    setActionsMenuOpen(null)
  }

  function handleOpenDeleteDialog(list: ShoppingList) {
    openDeleteDialog(list)
    setActionsMenuOpen(null)
  }

  async function handleSetDefaultAndCloseMenu(list: ShoppingList) {
    setActionsMenuOpen(null)
    await handleSetDefault(list)
  }

  const selectedList = lists.find((l) => l.id === selectedListId)

  if (lists.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={openCreateDialog}
        >
          <Plus className="mr-1 h-4 w-4" />
          Skapa inköpslista
        </Button>

        <CreateListDialog
          open={dialog.type === 'create'}
          onOpenChange={(open) => !open && closeDialog()}
          name={dialog.type === 'create' ? dialog.name : ''}
          onNameChange={setCreateName}
          isSubmitting={dialog.type === 'create' && dialog.isSubmitting}
          error={dialog.type === 'create' ? dialog.error : null}
          onSubmit={handleCreate}
          onCancel={closeDialog}
        />
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
                        onClick={() => handleOpenRenameDialog(list)}
                        className="flex w-full items-center gap-2 whitespace-nowrap rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <Pencil className="h-4 w-4" />
                        Byt namn
                      </button>
                      {!list.is_default && (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultAndCloseMenu(list)}
                          className="flex w-full items-center gap-2 whitespace-nowrap rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                        >
                          <Star className="h-4 w-4" />
                          Ange som standard
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteDialog(list)}
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
                  {selectedList ? selectedList.name : 'Välj lista'}
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
                  <DropdownListItem
                    key={list.id}
                    list={list}
                    isSelected={list.id === selectedListId}
                    onSelect={() => {
                      onSelectList(list.id)
                      setActionsMenuOpen(null)
                    }}
                    onRename={() => handleOpenRenameDialog(list)}
                    onSetDefault={() => handleSetDefaultAndCloseMenu(list)}
                    onDelete={() => handleOpenDeleteDialog(list)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={openCreateDialog}
        >
          <Plus className="mr-1 h-4 w-4" />
          Ny lista
        </Button>
      </div>

      {/* Create dialog */}
      <CreateListDialog
        open={dialog.type === 'create'}
        onOpenChange={(open) => !open && closeDialog()}
        name={dialog.type === 'create' ? dialog.name : ''}
        onNameChange={setCreateName}
        isSubmitting={dialog.type === 'create' && dialog.isSubmitting}
        error={dialog.type === 'create' ? dialog.error : null}
        onSubmit={handleCreate}
        onCancel={closeDialog}
      />

      {/* Rename dialog */}
      <Dialog open={dialog.type === 'rename'} onOpenChange={(open) => !open && closeDialog()}>
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
                  value={dialog.type === 'rename' ? dialog.name : ''}
                  onChange={(e) => setRenameName(e.target.value)}
                  disabled={dialog.type === 'rename' && dialog.isSubmitting}
                  autoFocus
                />
              </div>
              {dialog.type === 'rename' && dialog.error && (
                <Alert variant="destructive">
                  <AlertDescription>{dialog.error}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={dialog.type === 'rename' && dialog.isSubmitting}
              >
                Avbryt
              </Button>
              <Button type="submit" disabled={dialog.type === 'rename' && dialog.isSubmitting}>
                {dialog.type === 'rename' && dialog.isSubmitting ? 'Sparar...' : 'Spara'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={dialog.type === 'delete'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort inköpslista?</DialogTitle>
            <DialogDescription>
              Är du säker på att du vill ta bort &quot;{dialog.type === 'delete' ? dialog.list.name : ''}&quot;?
              Alla varor i listan kommer att tas bort.
            </DialogDescription>
          </DialogHeader>
          {dialog.type === 'delete' && dialog.error && (
            <Alert variant="destructive">
              <AlertDescription>{dialog.error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={dialog.type === 'delete' && dialog.isSubmitting}
            >
              Avbryt
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={dialog.type === 'delete' && dialog.isSubmitting}
            >
              {dialog.type === 'delete' && dialog.isSubmitting ? 'Tar bort...' : 'Ta bort'}
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

// Extracted component for dropdown list items to reduce duplication
function DropdownListItem({
  list,
  isSelected,
  onSelect,
  onRename,
  onSetDefault,
  onDelete,
}: {
  list: ShoppingList
  isSelected: boolean
  onSelect: () => void
  onRename: () => void
  onSetDefault: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'group flex items-center justify-between rounded-sm px-2 py-1.5 hover:bg-accent',
        isSelected && 'bg-accent'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
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
            onRename()
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
              onSetDefault()
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
            onDelete()
          }}
          className="rounded p-1 text-destructive hover:bg-muted"
          title="Ta bort"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

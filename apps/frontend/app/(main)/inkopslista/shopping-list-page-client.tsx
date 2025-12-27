'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { ShoppingList as ShoppingListComponent } from '@/components/shopping-list'
import { ShoppingListManager } from '@/components/shopping-list-manager'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { deleteShoppingList } from '@/lib/actions'
import type { ShoppingListItem } from '@/lib/api'
import type { ShoppingList } from '@/lib/types'
import { ShoppingCart, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface ShoppingListPageClientProps {
  lists: ShoppingList[]
  items: ShoppingListItem[]
  initialSelectedListId: string | null
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-card px-6 py-16 text-center shadow-[0_2px_12px_-2px_rgba(139,90,60,0.1)]">
      <div className="mb-4 rounded-full bg-muted p-4">
        <ShoppingCart className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        Din inköpslista är tom
      </h2>
      <p className="mb-6 max-w-sm text-muted-foreground">
        Lägg till ingredienser från ett recept för att börja handla!
      </p>
      <Button asChild>
        <Link href="/alla-recept">Utforska recept</Link>
      </Button>
    </div>
  )
}

export function ShoppingListPageClient({
  lists,
  items,
  initialSelectedListId,
}: ShoppingListPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Only UI state lives here - server data comes from props
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const selectedListId = searchParams.get('list') || initialSelectedListId
  const selectedList = lists.find((l) => l.id === selectedListId)

  const handleSelectList = useCallback(
    (listId: string) => {
      router.push(`/inkopslista?list=${listId}`)
    },
    [router]
  )

  async function handleDeleteList() {
    if (!selectedList) return
    setDeleteError(null)
    setIsDeleting(true)

    try {
      const result = await deleteShoppingList(selectedList.id)

      if ('error' in result) {
        setDeleteError(result.error)
        return
      }

      setDeleteDialogOpen(false)

      // Navigate to default/first list and refresh to get new data
      const remainingLists = lists.filter((l) => l.id !== selectedList.id)
      const newDefault = remainingLists.find((l) => l.is_default) || remainingLists[0]

      if (newDefault) {
        router.push(`/inkopslista?list=${newDefault.id}`)
      } else {
        router.push('/inkopslista')
      }
      router.refresh()
    } catch {
      setDeleteError('Ett oväntat fel uppstod')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Inköpslista
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {selectedList
            ? `Dina ingredienser i ${selectedList.name}`
            : 'Dina ingredienser att handla'}
        </p>
      </header>

      {/* Shopping list manager */}
      <ShoppingListManager
        lists={lists}
        selectedListId={selectedListId}
        onSelectList={handleSelectList}
      />

      {/* List actions - prominent delete button */}
      {selectedList && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Ta bort lista
          </Button>
        </div>
      )}

      {/* Shopping list content */}
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <ShoppingListComponent items={items} listId={selectedListId || undefined} />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort inköpslista?</DialogTitle>
            <DialogDescription>
              Är du säker på att du vill ta bort &quot;{selectedList?.name}&quot;?
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
              onClick={handleDeleteList}
              disabled={isDeleting}
            >
              {isDeleting ? 'Tar bort...' : 'Ta bort'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Plus } from '@/lib/icons'
import {
  addRecipeToCollection,
  createCollection,
  getCollectionsForRecipe,
  removeRecipeFromCollection,
} from '@/lib/collections-actions'
import type { CollectionForRecipe } from '@/lib/types'

interface AddToCollectionDialogProps {
  recipeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddToCollectionDialog({
  recipeId,
  open,
  onOpenChange,
}: AddToCollectionDialogProps) {
  const router = useRouter()
  const [collections, setCollections] = useState<CollectionForRecipe[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [isPending, startTransition] = useTransition()
  // Track whether any mutation happened so we can invalidate loaders on close.
  const [dirty, setDirty] = useState(false)

  // Load the caller's collections (and which already contain the recipe).
  useEffect(() => {
    if (!open) return

    let cancelled = false
    setIsLoading(true)
    setError(null)

    getCollectionsForRecipe(recipeId)
      .then((result) => {
        if (cancelled) return
        setCollections(result)
      })
      .catch(() => {
        if (cancelled) return
        setError('Kunde inte hämta dina samlingar.')
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, recipeId])

  function handleOpenChange(next: boolean) {
    if (!next && dirty) {
      router.invalidate()
      setDirty(false)
    }
    if (!next) {
      setNewName('')
      setError(null)
    }
    onOpenChange(next)
  }

  function handleToggle(collection: CollectionForRecipe) {
    const nextContains = !collection.contains
    setTogglingId(collection.id)

    // Optimistic update.
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collection.id ? { ...c, contains: nextContains } : c,
      ),
    )

    startTransition(async () => {
      setError(null)
      const result = nextContains
        ? await addRecipeToCollection(collection.id, recipeId)
        : await removeRecipeFromCollection(collection.id, recipeId)

      if ('error' in result) {
        setError(result.error)
        // Revert optimistic update on failure.
        setCollections((prev) =>
          prev.map((c) =>
            c.id === collection.id ? { ...c, contains: !nextContains } : c,
          ),
        )
      } else {
        setDirty(true)
      }
      setTogglingId(null)
    })
  }

  function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) return

    startTransition(async () => {
      setError(null)
      const created = await createCollection({ name: trimmed })
      if ('error' in created) {
        setError(created.error)
        return
      }

      const added = await addRecipeToCollection(created.collection.id, recipeId)
      if ('error' in added) {
        setError(added.error)
        return
      }

      setCollections((prev) => [
        { id: created.collection.id, name: created.collection.name, contains: true },
        ...prev,
      ])
      setNewName('')
      setDirty(true)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg till i samling</DialogTitle>
          <DialogDescription>
            Välj vilka samlingar receptet ska tillhöra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {collections.length > 0 ? (
                <ul className="max-h-64 space-y-1 overflow-y-auto">
                  {collections.map((collection) => (
                    <li key={collection.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50">
                        <Checkbox
                          checked={collection.contains}
                          disabled={isPending && togglingId === collection.id}
                          onCheckedChange={() => handleToggle(collection)}
                        />
                        <span className="text-sm font-medium">
                          {collection.name}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Du har inga samlingar ännu. Skapa en nedan.
                </p>
              )}

              <form
                onSubmit={handleCreate}
                className="flex items-center gap-2 border-t pt-3"
              >
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ny samling"
                  maxLength={120}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="outline"
                  disabled={isPending || !newName.trim()}
                  aria-label="Skapa samling"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

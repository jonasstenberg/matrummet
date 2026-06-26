import { useState, useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
import { RecipeCard } from '@/components/recipe-card'
import { RecipeGrid } from '@/components/recipe-grid'
import { ShareCollectionButton } from '@/components/share-collection-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  deleteCollection,
  removeRecipeFromCollection,
  updateCollection,
} from '@/lib/collections-actions'
import { EllipsisVertical, Pencil, Trash2, X } from '@/lib/icons'
import type { Collection, Recipe } from '@/lib/types'

interface CollectionDetailProps {
  collection: Collection
  recipes: Recipe[]
  totalCount: number
}

export function CollectionDetail({
  collection,
  recipes,
  totalCount,
}: CollectionDetailProps) {
  const router = useRouter()
  const isOwner = collection.is_owner

  const [isManaging, setIsManaging] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [name, setName] = useState(collection.name)
  const [description, setDescription] = useState(collection.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [removingId, setRemovingId] = useState<string | null>(null)

  function handleRename(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Ange ett namn på samlingen.')
      return
    }

    startTransition(async () => {
      setError(null)
      const result = await updateCollection({
        id: collection.id,
        name: trimmed,
        description: description.trim() || undefined,
      })

      if ('error' in result) {
        setError(result.error)
        return
      }

      await router.invalidate()
      setRenameOpen(false)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      setError(null)
      const result = await deleteCollection(collection.id)

      if ('error' in result) {
        setError(result.error)
        return
      }

      await router.invalidate()
      router.navigate({ to: '/samlingar' })
    })
  }

  function handleRemoveRecipe(recipeId: string) {
    setRemovingId(recipeId)
    startTransition(async () => {
      const result = await removeRecipeFromCollection(collection.id, recipeId)
      if ('error' in result) {
        setError(result.error)
      } else {
        await router.invalidate()
      }
      setRemovingId(null)
    })
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
              {collection.name}
            </h1>
            {collection.kind === 'curated' && (
              <Badge variant="secondary">Kurerad</Badge>
            )}
          </div>
          {collection.description && (
            <p className="text-muted-foreground">{collection.description}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {totalCount} recept
            {!isOwner && ` · Delad av ${collection.owner_name}`}
          </p>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            <ShareCollectionButton collectionId={collection.id} />
            <Button
              variant={isManaging ? 'default' : 'outline'}
              onClick={() => setIsManaging((v) => !v)}
            >
              {isManaging ? 'Klar' : 'Hantera'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Fler alternativ">
                  <EllipsisVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Byt namn
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Ta bort samling
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </header>

      {error && !renameOpen && !deleteOpen && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isOwner && isManaging ? (
        recipes.length === 0 ? (
          <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">
                Inga recept i samlingen
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Lägg till recept från ett recept via &quot;Lägg till i samling&quot;.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6">
            {recipes.map((recipe) => (
              <div key={recipe.id} className="relative">
                <RecipeCard recipe={recipe} />
                <button
                  type="button"
                  onClick={() => handleRemoveRecipe(recipe.id)}
                  disabled={isPending && removingId === recipe.id}
                  aria-label={`Ta bort ${recipe.name} från samlingen`}
                  className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-destructive shadow-md backdrop-blur-sm transition-colors hover:bg-white disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        <RecipeGrid
          recipes={recipes}
          emptyMessage="Inga recept i samlingen"
          emptyDescription="Lägg till recept via &quot;Lägg till i samling&quot; på ett recept."
        />
      )}

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Byt namn på samling</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4">
            {error && renameOpen && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="rename-collection-name">Namn</Label>
              <Input
                id="rename-collection-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rename-collection-description">
                Beskrivning{' '}
                <span className="text-muted-foreground">(valfritt)</span>
              </Label>
              <Textarea
                id="rename-collection-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
                disabled={isPending}
              >
                Avbryt
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Sparar...' : 'Spara'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort samling</DialogTitle>
            <DialogDescription>
              Vill du verkligen ta bort samlingen &quot;{collection.name}&quot;?
              Recepten påverkas inte. Denna åtgärd kan inte ångras.
            </DialogDescription>
          </DialogHeader>
          {error && deleteOpen && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isPending}
            >
              Avbryt
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? 'Tar bort...' : 'Ta bort'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

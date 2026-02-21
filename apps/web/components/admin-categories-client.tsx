import { useState, useMemo } from 'react'
import { CategoryWithCount } from '@/lib/types'
import { CategoryGroupOption, LinkedRecipe } from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Pencil, Trash2, Plus, AlertCircle, Search, GitMerge, ExternalLink } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useRouter } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'

interface AdminCategoriesClientProps {
  initialCategories: CategoryWithCount[]
  groups: CategoryGroupOption[]
}

export function AdminCategoriesClient({ initialCategories, groups }: AdminCategoriesClientProps) {
  const router = useRouter()
  const categories = initialCategories
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryWithCount | null>(null)

  // New category
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryGroupId, setNewCategoryGroupId] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Search filter
  const [searchQuery, setSearchQuery] = useState('')

  // Linked recipes dialog
  const [recipesDialogOpen, setRecipesDialogOpen] = useState(false)
  const [recipesDialogTitle, setRecipesDialogTitle] = useState('')
  const [linkedRecipes, setLinkedRecipes] = useState<LinkedRecipe[]>([])
  const [loadingRecipes, setLoadingRecipes] = useState(false)

  // Merge dialog
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [mergeSource, setMergeSource] = useState<CategoryWithCount | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [mergeSearch, setMergeSearch] = useState('')
  const [isMerging, setIsMerging] = useState(false)

  // Group categories by group_name
  const groupedCategories = useMemo(() => {
    const groupMap = new Map<string, { sort_order: number; items: CategoryWithCount[] }>()

    const filtered = searchQuery
      ? categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : categories

    for (const cat of filtered) {
      const groupName = cat.group_name ?? 'Utan grupp'
      const sortOrder = (cat as CategoryWithCount & { group_sort_order?: number }).group_sort_order ?? 99

      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, { sort_order: sortOrder, items: [] })
      }
      groupMap.get(groupName)!.items.push(cat)
    }

    return Array.from(groupMap.entries())
      .sort((a, b) => a[1].sort_order - b[1].sort_order)
      .map(([name, { items }]) => ({
        name,
        items: items.sort((a, b) => a.name.localeCompare(b.name, 'sv')),
      }))
  }, [categories, searchQuery])

  const totalCategories = categories.length
  const totalGroups = useMemo(() => {
    const groupSet = new Set(categories.map(c => c.group_name ?? 'Utan grupp'))
    return groupSet.size
  }, [categories])

  // Merge target options (filtered, excluding source)
  const mergeTargetOptions = useMemo(() => {
    if (!mergeSource) return []
    return categories
      .filter(c => c.id !== mergeSource.id)
      .filter(c => !mergeSearch || c.name.toLowerCase().includes(mergeSearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, [categories, mergeSource, mergeSearch])

  async function handleRename(id: string, newName: string) {
    if (!newName.trim()) {
      setError('Kategorinamn kan inte vara tomt')
      return
    }

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: newName.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte byta namn på kategori')
      }

      setSuccess('Kategori uppdaterad')
      setEditingId(null)
      setEditName('')
      router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    }
  }

  async function handleDelete() {
    if (!categoryToDelete) return

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch(
        `/api/admin/categories?id=${categoryToDelete.id}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte ta bort kategori')
      }

      setSuccess('Kategori borttagen')
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
      router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
    }
  }

  async function handleAdd() {
    if (!newCategoryName.trim()) {
      setError('Kategorinamn kan inte vara tomt')
      return
    }

    try {
      setError(null)
      setSuccess(null)
      setIsAdding(true)

      const body: Record<string, string> = { name: newCategoryName.trim() }
      if (newCategoryGroupId) {
        body.group_id = newCategoryGroupId
      }

      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte skapa kategori')
      }

      setSuccess('Kategori skapad')
      setNewCategoryName('')
      setNewCategoryGroupId('')
      router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsAdding(false)
    }
  }

  async function handleChangeGroup(categoryId: string, groupId: string) {
    try {
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: categoryId, group_id: groupId || null }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte byta grupp')
      }

      setSuccess('Grupp uppdaterad')
      router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    }
  }

  async function handleShowRecipes(category: CategoryWithCount) {
    setRecipesDialogTitle(category.name)
    setRecipesDialogOpen(true)
    setLoadingRecipes(true)
    setLinkedRecipes([])

    try {
      const { getLinkedRecipesByCategory } = await import('@/lib/admin-api')
      const recipes = await getLinkedRecipesByCategory(category.id)
      setLinkedRecipes(recipes)
    } catch {
      setLinkedRecipes([])
    } finally {
      setLoadingRecipes(false)
    }
  }

  async function handleMerge() {
    if (!mergeSource || !mergeTargetId) return

    try {
      setError(null)
      setSuccess(null)
      setIsMerging(true)

      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge',
          sourceId: mergeSource.id,
          targetId: mergeTargetId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte slå ihop kategorier')
      }

      const targetName = categories.find(c => c.id === mergeTargetId)?.name
      setSuccess(`"${mergeSource.name}" har slagits ihop med "${targetName}"`)
      setMergeDialogOpen(false)
      setMergeSource(null)
      setMergeTargetId('')
      setMergeSearch('')
      router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsMerging(false)
    }
  }

  function startEdit(category: CategoryWithCount) {
    setEditingId(category.id)
    setEditName(category.name)
    setError(null)
    setSuccess(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setError(null)
  }

  function confirmDelete(category: CategoryWithCount) {
    setCategoryToDelete(category)
    setDeleteDialogOpen(true)
  }

  function startMerge(category: CategoryWithCount) {
    setMergeSource(category)
    setMergeTargetId('')
    setMergeSearch('')
    setMergeDialogOpen(true)
  }

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Kategorier
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {totalCategories} kategorier i {totalGroups} grupper
        </p>
      </header>

      {/* Status messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-900">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Add new category */}
      <div className="rounded-2xl bg-card p-5 shadow-(--shadow-card)">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Ny kategori
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Kategorinamn"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
            }}
            disabled={isAdding}
            className="flex-1"
          />
          <select
            value={newCategoryGroupId}
            onChange={(e) => setNewCategoryGroupId(e.target.value)}
            disabled={isAdding}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Ingen grupp</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <Button onClick={handleAdd} disabled={isAdding || !newCategoryName.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            {isAdding ? 'Skapar...' : 'Lägg till'}
          </Button>
        </div>
      </div>

      {/* Categories list */}
      <div className="overflow-hidden rounded-2xl bg-card shadow-(--shadow-card)">
        {/* List header with search */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Alla kategorier
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="search"
              placeholder="Filtrera..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-44 rounded-lg border-0 bg-muted/50 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">Inga kategorier hittades</p>
          </div>
        ) : groupedCategories.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">Inga kategorier matchar sökningen</p>
          </div>
        ) : (
          groupedCategories.map((group, groupIndex) => (
            <div key={group.name}>
              {/* Group header */}
              <div className="border-b border-border/40 bg-muted/30 px-5 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.name}
                </p>
              </div>
              {/* Group items */}
              <div className="divide-y divide-border/40">
                {group.items.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center px-5 py-3 transition-colors hover:bg-muted/30"
                  >
                    {editingId === category.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleRename(category.id, editName)
                            } else if (e.key === 'Escape') {
                              cancelEdit()
                            }
                          }}
                          autoFocus
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleRename(category.id, editName)}
                        >
                          Spara
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          Avbryt
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <span className="text-[15px] font-medium">{category.name}</span>
                          <button
                            onClick={() => handleShowRecipes(category)}
                            className={cn(
                              'ml-2 text-xs',
                              category.recipe_count > 0
                                ? 'text-primary/70 hover:text-primary hover:underline'
                                : 'text-muted-foreground/60 cursor-default'
                            )}
                            disabled={category.recipe_count === 0}
                          >
                            {category.recipe_count} recept
                          </button>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {/* Move to group dropdown */}
                          <select
                            value={category.group_id ?? ''}
                            onChange={(e) => handleChangeGroup(category.id, e.target.value)}
                            className="h-7 rounded-md border-0 bg-transparent px-1 text-[11px] text-muted-foreground/60 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            title="Byt grupp"
                          >
                            <option value="">Utan grupp</option>
                            {groups.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => startMerge(category)}
                            className="rounded-lg p-2 text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-foreground"
                            aria-label="Slå ihop kategori"
                            title="Slå ihop med annan kategori"
                          >
                            <GitMerge className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => startEdit(category)}
                            className="rounded-lg p-2 text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-foreground"
                            aria-label="Redigera kategori"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => confirmDelete(category)}
                            className="rounded-lg p-2 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Ta bort kategori"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {/* Separator between groups except last */}
              {groupIndex < groupedCategories.length - 1 && (
                <div className="border-b border-border/40" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort kategori</DialogTitle>
            <DialogDescription>
              Är du säker på att du vill ta bort kategorin &quot;
              {categoryToDelete?.name}&quot;?
              {categoryToDelete && categoryToDelete.recipe_count > 0 && (
                <span className="mt-2 block font-semibold text-destructive">
                  Varning: Denna kategori används av {categoryToDelete.recipe_count}{' '}
                  {categoryToDelete.recipe_count === 1 ? 'recept' : 'recept'}.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              Avbryt
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Ta bort
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Linked recipes dialog */}
      <Dialog open={recipesDialogOpen} onOpenChange={setRecipesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recept med &quot;{recipesDialogTitle}&quot;</DialogTitle>
          </DialogHeader>
          {loadingRecipes ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Laddar...</p>
          ) : linkedRecipes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Inga recept hittades</p>
          ) : (
            <div className="max-h-80 divide-y divide-border/40 overflow-y-auto">
              {linkedRecipes.map((recipe) => (
                <Link
                  key={recipe.id}
                  to="/recept/$id"
                  params={{ id: recipe.id }}
                  className="flex items-center justify-between px-1 py-2.5 text-sm hover:text-primary"
                  target="_blank"
                >
                  <span>{recipe.name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                </Link>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Merge dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slå ihop kategori</DialogTitle>
            <DialogDescription>
              Alla recept kopplade till &quot;{mergeSource?.name}&quot; kommer att flyttas till den
              valda kategorin. Sedan tas &quot;{mergeSource?.name}&quot; bort.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Sök målkategori..."
              value={mergeSearch}
              onChange={(e) => setMergeSearch(e.target.value)}
            />
            <div className="max-h-60 divide-y divide-border/40 overflow-y-auto rounded-lg border">
              {mergeTargetOptions.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Inga kategorier hittades
                </p>
              ) : (
                mergeTargetOptions.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setMergeTargetId(cat.id)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors',
                      mergeTargetId === cat.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <span>{cat.name}</span>
                    <span className="text-xs text-muted-foreground/60">
                      {cat.recipe_count} recept
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMergeDialogOpen(false)}>
              Avbryt
            </Button>
            <Button
              onClick={handleMerge}
              disabled={!mergeTargetId || isMerging}
            >
              {isMerging ? 'Slår ihop...' : 'Slå ihop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

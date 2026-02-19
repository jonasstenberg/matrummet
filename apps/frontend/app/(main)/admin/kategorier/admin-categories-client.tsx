'use client'

import { useState, useMemo } from 'react'
import { CategoryWithCount } from '@/lib/api'
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
import { Pencil, Trash2, Plus, AlertCircle, Search } from '@/lib/icons'
import { useRouter } from 'next/navigation'

interface AdminCategoriesClientProps {
  initialCategories: CategoryWithCount[]
}

export function AdminCategoriesClient({ initialCategories }: AdminCategoriesClientProps) {
  const router = useRouter()
  const [categories, setCategories] = useState<CategoryWithCount[]>(initialCategories)
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
  const [isAdding, setIsAdding] = useState(false)

  // Search filter
  const [searchQuery, setSearchQuery] = useState('')

  // Group categories by group_name
  const groupedCategories = useMemo(() => {
    const groups = new Map<string, { sort_order: number; items: CategoryWithCount[] }>()

    const filtered = searchQuery
      ? categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : categories

    for (const cat of filtered) {
      const groupName = cat.group_name ?? 'Utan grupp'
      const sortOrder = (cat as CategoryWithCount & { group_sort_order?: number }).group_sort_order ?? 99

      if (!groups.has(groupName)) {
        groups.set(groupName, { sort_order: sortOrder, items: [] })
      }
      groups.get(groupName)!.items.push(cat)
    }

    return Array.from(groups.entries())
      .sort((a, b) => a[1].sort_order - b[1].sort_order)
      .map(([name, { items }]) => ({
        name,
        items: items.sort((a, b) => a.name.localeCompare(b.name, 'sv')),
      }))
  }, [categories, searchQuery])

  const totalCategories = categories.length
  const totalGroups = useMemo(() => {
    const groups = new Set(categories.map(c => c.group_name ?? 'Utan grupp'))
    return groups.size
  }, [categories])

  async function loadCategories() {
    try {
      const response = await fetch('/api/admin/categories')

      if (response.status === 403) {
        throw new Error('Du har inte behörighet att hantera kategorier')
      }

      if (!response.ok) {
        throw new Error('Kunde inte ladda kategorier')
      }

      const categoriesWithCount: CategoryWithCount[] = await response.json()

      // Sort by name
      categoriesWithCount.sort((a, b) => a.name.localeCompare(b.name, 'sv'))

      setCategories(categoriesWithCount)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    }
  }

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, name: newName.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte byta namn på kategori')
      }

      setSuccess('Kategori uppdaterad')
      setEditingId(null)
      setEditName('')
      await loadCategories()
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
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte ta bort kategori')
      }

      setSuccess('Kategori borttagen')
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
      await loadCategories()
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

      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte skapa kategori')
      }

      setSuccess('Kategori skapad')
      setNewCategoryName('')
      await loadCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsAdding(false)
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
              if (e.key === 'Enter') {
                handleAdd()
              }
            }}
            disabled={isAdding}
          />
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
                          <span className="ml-2 text-xs text-muted-foreground/60">
                            {category.recipe_count} recept
                          </span>
                        </div>
                        <div className="flex shrink-0 gap-1">
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
    </>
  )
}

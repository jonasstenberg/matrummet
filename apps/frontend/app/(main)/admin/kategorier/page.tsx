'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Category } from '@/lib/types'
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
import { Card } from '@/components/ui/card'
import { Pencil, Trash2, Plus, AlertCircle } from 'lucide-react'

interface CategoryWithCount extends Category {
  recipe_count: number
}

export default function AdminCategoriesPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    if (!authLoading && user) {
      loadCategories()
    }
  }, [authLoading, user])

  async function loadCategories() {
    try {
      setLoading(true)
      setError(null)

      // Fetch categories with recipe count via API
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setLoading(false)
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
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Hantera kategorier
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Skapa, redigera och ta bort kategorier för recept.
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
      <Card className="p-4">
        <h2 className="mb-4 text-lg font-semibold">Lägg till kategori</h2>
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
      </Card>

      {/* Categories list */}
      <Card className="p-4">
        <h2 className="mb-4 text-lg font-semibold">Kategorier</h2>

        {loading ? (
          <p className="text-center text-muted-foreground">Laddar kategorier...</p>
        ) : categories.length === 0 ? (
          <p className="text-center text-muted-foreground">Inga kategorier hittades</p>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent/50"
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
                    <div className="flex-1">
                      <span className="font-medium">{category.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({category.recipe_count}{' '}
                        {category.recipe_count === 1 ? 'recept' : 'recept'})
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(category)}
                        aria-label="Redigera kategori"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => confirmDelete(category)}
                        aria-label="Ta bort kategori"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

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

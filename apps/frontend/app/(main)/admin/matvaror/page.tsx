'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface Food {
  id: string
  name: string
  date_published: string
  date_modified: string
  ingredient_count: number
}

interface PaginatedResponse {
  items: Food[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function AdminFoodsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Pagination and search - read from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const search = searchParams.get('search') || ''
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Debounce for search
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [foodToDelete, setFoodToDelete] = useState<Food | null>(null)

  // New food
  const [newFoodName, setNewFoodName] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Load foods when auth is ready and page/search params change
  useEffect(() => {
    if (!authLoading && user) {
      loadFoods()
    }
  }, [authLoading, user, page, search])

  async function loadFoods() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
      })

      if (search) {
        params.set('search', search)
      }

      const response = await fetch(`/api/admin/foods?${params}`)

      if (response.status === 403) {
        throw new Error('Du har inte behörighet att hantera matvaror')
      }

      if (!response.ok) {
        throw new Error('Kunde inte ladda matvaror')
      }

      const data: PaginatedResponse = await response.json()

      setFoods(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  async function handleRename(id: string, newName: string) {
    if (!newName.trim()) {
      setError('Matvarunamn kan inte vara tomt')
      return
    }

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/admin/foods', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, name: newName.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte byta namn på matvara')
      }

      setSuccess('Matvara uppdaterad')
      setEditingId(null)
      setEditName('')
      await loadFoods()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    }
  }

  async function handleDelete() {
    if (!foodToDelete) return

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch(
        `/api/admin/foods?id=${foodToDelete.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte ta bort matvara')
      }

      setSuccess('Matvara borttagen')
      setDeleteDialogOpen(false)
      setFoodToDelete(null)

      // If we deleted the last item on this page and it's not page 1, go back a page
      if (foods.length === 1 && page > 1) {
        updateURL(page - 1, search)
      } else {
        await loadFoods()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
      setDeleteDialogOpen(false)
      setFoodToDelete(null)
    }
  }

  async function handleAdd() {
    if (!newFoodName.trim()) {
      setError('Matvarunamn kan inte vara tomt')
      return
    }

    try {
      setError(null)
      setSuccess(null)
      setIsAdding(true)

      const response = await fetch('/api/admin/foods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newFoodName.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte skapa matvara')
      }

      setSuccess('Matvara skapad')
      setNewFoodName('')
      await loadFoods()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsAdding(false)
    }
  }

  function startEdit(food: Food) {
    setEditingId(food.id)
    setEditName(food.name)
    setError(null)
    setSuccess(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setError(null)
  }

  function confirmDelete(food: Food) {
    setFoodToDelete(food)
    setDeleteDialogOpen(true)
  }

  function updateURL(newPage: number, newSearch: string) {
    const params = new URLSearchParams()

    if (newPage > 1) {
      params.set('page', newPage.toString())
    }

    if (newSearch) {
      params.set('search', newSearch)
    }

    const queryString = params.toString()
    router.replace(queryString ? `/admin/matvaror?${queryString}` : '/admin/matvaror')
  }

  function handleSearchChange(value: string) {
    clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      // Reset to page 1 when search changes
      updateURL(1, value)
    }, 300)
  }

  function getPageNumbers() {
    const pages: (number | 'ellipsis')[] = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (page > 3) {
        pages.push('ellipsis')
      }

      // Show pages around current page
      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (page < totalPages - 2) {
        pages.push('ellipsis')
      }

      // Always show last page
      pages.push(totalPages)
    }

    return pages
  }

  return (
    <>
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Hantera matvaror
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Skapa, redigera och ta bort matvaror för ingredienser.
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

      {/* Add new food */}
      <Card className="p-4">
        <h2 className="mb-4 text-lg font-semibold">Lägg till matvara</h2>
        <div className="flex gap-2">
          <Input
            placeholder="t.ex. Tomater, Olivolja, Vitlök"
            value={newFoodName}
            onChange={(e) => setNewFoodName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAdd()
              }
            }}
            disabled={isAdding}
          />
          <Button onClick={handleAdd} disabled={isAdding || !newFoodName.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            {isAdding ? 'Skapar...' : 'Lägg till'}
          </Button>
        </div>
      </Card>

      {/* Search */}
      <Card className="p-4">
        <Input
          type="search"
          placeholder="Sök matvaror..."
          defaultValue={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </Card>

      {/* Foods list */}
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Matvaror</h2>
          {!loading && (
            <p className="text-sm text-muted-foreground">
              {total} {total === 1 ? 'matvara' : 'matvaror'}
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Laddar matvaror...</p>
        ) : foods.length === 0 ? (
          <p className="text-center text-muted-foreground">
            {search
              ? 'Inga matvaror hittades'
              : 'Inga matvaror finns ännu'}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {foods.map((food) => (
                <div
                  key={food.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent/50"
                >
                  {editingId === food.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRename(food.id, editName)
                          } else if (e.key === 'Escape') {
                            cancelEdit()
                          }
                        }}
                        autoFocus
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleRename(food.id, editName)}
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
                        <span className="font-medium">{food.name}</span>
                        <span className="ml-2 text-sm text-muted-foreground">
                          ({food.ingredient_count}{' '}
                          {food.ingredient_count === 1 ? 'ingrediens' : 'ingredienser'})
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(food)}
                          aria-label="Redigera matvara"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => confirmDelete(food)}
                          aria-label="Ta bort matvara"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 border-t border-border pt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (page > 1) {
                            updateURL(page - 1, search)
                          }
                        }}
                        className={
                          page === 1
                            ? 'pointer-events-none opacity-50'
                            : ''
                        }
                      />
                    </PaginationItem>

                    {getPageNumbers().map((pageNum, idx) => (
                      <PaginationItem key={idx}>
                        {pageNum === 'ellipsis' ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              updateURL(pageNum, search)
                            }}
                            isActive={pageNum === page}
                          >
                            {pageNum}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (page < totalPages) {
                            updateURL(page + 1, search)
                          }
                        }}
                        className={
                          page === totalPages
                            ? 'pointer-events-none opacity-50'
                            : ''
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort matvara</DialogTitle>
            <DialogDescription>
              Är du säker på att du vill ta bort matvaran &quot;
              {foodToDelete?.name}&quot;?
              {foodToDelete && foodToDelete.ingredient_count > 0 && (
                <span className="mt-2 block font-semibold text-destructive">
                  Varning: Denna matvara används av {foodToDelete.ingredient_count}{' '}
                  {foodToDelete.ingredient_count === 1 ? 'ingrediens' : 'ingredienser'}.
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

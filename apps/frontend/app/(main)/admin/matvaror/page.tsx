'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Plus, AlertCircle, Check, X, ChefHat, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

type FoodStatus = 'pending' | 'approved' | 'rejected'

interface Food {
  id: string
  name: string
  status: FoodStatus
  created_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
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

interface SimilarFood {
  id: string
  name: string
}

interface LinkedRecipe {
  id: string
  name: string
}

export default function AdminFoodsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Pagination, search, and status filter - read from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const search = searchParams.get('search') || ''
  const statusFilter = (searchParams.get('status') || 'pending') as FoodStatus | 'all'
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Debounce for search
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Similar foods warning dialog
  const [similarDialogOpen, setSimilarDialogOpen] = useState(false)
  const [similarFoods, setSimilarFoods] = useState<SimilarFood[]>([])
  const [foodToApprove, setFoodToApprove] = useState<Food | null>(null)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [foodToDelete, setFoodToDelete] = useState<Food | null>(null)

  // New food
  const [newFoodName, setNewFoodName] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Linked recipes dialog
  const [recipesDialogOpen, setRecipesDialogOpen] = useState(false)
  const [linkedRecipes, setLinkedRecipes] = useState<LinkedRecipe[]>([])
  const [loadingRecipes, setLoadingRecipes] = useState(false)
  const [selectedFoodForRecipes, setSelectedFoodForRecipes] = useState<Food | null>(null)

  const loadFoods = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
      })

      if (search) {
        params.set('search', search)
      }

      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
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
  }, [page, search, statusFilter])

  // Load foods when auth is ready and page/search/status params change
  useEffect(() => {
    if (!authLoading && user) {
      loadFoods()
    }
  }, [authLoading, user, loadFoods])

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

      setSuccess('Matvara skapad och godkänd')
      setNewFoodName('')
      await loadFoods()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsAdding(false)
    }
  }

  async function handleApprove(food: Food, skipSimilarCheck = false) {
    try {
      setError(null)
      setSuccess(null)

      // Check for similar foods if not skipping
      if (!skipSimilarCheck) {
        const similarResponse = await fetch(
          `/api/admin/foods/similar?name=${encodeURIComponent(food.name)}`
        )

        if (similarResponse.ok) {
          const similar: SimilarFood[] = await similarResponse.json()
          if (similar.length > 0) {
            // Show warning dialog
            setSimilarFoods(similar)
            setFoodToApprove(food)
            setSimilarDialogOpen(true)
            return
          }
        }
      }

      // Proceed with approval
      const response = await fetch('/api/admin/foods/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: food.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte godkänna matvara')
      }

      setSuccess('Matvara godkänd')
      await loadFoods()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    }
  }

  async function handleReject(foodId: string) {
    try {
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/admin/foods/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: foodId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte avvisa matvara')
      }

      setSuccess('Matvara avvisad')
      await loadFoods()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    }
  }

  function confirmApprove() {
    if (foodToApprove) {
      handleApprove(foodToApprove, true)
      setSimilarDialogOpen(false)
      setSimilarFoods([])
      setFoodToApprove(null)
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

  async function showLinkedRecipes(food: Food) {
    setSelectedFoodForRecipes(food)
    setRecipesDialogOpen(true)
    setLoadingRecipes(true)
    setLinkedRecipes([])

    try {
      const response = await fetch(`/api/admin/foods/recipes?foodId=${food.id}`)
      if (response.ok) {
        const recipes = await response.json()
        setLinkedRecipes(recipes)
      }
    } catch (err) {
      console.error('Failed to load linked recipes:', err)
    } finally {
      setLoadingRecipes(false)
    }
  }

  function updateURL(newPage: number, newSearch: string, newStatus?: FoodStatus | 'all') {
    const params = new URLSearchParams()

    if (newPage > 1) {
      params.set('page', newPage.toString())
    }

    if (newSearch) {
      params.set('search', newSearch)
    }

    const status = newStatus !== undefined ? newStatus : statusFilter
    if (status !== 'pending') {
      params.set('status', status)
    }

    const queryString = params.toString()
    router.replace(queryString ? `/admin/matvaror?${queryString}` : '/admin/matvaror')
  }

  function setStatusFilter(newStatus: FoodStatus | 'all') {
    updateURL(1, search, newStatus)
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

  function getStatusBadge(status: FoodStatus) {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
            Väntar
          </Badge>
        )
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-900 hover:bg-green-100">
            Godkänd
          </Badge>
        )
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-900 hover:bg-red-100">
            Avvisad
          </Badge>
        )
    }
  }

  return (
    <>
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Hantera matvaror
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Granska inlämnade matvaror, skapa nya eller redigera befintliga.
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
        <p className="mb-3 text-sm text-muted-foreground">
          Matvaror som skapas av admin blir automatiskt godkända.
        </p>
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

      {/* Status filter tabs */}
      <Card className="p-4">
        <div className="flex gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
          >
            Alla
          </Button>
          <Button
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('pending')}
          >
            Väntar
          </Button>
          <Button
            variant={statusFilter === 'approved' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('approved')}
          >
            Godkända
          </Button>
          <Button
            variant={statusFilter === 'rejected' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('rejected')}
          >
            Avvisade
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
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{food.name}</span>
                          {getStatusBadge(food.status)}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {food.ingredient_count > 0 ? (
                            <button
                              onClick={() => showLinkedRecipes(food)}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <ChefHat className="h-3 w-3" />
                              {food.ingredient_count}{' '}
                              {food.ingredient_count === 1 ? 'recept' : 'recept'}
                            </button>
                          ) : (
                            <span className="text-muted-foreground/60">
                              Används inte i något recept
                            </span>
                          )}
                          {food.status === 'pending' && food.created_by && (
                            <span className="ml-2">
                              • Inlämnad av: {food.created_by}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {food.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprove(food)}
                              aria-label="Godkänn matvara"
                              className="text-green-600 hover:bg-green-50 hover:text-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReject(food.id)}
                              aria-label="Avvisa matvara"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
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

      {/* Similar foods warning dialog */}
      <Dialog open={similarDialogOpen} onOpenChange={setSimilarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liknande matvaror finns</DialogTitle>
            <DialogDescription>
              Det finns redan liknande matvaror i systemet. Vill du fortfarande godkänna &quot;
              {foodToApprove?.name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <div className="my-4">
            <p className="mb-2 text-sm font-medium">Befintliga liknande matvaror:</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {similarFoods.map((similar) => (
                <li key={similar.id}>{similar.name}</li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setSimilarDialogOpen(false)
                setSimilarFoods([])
                setFoodToApprove(null)
              }}
            >
              Avbryt
            </Button>
            <Button onClick={confirmApprove}>
              Godkänn ändå
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Linked recipes dialog */}
      <Dialog open={recipesDialogOpen} onOpenChange={setRecipesDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Recept med &quot;{selectedFoodForRecipes?.name}&quot;
            </DialogTitle>
            <DialogDescription>
              {loadingRecipes
                ? 'Laddar recept...'
                : linkedRecipes.length === 1
                  ? '1 recept använder denna matvara'
                  : `${linkedRecipes.length} recept använder denna matvara`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {loadingRecipes ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : linkedRecipes.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Inga recept hittades
              </p>
            ) : (
              <ul className="space-y-2">
                {linkedRecipes.map((recipe) => (
                  <li key={recipe.id}>
                    <Link
                      href={`/recept/${recipe.id}`}
                      target="_blank"
                      className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors"
                    >
                      <span className="font-medium">{recipe.name}</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipesDialogOpen(false)}>
              Stäng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

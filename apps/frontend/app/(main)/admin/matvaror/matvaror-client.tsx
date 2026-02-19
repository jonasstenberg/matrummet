'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import { Pencil, Trash2, Plus, AlertCircle, Check, X, ChefHat, ExternalLink, Loader2, Link2 } from '@/lib/icons'
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
import type { Food, FoodStatus, FoodsPaginatedResponse, SimilarFood, LinkedRecipe } from '@/lib/admin-api'
import { getSimilarFoods, getLinkedRecipes } from '@/lib/admin-api'
import {
  approveFood,
  rejectFood,
  renameFood,
  deleteFood,
  createFood,
  approveAsAlias,
  setCanonicalFood,
} from '@/lib/admin-actions'

interface MatvarorClientProps {
  initialData: FoodsPaginatedResponse
  page: number
  search: string
  statusFilter: FoodStatus | 'all'
}

export function MatvarorClient({
  initialData,
  page,
  search,
  statusFilter,
}: MatvarorClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [foods, setFoods] = useState<Food[]>(initialData.items)
  const [total, setTotal] = useState(initialData.total)
  const [totalPages, setTotalPages] = useState(initialData.totalPages)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Update local state when initialData changes (e.g., after navigation)
  useEffect(() => {
    setFoods(initialData.items)
    setTotal(initialData.total)
    setTotalPages(initialData.totalPages)
  }, [initialData])

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

  // Alias dialog
  const [aliasDialogOpen, setAliasDialogOpen] = useState(false)
  const [aliasDialogFood, setAliasDialogFood] = useState<Food | null>(null)
  const [aliasSearchQuery, setAliasSearchQuery] = useState('')
  const [aliasSearchResults, setAliasSearchResults] = useState<Array<{ id: string; name: string }>>([])
  const [aliasSearchLoading, setAliasSearchLoading] = useState(false)
  const aliasSearchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

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
    startTransition(() => {
      router.replace(queryString ? `/admin/matvaror?${queryString}` : '/admin/matvaror')
    })
  }

  function handleSearchChange(value: string) {
    clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      updateURL(1, value)
    }, 300)
  }

  function setStatusFilterValue(newStatus: FoodStatus | 'all') {
    updateURL(1, search, newStatus)
  }

  async function handleAdd() {
    if (!newFoodName.trim()) {
      setError('Matvarunamn kan inte vara tomt')
      return
    }

    setIsAdding(true)
    setError(null)
    setSuccess(null)

    const result = await createFood(newFoodName.trim())

    if (result.success) {
      setSuccess('Matvara skapad och godkänd')
      setNewFoodName('')
      router.refresh()
    } else {
      setError(result.error)
    }

    setIsAdding(false)
  }

  async function handleRename(id: string, newName: string) {
    if (!newName.trim()) {
      setError('Matvarunamn kan inte vara tomt')
      return
    }

    setError(null)
    setSuccess(null)

    const result = await renameFood(id, newName.trim())

    if (result.success) {
      setSuccess('Matvara uppdaterad')
      setEditingId(null)
      setEditName('')
      router.refresh()
    } else {
      setError(result.error)
    }
  }

  async function handleDelete() {
    if (!foodToDelete) return

    setError(null)
    setSuccess(null)

    const result = await deleteFood(foodToDelete.id)

    if (result.success) {
      setSuccess('Matvara borttagen')
      setDeleteDialogOpen(false)
      setFoodToDelete(null)

      // If we deleted the last item on this page and it's not page 1, go back a page
      if (foods.length === 1 && page > 1) {
        updateURL(page - 1, search)
      } else {
        router.refresh()
      }
    } else {
      setError(result.error)
      setDeleteDialogOpen(false)
      setFoodToDelete(null)
    }
  }

  async function handleApprove(food: Food, skipSimilarCheck = false) {
    setError(null)
    setSuccess(null)

    // Check for similar foods if not skipping
    if (!skipSimilarCheck) {
      const similar = await getSimilarFoods(food.name)
      if (similar.length > 0) {
        setSimilarFoods(similar)
        setFoodToApprove(food)
        setSimilarDialogOpen(true)
        return
      }
    }

    const result = await approveFood(food.id)

    if (result.success) {
      setSuccess('Matvara godkänd')
      router.refresh()
    } else {
      setError(result.error)
    }
  }

  async function handleReject(foodId: string) {
    setError(null)
    setSuccess(null)

    const result = await rejectFood(foodId)

    if (result.success) {
      setSuccess('Matvara avvisad')
      router.refresh()
    } else {
      setError(result.error)
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

  async function handleApproveAsAlias(food: Food, canonicalFoodId: string) {
    setError(null)
    setSuccess(null)

    const result = await approveAsAlias(food.id, canonicalFoodId)

    if (result.success) {
      setSuccess('Matvara godkänd som alias')
      setSimilarDialogOpen(false)
      setSimilarFoods([])
      setFoodToApprove(null)
      router.refresh()
    } else {
      setError(result.error)
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

    const recipes = await getLinkedRecipes(food.id)
    setLinkedRecipes(recipes)
    setLoadingRecipes(false)
  }

  function openAliasDialog(food: Food) {
    setAliasDialogFood(food)
    setAliasSearchQuery('')
    setAliasSearchResults([])
    setAliasSearchLoading(false)
    setAliasDialogOpen(true)
  }

  async function handleSetCanonical(food: Food, canonicalFoodId: string, canonicalFoodName: string) {
    setError(null)
    setSuccess(null)

    const result = await setCanonicalFood(food.id, canonicalFoodId)

    if (result.success) {
      setFoods((prev) =>
        prev.map((f) =>
          f.id === food.id
            ? { ...f, canonical_food_id: canonicalFoodId, canonical_food_name: canonicalFoodName }
            : f
        )
      )
      setAliasDialogOpen(false)
      setAliasDialogFood(null)
      setSuccess(`"${food.name}" är nu alias för "${canonicalFoodName}"`)
    } else {
      setError(result.error)
    }
  }

  async function handleClearCanonical(food: Food) {
    setError(null)
    setSuccess(null)

    const result = await setCanonicalFood(food.id, null)

    if (result.success) {
      setFoods((prev) =>
        prev.map((f) =>
          f.id === food.id
            ? { ...f, canonical_food_id: null, canonical_food_name: null }
            : f
        )
      )
      setAliasDialogOpen(false)
      setAliasDialogFood(null)
      setSuccess(`Alias borttaget från "${food.name}"`)
    } else {
      setError(result.error)
    }
  }

  // Debounced alias search
  useEffect(() => {
    if (!aliasSearchQuery.trim()) {
      setAliasSearchResults([])
      setAliasSearchLoading(false)
      return
    }

    setAliasSearchLoading(true)
    clearTimeout(aliasSearchTimeoutRef.current)
    aliasSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          search: aliasSearchQuery,
          status: 'approved',
        })
        const response = await fetch(`/api/admin/foods?${params}`)
        if (response.ok) {
          const data: FoodsPaginatedResponse = await response.json()
          // Filter out the food itself and foods that are already aliases
          const filtered = data.items.filter(
            (f) => f.id !== aliasDialogFood?.id && !f.canonical_food_id
          )
          setAliasSearchResults(filtered.map((f) => ({ id: f.id, name: f.name })))
        }
      } catch {
        // silently fail search
      } finally {
        setAliasSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(aliasSearchTimeoutRef.current)
  }, [aliasSearchQuery, aliasDialogFood?.id])

  function getPageNumbers() {
    const pages: (number | 'ellipsis')[] = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      if (page > 3) {
        pages.push('ellipsis')
      }

      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (page < totalPages - 2) {
        pages.push('ellipsis')
      }

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
            onClick={() => setStatusFilterValue('all')}
          >
            Alla
          </Button>
          <Button
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            onClick={() => setStatusFilterValue('pending')}
          >
            Väntar
          </Button>
          <Button
            variant={statusFilter === 'approved' ? 'default' : 'outline'}
            onClick={() => setStatusFilterValue('approved')}
          >
            Godkända
          </Button>
          <Button
            variant={statusFilter === 'rejected' ? 'default' : 'outline'}
            onClick={() => setStatusFilterValue('rejected')}
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
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'matvara' : 'matvaror'}
          </p>
        </div>

        {isPending ? (
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
                          {food.canonical_food_name && (
                            <Badge className="bg-blue-100 text-blue-900 hover:bg-blue-100">
                              <Link2 className="mr-1 h-3 w-3" />
                              Alias av {food.canonical_food_name}
                            </Badge>
                          )}
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
                              &bull; Inlämnad av: {food.created_by}
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
                        {food.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openAliasDialog(food)}
                            aria-label="Hantera alias"
                            className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                        )}
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
            <div className="space-y-2">
              {similarFoods.map((similar) => (
                <div
                  key={similar.id}
                  className="flex items-center justify-between rounded-lg border border-border p-2 text-sm"
                >
                  <span>{similar.name}</span>
                  {foodToApprove && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApproveAsAlias(foodToApprove, similar.id)}
                      className="ml-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Link2 className="mr-1 h-3 w-3" />
                      Godkänn som alias
                    </Button>
                  )}
                </div>
              ))}
            </div>
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
              Godkänn som egen matvara
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

      {/* Alias management dialog */}
      <Dialog open={aliasDialogOpen} onOpenChange={setAliasDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Hantera alias: {aliasDialogFood?.name}
            </DialogTitle>
            <DialogDescription>
              Sök efter en kanonisk matvara att koppla som alias.
            </DialogDescription>
          </DialogHeader>

          {aliasDialogFood?.canonical_food_name && (
            <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3">
              <span className="text-sm">
                Nuvarande: <strong>{aliasDialogFood.canonical_food_name}</strong>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => aliasDialogFood && handleClearCanonical(aliasDialogFood)}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                Rensa
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <Input
              type="search"
              placeholder="Sök kanonisk matvara..."
              value={aliasSearchQuery}
              onChange={(e) => setAliasSearchQuery(e.target.value)}
              autoFocus
            />

            {aliasSearchLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!aliasSearchLoading && aliasSearchResults.length > 0 && (
              <div className="max-h-60 space-y-1 overflow-y-auto">
                {aliasSearchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() =>
                      aliasDialogFood &&
                      handleSetCanonical(aliasDialogFood, result.id, result.name)
                    }
                    className="w-full rounded-lg border border-border p-2 text-left text-sm hover:bg-accent/50 transition-colors"
                  >
                    {result.name}
                  </button>
                ))}
              </div>
            )}

            {!aliasSearchLoading &&
              aliasSearchQuery.trim() &&
              aliasSearchResults.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  Inga matchande matvaror hittades
                </p>
              )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAliasDialogOpen(false)}>
              Avbryt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

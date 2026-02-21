import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
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
import { Pencil, Trash2, Plus, AlertCircle, Check, X, ChefHat, ExternalLink, Loader2, Link2, Search, Sparkles } from '@/lib/icons'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import type { Food, FoodStatus, FoodsPaginatedResponse, SimilarFood, LinkedRecipe, AliasFilter } from '@/lib/admin-api'
import { getSimilarFoods, getLinkedRecipes } from '@/lib/admin-api'
import {
  approveFood,
  rejectFood,
  renameFood,
  deleteFood,
  createFood,
  approveAsAlias,
  setCanonicalFood,
  bulkApproveFoods,
  bulkRejectFoods,
} from '@/lib/admin-actions'

interface MatvarorClientProps {
  initialData: FoodsPaginatedResponse
  page: number
  search: string
  statusFilter: FoodStatus | 'all'
  aliasFilter: AliasFilter
  pendingCount: number
}

const STATUS_TABS: Array<{ value: FoodStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Alla' },
  { value: 'pending', label: 'Väntar' },
  { value: 'approved', label: 'Godkända' },
  { value: 'rejected', label: 'Avvisade' },
]

const ALIAS_TABS: Array<{ value: AliasFilter; label: string }> = [
  { value: 'all', label: 'Alla' },
  { value: 'is_alias', label: 'Alias' },
  { value: 'has_aliases', label: 'Har alias' },
  { value: 'standalone', label: 'Fristående' },
]

export function MatvarorClient({
  initialData,
  page,
  search,
  statusFilter,
  aliasFilter,
  pendingCount,
}: MatvarorClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [foods, setFoods] = useState<Food[]>(initialData.items)
  const [total, setTotal] = useState(initialData.total)
  const [totalPages, setTotalPages] = useState(initialData.totalPages)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Update local state when initialData changes (e.g., after navigation)
  useEffect(() => {
    setFoods(initialData.items)
    setTotal(initialData.total)
    setTotalPages(initialData.totalPages)
    setSelectedIds(new Set())
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

  function updateURL(newPage: number, newSearch: string, newStatus?: FoodStatus | 'all', newAlias?: AliasFilter) {
    const status: FoodStatus | 'all' = newStatus !== undefined ? newStatus : statusFilter
    const alias: AliasFilter = newAlias !== undefined ? newAlias : aliasFilter
    startTransition(() => {
      router.navigate({
        to: '/admin/matvaror',
        search: {
          page: newPage,
          search: newSearch,
          status,
          alias,
        },
        replace: true,
      })
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
      router.invalidate()
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
      router.invalidate()
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

      if (foods.length === 1 && page > 1) {
        updateURL(page - 1, search)
      } else {
        router.invalidate()
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
      router.invalidate()
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
      router.invalidate()
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
      router.invalidate()
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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const pendingIds = foods.filter((f) => f.status === 'pending').map((f) => f.id)
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id))

    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingIds))
    }
  }

  async function handleBulkApprove() {
    const ids = Array.from(selectedIds)
    setError(null)
    setSuccess(null)

    const result = await bulkApproveFoods(ids)

    if (result.success) {
      setSuccess(`${result.data?.succeeded} matvaror godkända`)
      setSelectedIds(new Set())
      router.invalidate()
    } else {
      setError(result.error)
    }
  }

  async function handleBulkReject() {
    const ids = Array.from(selectedIds)
    setError(null)
    setSuccess(null)

    const result = await bulkRejectFoods(ids)

    if (result.success) {
      setSuccess(`${result.data?.succeeded} matvaror avvisade`)
      setSelectedIds(new Set())
      router.invalidate()
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
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            Väntar
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
            Godkänd
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">
            Avvisad
          </span>
        )
    }
  }

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Matvaror
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Granska, godkänn och hantera matvaror i systemet.
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
      <div className="rounded-2xl bg-card p-5 shadow-(--shadow-card)">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Ny matvara
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
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
      </div>

      {/* Foods list */}
      <div className="overflow-hidden rounded-2xl bg-card shadow-(--shadow-card)">
        {/* Header with filter tabs and search */}
        <div className="border-b border-border/40 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Segmented status filter */}
            <div className="inline-flex rounded-lg bg-muted/50 p-0.5">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilterValue(tab.value)}
                  className={cn(
                    'relative rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                    statusFilter === tab.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                  {tab.value === 'pending' && pendingCount > 0 && (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search + count */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground/60">
                {total} {total === 1 ? 'matvara' : 'matvaror'}
              </span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                <input
                  type="search"
                  placeholder="Sök matvaror..."
                  defaultValue={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="h-8 w-52 rounded-lg border-0 bg-muted/50 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Alias filter row */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">Alias:</span>
            <div className="inline-flex rounded-lg bg-muted/50 p-0.5">
              {ALIAS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => updateURL(1, search, undefined, tab.value)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-medium transition-all',
                    aliasFilter === tab.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isPending ? (
          <div className="flex items-center justify-center px-5 py-12">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Laddar matvaror...</p>
          </div>
        ) : foods.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {search
                ? 'Inga matvaror hittades'
                : 'Inga matvaror finns ännu'}
            </p>
          </div>
        ) : (
          <>
            {/* Select all header for pending foods */}
            {foods.some((f) => f.status === 'pending') && (
              <div className="flex items-center gap-2 border-b border-border/40 px-5 py-2">
                <input
                  type="checkbox"
                  checked={
                    foods.filter((f) => f.status === 'pending').length > 0 &&
                    foods.filter((f) => f.status === 'pending').every((f) => selectedIds.has(f.id))
                  }
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5 rounded border-border/60 text-primary accent-primary"
                />
                <span className="text-[11px] text-muted-foreground/60">Markera alla väntande</span>
              </div>
            )}

            <div className="divide-y divide-border/40">
              {foods.map((food) => (
                <div
                  key={food.id}
                  className="flex items-center px-5 py-3 transition-colors hover:bg-muted/30"
                >
                  {/* Bulk checkbox for pending foods */}
                  {food.status === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(food.id)}
                      onChange={() => toggleSelect(food.id)}
                      className="mr-3 h-3.5 w-3.5 shrink-0 rounded border-border/60 text-primary accent-primary"
                    />
                  )}

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
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-medium">{food.name}</span>
                          {getStatusBadge(food.status)}
                          {food.canonical_food_name && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                              <Link2 className="mr-1 h-2.5 w-2.5" />
                              {food.canonical_food_name}
                            </span>
                          )}
                          {/* AI suggestion hint */}
                          {food.status === 'pending' && food.ai_decision && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Sparkles className="h-3 w-3 text-rose-400" />
                              {food.ai_decision === 'merge' && food.ai_suggested_merge_name
                                ? `Länka till '${food.ai_suggested_merge_name}' (${Math.round((food.ai_confidence ?? 0) * 100)}%)`
                                : food.ai_decision === 'approve'
                                  ? `Godkänn (${Math.round((food.ai_confidence ?? 0) * 100)}%)`
                                  : `Avvisa (${Math.round((food.ai_confidence ?? 0) * 100)}%)`}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground/60">
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
                            <span>Används inte</span>
                          )}
                          {food.status === 'pending' && food.created_by && (
                            <span className="ml-2">
                              &bull; {food.created_by}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {/* Approve button: shown for pending + rejected foods */}
                        {(food.status === 'pending' || food.status === 'rejected') && (
                          <button
                            onClick={() => handleApprove(food)}
                            className="rounded-lg p-2 text-emerald-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                            aria-label="Godkänn matvara"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        {/* Reject button: only for pending */}
                        {food.status === 'pending' && (
                          <button
                            onClick={() => handleReject(food.id)}
                            className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            aria-label="Avvisa matvara"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        {/* AI merge confirm button */}
                        {food.status === 'pending' && food.ai_suggested_merge_id && (
                          <button
                            onClick={() => handleApproveAsAlias(food, food.ai_suggested_merge_id!)}
                            className="rounded-lg px-2 py-1 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-50"
                          >
                            Bekräfta
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(food)}
                          className="rounded-lg p-2 text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-foreground"
                          aria-label="Redigera matvara"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {food.status === 'approved' && (
                          <button
                            onClick={() => openAliasDialog(food)}
                            className="rounded-lg p-2 text-blue-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                            aria-label="Hantera alias"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => confirmDelete(food)}
                          className="rounded-lg p-2 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Ta bort matvara"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-border/40 px-5 py-3">
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
      </div>

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
                  className="flex items-center justify-between rounded-xl border border-border/40 p-3 text-sm"
                >
                  <span className="font-medium">{similar.name}</span>
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
              <div className="divide-y divide-border/40 rounded-xl border border-border/40 overflow-hidden">
                {linkedRecipes.map((recipe) => (
                  <Link
                    key={recipe.id}
                    to="/recept/$id"
                    params={{ id: recipe.id }}
                    target="_blank"
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-medium">{recipe.name}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </Link>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipesDialogOpen(false)}>
              Stäng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-card px-5 py-3 shadow-(--shadow-card-hover)">
          <span className="text-sm font-medium">{selectedIds.size} valda</span>
          <Button size="sm" onClick={handleBulkApprove}>Godkänn</Button>
          <Button size="sm" variant="destructive" onClick={handleBulkReject}>Avvisa</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

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
            <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-3">
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="search"
                placeholder="Sök kanonisk matvara..."
                value={aliasSearchQuery}
                onChange={(e) => setAliasSearchQuery(e.target.value)}
                autoFocus
                className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {aliasSearchLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!aliasSearchLoading && aliasSearchResults.length > 0 && (
              <div className="max-h-60 overflow-y-auto rounded-xl border border-border/40 divide-y divide-border/40">
                {aliasSearchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() =>
                      aliasDialogFood &&
                      handleSetCanonical(aliasDialogFood, result.id, result.name)
                    }
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted/30 transition-colors"
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

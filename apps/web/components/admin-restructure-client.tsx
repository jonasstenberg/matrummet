import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, getRouteApi, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, Wand2, Check, X, ChevronRight, RefreshCw, ExternalLink, Search, Eye, EyeOff, RotateCcw } from '@/lib/icons'
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

interface RecipeItem {
  id: string
  name: string
  groupCount: number
  ingredientCount: number
  instructionCount: number
  groups: string[]
  hasLegacyFormat?: boolean
  hasInstructions?: boolean
}

interface PaginatedResponse {
  items: RecipeItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface IngredientGroup {
  group_name: string
  ingredients: Array<{
    name: string
    measurement: string
    quantity: string
  }>
}

interface RestructuredData {
  groups: IngredientGroup[]
  ungrouped_ingredients: Array<{
    name: string
    measurement: string
    quantity: string
  }>
}

interface InstructionGroup {
  group_name: string
  steps: string[]
}

interface ImprovedInstructionsData {
  groups: InstructionGroup[]
  ungrouped_steps: string[]
}

interface PreviewResponse {
  recipe: {
    id: string
    name: string
  }
  current: {
    ingredient_groups: Array<{ id: string; name: string; sort_order: number }> | null
    ingredients: Array<{
      id: string
      name: string
      measurement: string
      quantity: string
      group_id: string | null
      sort_order: number
    }> | null
    instructions: Array<{
      id: string
      step: string
      group_id: string | null
      sort_order: number
    }> | null
  }
  restructured?: RestructuredData
  updateFormat?: Array<{ group?: string; name?: string; measurement?: string; quantity?: string }>
  improvedInstructions?: ImprovedInstructionsData
  instructionsUpdateFormat?: Array<{ group?: string; step?: string }>
}

interface AdminRestructureClientProps {
  initialData: PaginatedResponse
}

export function AdminRestructureClient({ initialData }: AdminRestructureClientProps) {
  const router = useRouter()
  const searchParams = getRouteApi('/_main/admin/strukturera').useSearch()
  const [recipes, setRecipes] = useState<RecipeItem[]>(initialData.items)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Pagination and search
  const page = searchParams.page ?? 1
  const search = searchParams.search || ''
  const [totalPages, setTotalPages] = useState(initialData.totalPages)

  // Debounce for search
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Preview dialog state
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null)
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeItem | null>(null)
  const [applying, setApplying] = useState(false)
  const [customInstructions, setCustomInstructions] = useState('')
  const [includeIngredients, setIncludeIngredients] = useState(true)
  const [includeInstructions, setIncludeInstructions] = useState(false)

  // Skip / mark as reviewed
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('admin-restructure-skipped')
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })
  const [showSkipped, setShowSkipped] = useState(false)

  // Without instructions filter
  const [onlyWithoutInstructions, setOnlyWithoutInstructions] = useState(false)

  function persistSkipped(ids: Set<string>) {
    setSkippedIds(ids)
    localStorage.setItem('admin-restructure-skipped', JSON.stringify([...ids]))
  }

  function handleSkip(id: string) {
    const next = new Set(skippedIds)
    next.add(id)
    persistSkipped(next)
  }

  function handleRestore(id: string) {
    const next = new Set(skippedIds)
    next.delete(id)
    persistSkipped(next)
  }

  // Filter recipes: skip/restore + without instructions filter
  const visibleRecipes = recipes.filter(r => {
    if (onlyWithoutInstructions && r.hasInstructions) return false
    if (showSkipped) return true
    return !skippedIds.has(r.id)
  })

  const skippedCount = recipes.filter(r => skippedIds.has(r.id)).length
  const remainingCount = recipes.filter(r => !skippedIds.has(r.id) && (!onlyWithoutInstructions || !r.hasInstructions)).length

  const loadRecipes = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({ page: page.toString() })
      if (search) {
        params.set('search', search)
      }
      if (includeInstructions && !includeIngredients) {
        params.set('mode', 'all')
      }

      const response = await fetch(`/api/admin/restructure?${params}`)

      if (response.status === 403) {
        throw new Error('Du har inte behörighet')
      }

      if (!response.ok) {
        throw new Error('Kunde inte ladda recept')
      }

      const data: PaginatedResponse = await response.json()
      setRecipes(data.items)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setLoading(false)
    }
  }, [page, search, includeIngredients, includeInstructions])

  useEffect(() => {
    if (page !== initialData.page || search !== '' || includeIngredients !== true || includeInstructions !== false) {
      loadRecipes()
    }
  }, [page, search, includeIngredients, includeInstructions, loadRecipes, initialData.page])

  async function handlePreview(recipe: RecipeItem, instructions?: string, ingFlag?: boolean, instrFlag?: boolean) {
    setSelectedRecipe(recipe)
    setPreviewDialogOpen(true)
    setPreviewLoading(true)
    setPreviewData(null)
    setError(null)

    const shouldIncludeIngredients = ingFlag ?? includeIngredients
    const shouldIncludeInstructions = instrFlag ?? includeInstructions

    try {
      const response = await fetch('/api/admin/restructure/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: recipe.id,
          instructions: instructions || customInstructions || undefined,
          includeIngredients: shouldIncludeIngredients,
          includeInstructions: shouldIncludeInstructions,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte generera förhandsgranskning')
      }

      const data: PreviewResponse = await response.json()
      setPreviewData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
      setPreviewDialogOpen(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleApply() {
    if (!previewData) return

    setApplying(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/restructure/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: previewData.recipe.id,
          ...(previewData.updateFormat && { ingredients: previewData.updateFormat }),
          ...(previewData.instructionsUpdateFormat && { instructions: previewData.instructionsUpdateFormat }),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte uppdatera receptet')
      }

      const updatedParts: string[] = []
      if (previewData.updateFormat) updatedParts.push('ingredienser')
      if (previewData.instructionsUpdateFormat) updatedParts.push('instruktioner')

      setSuccess(`"${previewData.recipe.name}" har uppdaterats (${updatedParts.join(' och ')})`)
      setPreviewDialogOpen(false)
      setPreviewData(null)
      setSelectedRecipe(null)
      setCustomInstructions('')
      await loadRecipes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setApplying(false)
    }
  }

  function updateURL(newPage: number, newSearch: string) {
    const search: { page?: number; search?: string; mode?: string } = {}
    if (newPage > 1) {
      search.page = newPage
    }
    if (newSearch) {
      search.search = newSearch
    }
    router.navigate({ to: '/admin/strukturera', search, replace: true })
  }

  function handleSearchChange(value: string) {
    clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      updateURL(1, value)
    }, 300)
  }

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

  function formatIngredient(ing: { name: string; measurement: string; quantity: string }) {
    const parts = [ing.quantity, ing.measurement, ing.name].filter(Boolean)
    return parts.join(' ')
  }

  function groupCurrentIngredients() {
    if (!previewData?.current) return { groups: [], ungrouped: [] }

    const { ingredient_groups, ingredients } = previewData.current
    if (!ingredients) return { groups: [], ungrouped: [] }

    const groupMap = new Map<string | null, typeof ingredients>()

    for (const ing of ingredients) {
      const key = ing.group_id
      if (!groupMap.has(key)) {
        groupMap.set(key, [])
      }
      groupMap.get(key)!.push(ing)
    }

    const groups: Array<{ name: string; ingredients: typeof ingredients }> = []

    if (ingredient_groups) {
      for (const g of ingredient_groups.sort((a, b) => a.sort_order - b.sort_order)) {
        const ings = groupMap.get(g.id) || []
        groups.push({ name: g.name, ingredients: ings.sort((a, b) => a.sort_order - b.sort_order) })
      }
    }

    const ungrouped = groupMap.get(null) || []

    return { groups, ungrouped: ungrouped.sort((a, b) => a.sort_order - b.sort_order) }
  }

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Strukturera recept
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Använd AI för att organisera ingredienser och förbättra instruktioner.
        </p>
      </header>

      {/* Mode toggles */}
      <div className="rounded-2xl bg-card p-5 shadow-(--shadow-card)">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Vad vill du göra?
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIncludeIngredients(!includeIngredients)}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all',
              includeIngredients
                ? 'border-primary/30 bg-primary/5 text-primary'
                : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            <span className={cn(
              'flex h-5 w-5 items-center justify-center rounded-md border text-[11px]',
              includeIngredients
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/60'
            )}>
              {includeIngredients && <Check className="h-3 w-3" />}
            </span>
            Strukturera ingredienser
          </button>
          <button
            onClick={() => setIncludeInstructions(!includeInstructions)}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all',
              includeInstructions
                ? 'border-primary/30 bg-primary/5 text-primary'
                : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            <span className={cn(
              'flex h-5 w-5 items-center justify-center rounded-md border text-[11px]',
              includeInstructions
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/60'
            )}>
              {includeInstructions && <Check className="h-3 w-3" />}
            </span>
            Förbättra/skapa instruktioner
          </button>
        </div>
        {!includeIngredients && !includeInstructions && (
          <p className="mt-3 text-xs text-destructive">
            Välj minst ett alternativ
          </p>
        )}
      </div>

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

      {/* Recipe list */}
      <div className="overflow-hidden rounded-2xl bg-card shadow-(--shadow-card)">
        {/* Header with search */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
              {includeInstructions && !includeIngredients
                ? 'Alla recept'
                : 'Recept med ingrediensgrupper'}
            </p>
            {!loading && (
              <p className="mt-0.5 text-xs text-muted-foreground/50">
                {remainingCount} recept kvar{skippedCount > 0 && ` (${skippedCount} överhoppade)`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Without instructions filter (only when instructions mode is active and ingredients off) */}
            {includeInstructions && !includeIngredients && (
              <button
                onClick={() => setOnlyWithoutInstructions(!onlyWithoutInstructions)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  onlyWithoutInstructions
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground/60 hover:text-muted-foreground'
                )}
              >
                Utan instruktioner
              </button>
            )}
            {/* Show/hide skipped toggle */}
            {skippedCount > 0 && (
              <button
                onClick={() => setShowSkipped(!showSkipped)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  showSkipped
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground/60 hover:text-muted-foreground'
                )}
              >
                {showSkipped ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                Visa överhoppade ({skippedCount})
              </button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="search"
                placeholder="Sök recept..."
                defaultValue={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-8 w-52 rounded-lg border-0 bg-muted/50 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">Laddar recept...</p>
          </div>
        ) : visibleRecipes.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {search ? 'Inga recept hittades' : 'Inga recept med ingrediensgrupper finns'}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/40">
              {visibleRecipes.map((recipe) => {
                const isSkipped = skippedIds.has(recipe.id)
                return (
                  <div
                    key={recipe.id}
                    className={cn(
                      'flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30',
                      isSkipped && 'opacity-50'
                    )}
                  >
                    {/* Priority dot */}
                    {recipe.hasLegacyFormat ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" title="Legacy #-format" />
                    ) : !recipe.hasInstructions ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Inga instruktioner" />
                    ) : (
                      <span className="h-2 w-2 shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/recept/$id"
                          params={{ id: recipe.id }}
                          className={cn(
                            'text-[15px] font-medium hover:underline',
                            isSkipped && 'line-through text-muted-foreground'
                          )}
                          target="_blank"
                        >
                          {recipe.name}
                        </Link>
                        <Link
                          to="/recept/$id"
                          params={{ id: recipe.id }}
                          target="_blank"
                          className="text-muted-foreground/40 hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {recipe.groupCount > 0 && (
                          <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {recipe.groupCount} {recipe.groupCount === 1 ? 'grupp' : 'grupper'}
                          </span>
                        )}
                        <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {recipe.ingredientCount} ingredienser
                        </span>
                        <span className={cn(
                          'rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                          recipe.hasInstructions
                            ? 'bg-muted/60 text-muted-foreground'
                            : 'bg-red-100 text-red-700'
                        )}>
                          {recipe.instructionCount} instruktioner
                        </span>
                        {recipe.hasLegacyFormat && (
                          <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                            Legacy #-format
                          </span>
                        )}
                      </div>
                      {recipe.groups.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground/50">
                          {recipe.groups.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isSkipped ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRestore(recipe.id)}
                          className="text-muted-foreground"
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          Återställ
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSkip(recipe.id)}
                            className="text-muted-foreground/50 hover:text-muted-foreground"
                            title="Hoppa över"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handlePreview(recipe)}
                            disabled={!includeIngredients && !includeInstructions}
                          >
                            <Wand2 className="mr-2 h-3.5 w-3.5" />
                            {includeIngredients && includeInstructions
                              ? 'Strukturera'
                              : includeInstructions
                              ? 'Instruktioner'
                              : 'Ingredienser'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
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
                          if (page > 1) updateURL(page - 1, search)
                        }}
                        className={page === 1 ? 'pointer-events-none opacity-50' : ''}
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
                          if (page < totalPages) updateURL(page + 1, search)
                        }}
                        className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Förhandsgranskning: {selectedRecipe?.name}
            </DialogTitle>
            <DialogDescription>
              Granska den föreslagna strukturen innan du tillämpar ändringarna.
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Genererar förslag med AI...</span>
            </div>
          ) : previewData ? (
            <div className="space-y-6">
              {/* Ingredients preview */}
              {previewData.restructured && (
                <div>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Ingredienser</h4>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                    {/* Current ingredients */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-destructive">Nuvarande</h3>
                      <div className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 max-h-64 overflow-y-auto">
                        {(() => {
                          const { groups, ungrouped } = groupCurrentIngredients()
                          return (
                            <>
                              {ungrouped.length > 0 && (
                                <div>
                                  <p className="text-[11px] font-medium text-muted-foreground/60">Utan grupp</p>
                                  <ul className="mt-1 space-y-0.5">
                                    {ungrouped.map((ing) => (
                                      <li key={ing.id} className="text-sm">
                                        {formatIngredient(ing)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {groups.map((group, i) => (
                                <div key={i}>
                                  <p className="text-[11px] font-medium text-muted-foreground/60">
                                    {group.name}
                                  </p>
                                  <ul className="mt-1 space-y-0.5">
                                    {group.ingredients.length === 0 ? (
                                      <li className="text-sm italic text-muted-foreground">
                                        (inga ingredienser)
                                      </li>
                                    ) : (
                                      group.ingredients.map((ing) => (
                                        <li key={ing.id} className="text-sm">
                                          {formatIngredient(ing)}
                                        </li>
                                      ))
                                    )}
                                  </ul>
                                </div>
                              ))}
                            </>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center self-center py-8">
                      <ChevronRight className="h-8 w-8 text-muted-foreground/30" />
                    </div>

                    {/* Proposed ingredients */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-emerald-600">Föreslagen</h3>
                      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 max-h-64 overflow-y-auto">
                        {previewData.restructured.ungrouped_ingredients.length > 0 && (
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground/60">Utan grupp</p>
                            <ul className="mt-1 space-y-0.5">
                              {previewData.restructured.ungrouped_ingredients.map((ing, i) => (
                                <li key={i} className="text-sm">
                                  {formatIngredient(ing)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {previewData.restructured.groups.map((group, i) => (
                          <div key={i}>
                            <p className="text-[11px] font-medium text-muted-foreground/60">
                              {group.group_name}
                            </p>
                            <ul className="mt-1 space-y-0.5">
                              {group.ingredients.map((ing, j) => (
                                <li key={j} className="text-sm">
                                  {formatIngredient(ing)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Instructions preview */}
              {previewData.improvedInstructions && (
                <div>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Instruktioner</h4>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                    {/* Current instructions */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-destructive">Nuvarande</h3>
                      <div className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/5 p-4 max-h-64 overflow-y-auto">
                        {previewData.current.instructions && previewData.current.instructions.length > 0 ? (
                          <ol className="list-decimal list-inside space-y-1">
                            {previewData.current.instructions.map((instr, i) => (
                              <li key={i} className="text-sm">{instr.step}</li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-sm italic text-muted-foreground">Inga instruktioner</p>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center self-center py-8">
                      <ChevronRight className="h-8 w-8 text-muted-foreground/30" />
                    </div>

                    {/* Proposed instructions */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-emerald-600">Föreslagen</h3>
                      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 max-h-64 overflow-y-auto">
                        {previewData.improvedInstructions.ungrouped_steps.length > 0 && (
                          <ol className="list-decimal list-inside space-y-1">
                            {previewData.improvedInstructions.ungrouped_steps.map((step, i) => (
                              <li key={i} className="text-sm">{step}</li>
                            ))}
                          </ol>
                        )}
                        {previewData.improvedInstructions.groups.map((group, i) => (
                          <div key={i}>
                            <p className="text-[11px] font-medium text-muted-foreground/60">
                              {group.group_name}
                            </p>
                            <ol className="mt-1 list-decimal list-inside space-y-1">
                              {group.steps.map((step, j) => (
                                <li key={j} className="text-sm">{step}</li>
                              ))}
                            </ol>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Custom instructions */}
          {previewData && (
            <div className="space-y-2 border-t border-border/40 pt-4">
              <Label htmlFor="instructions" className="text-sm font-medium">
                Instruktioner till AI (valfritt)
              </Label>
              <Textarea
                id="instructions"
                placeholder="T.ex. 'Lägg all potatis under Potatispuré' eller 'Timjan och rosmarin hör till lammsteken'"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="h-20 resize-none"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setPreviewDialogOpen(false)
                setPreviewData(null)
                setSelectedRecipe(null)
                setCustomInstructions('')
              }}
              disabled={applying}
            >
              <X className="mr-2 h-4 w-4" />
              Avbryt
            </Button>
            {previewData && (
              <Button
                onClick={() => handlePreview(selectedRecipe!, customInstructions)}
                variant="outline"
                disabled={previewLoading || applying}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${previewLoading ? 'animate-spin' : ''}`} />
                Generera nytt förslag
              </Button>
            )}
            <Button
              onClick={handleApply}
              disabled={!previewData || previewLoading || applying}
            >
              <Check className="mr-2 h-4 w-4" />
              {applying ? 'Tillämpar...' : 'Tillämpa ändringar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

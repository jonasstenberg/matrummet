'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
import { AlertCircle, Wand2, Check, X, ChevronRight, RefreshCw, ExternalLink } from 'lucide-react'
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

export default function AdminRestructurePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const [recipes, setRecipes] = useState<RecipeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Pagination and search
  const page = parseInt(searchParams.get('page') || '1', 10)
  const search = searchParams.get('search') || ''
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

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

  useEffect(() => {
    if (!authLoading && user) {
      loadRecipes()
    }
  }, [authLoading, user, page, search, includeIngredients, includeInstructions])

  async function loadRecipes() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({ page: page.toString() })
      if (search) {
        params.set('search', search)
      }
      // Show all recipes when only instructions mode, otherwise filter to those needing restructuring
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
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setLoading(false)
    }
  }

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
    const params = new URLSearchParams()
    if (newPage > 1) {
      params.set('page', newPage.toString())
    }
    if (newSearch) {
      params.set('search', newSearch)
    }
    const queryString = params.toString()
    router.replace(queryString ? `/admin/strukturera?${queryString}` : '/admin/strukturera')
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

  // Group current ingredients by their group_id for display
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
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Strukturera recept
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Använd AI för att organisera ingredienser och förbättra/skapa instruktioner.
        </p>
      </header>

      {/* Mode toggles */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeIngredients"
              checked={includeIngredients}
              onCheckedChange={(checked) => setIncludeIngredients(checked === true)}
            />
            <Label htmlFor="includeIngredients" className="cursor-pointer">
              Strukturera ingredienser
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeInstructions"
              checked={includeInstructions}
              onCheckedChange={(checked) => setIncludeInstructions(checked === true)}
            />
            <Label htmlFor="includeInstructions" className="cursor-pointer">
              Förbättra/skapa instruktioner
            </Label>
          </div>
        </div>
        {!includeIngredients && !includeInstructions && (
          <p className="mt-2 text-sm text-destructive">
            Välj minst ett alternativ
          </p>
        )}
      </Card>

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

      {/* Search */}
      <Card className="p-4">
        <Input
          type="search"
          placeholder="Sök recept..."
          defaultValue={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </Card>

      {/* Recipe list */}
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {includeInstructions && !includeIngredients
              ? 'Alla recept'
              : 'Recept med ingrediensgrupper'}
          </h2>
          {!loading && (
            <p className="text-sm text-muted-foreground">
              {total} {total === 1 ? 'recept' : 'recept'}
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Laddar recept...</p>
        ) : recipes.length === 0 ? (
          <p className="text-center text-muted-foreground">
            {search ? 'Inga recept hittades' : 'Inga recept med ingrediensgrupper finns'}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/recept/${recipe.id}`}
                        className="font-medium hover:underline"
                        target="_blank"
                      >
                        {recipe.name}
                      </Link>
                      <Link
                        href={`/recept/${recipe.id}`}
                        target="_blank"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      {recipe.groupCount > 0 && (
                        <Badge variant="secondary">
                          {recipe.groupCount} {recipe.groupCount === 1 ? 'grupp' : 'grupper'}
                        </Badge>
                      )}
                      <Badge variant="outline">
                        {recipe.ingredientCount} ingredienser
                      </Badge>
                      <Badge variant={recipe.hasInstructions ? 'outline' : 'destructive'}>
                        {recipe.instructionCount} instruktioner
                      </Badge>
                      {recipe.hasLegacyFormat && (
                        <Badge variant="destructive" className="text-xs">
                          Legacy #-format
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {recipe.groups.map((group, i) => (
                        <span
                          key={i}
                          className="text-xs text-muted-foreground"
                        >
                          {group}{i < recipe.groups.length - 1 ? ',' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handlePreview(recipe)}
                    className="ml-4"
                    disabled={!includeIngredients && !includeInstructions}
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {includeIngredients && includeInstructions
                      ? 'Strukturera'
                      : includeInstructions
                      ? 'Förbättra instruktioner'
                      : 'Strukturera ingredienser'}
                  </Button>
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
      </Card>

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
                  <h4 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">Ingredienser</h4>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                    {/* Current ingredients */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-destructive">Nuvarande</h3>
                      <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 max-h-64 overflow-y-auto">
                        {(() => {
                          const { groups, ungrouped } = groupCurrentIngredients()
                          return (
                            <>
                              {ungrouped.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">Utan grupp</p>
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
                                  <p className="text-xs font-medium text-muted-foreground">
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
                      <ChevronRight className="h-8 w-8 text-muted-foreground" />
                    </div>

                    {/* Proposed ingredients */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-green-600">Föreslagen</h3>
                      <div className="space-y-3 rounded-lg border border-green-300 bg-green-50 p-4 max-h-64 overflow-y-auto">
                        {previewData.restructured.ungrouped_ingredients.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Utan grupp</p>
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
                            <p className="text-xs font-medium text-muted-foreground">
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
                  <h4 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">Instruktioner</h4>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                    {/* Current instructions */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-destructive">Nuvarande</h3>
                      <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 max-h-64 overflow-y-auto">
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
                      <ChevronRight className="h-8 w-8 text-muted-foreground" />
                    </div>

                    {/* Proposed instructions */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-green-600">Föreslagen</h3>
                      <div className="space-y-3 rounded-lg border border-green-300 bg-green-50 p-4 max-h-64 overflow-y-auto">
                        {previewData.improvedInstructions.ungrouped_steps.length > 0 && (
                          <ol className="list-decimal list-inside space-y-1">
                            {previewData.improvedInstructions.ungrouped_steps.map((step, i) => (
                              <li key={i} className="text-sm">{step}</li>
                            ))}
                          </ol>
                        )}
                        {previewData.improvedInstructions.groups.map((group, i) => (
                          <div key={i}>
                            <p className="text-xs font-medium text-muted-foreground">
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
            <div className="space-y-2 border-t pt-4">
              <label htmlFor="instructions" className="text-sm font-medium">
                Instruktioner till AI (valfritt)
              </label>
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

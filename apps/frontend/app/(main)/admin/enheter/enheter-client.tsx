'use client'

import { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UnitsPaginatedResponse, LinkedRecipe } from '@/lib/admin-api'
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface Unit {
  id: string
  name: string
  plural: string
  abbreviation: string
  ingredient_count: number
}

type FilterTab = 'all' | 'unused' | 'missing_abbreviation'

const FILTER_TABS: Array<{ value: FilterTab; label: string }> = [
  { value: 'all', label: 'Alla' },
  { value: 'unused', label: 'Oanvända' },
  { value: 'missing_abbreviation', label: 'Utan förkortning' },
]

interface EnheterClientProps {
  initialData: UnitsPaginatedResponse
  page: number
  search: string
}

export function EnheterClient({ initialData, page: currentPage, search: searchQuery }: EnheterClientProps) {
  const router = useRouter()
  const [units, setUnits] = useState<Unit[]>(initialData.items)
  const [totalPages, setTotalPages] = useState(initialData.totalPages)
  const [total, setTotal] = useState(initialData.total)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Search debounce
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Filter
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPlural, setEditPlural] = useState('')
  const [editAbbreviation, setEditAbbreviation] = useState('')

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null)

  // New unit
  const [newUnitName, setNewUnitName] = useState('')
  const [newUnitPlural, setNewUnitPlural] = useState('')
  const [newUnitAbbreviation, setNewUnitAbbreviation] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Linked recipes dialog
  const [recipesDialogOpen, setRecipesDialogOpen] = useState(false)
  const [recipesDialogTitle, setRecipesDialogTitle] = useState('')
  const [linkedRecipes, setLinkedRecipes] = useState<LinkedRecipe[]>([])
  const [loadingRecipes, setLoadingRecipes] = useState(false)

  // Merge dialog
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [mergeSource, setMergeSource] = useState<Unit | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [mergeSearch, setMergeSearch] = useState('')
  const [isMerging, setIsMerging] = useState(false)

  // Filtered units for display
  const filteredUnits = useMemo(() => {
    if (activeFilter === 'unused') {
      return units.filter(u => u.ingredient_count === 0)
    }
    if (activeFilter === 'missing_abbreviation') {
      return units.filter(u => !u.abbreviation)
    }
    return units
  }, [units, activeFilter])

  // Merge target options
  const mergeTargetOptions = useMemo(() => {
    if (!mergeSource) return []
    return units
      .filter(u => u.id !== mergeSource.id)
      .filter(u => !mergeSearch || u.name.toLowerCase().includes(mergeSearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, [units, mergeSource, mergeSearch])

  async function loadUnits() {
    try {
      setError(null)

      const params = new URLSearchParams({
        page: currentPage.toString(),
      })

      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const response = await fetch(`/api/admin/units?${params.toString()}`)

      if (response.status === 403) {
        throw new Error('Du har inte behörighet att hantera enheter')
      }

      if (!response.ok) {
        throw new Error('Kunde inte ladda enheter')
      }

      const data: UnitsPaginatedResponse = await response.json()

      setUnits(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    }
  }

  function handleSearchChange(value: string) {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      updateURL(1, value)
    }, 300)
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
    router.replace(queryString ? `/admin/enheter?${queryString}` : '/admin/enheter')
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

      if (currentPage > 3) {
        pages.push('ellipsis')
      }

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }

      pages.push(totalPages)
    }

    return pages
  }

  async function handleUpdate(id: string, name: string, plural: string, abbreviation: string) {
    if (!name.trim() || !plural.trim()) {
      setError('Namn och plural kan inte vara tomma')
      return
    }

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/admin/units', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: name.trim(), plural: plural.trim(), abbreviation: abbreviation.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte uppdatera enhet')
      }

      setSuccess('Enhet uppdaterad')
      setEditingId(null)
      setEditName('')
      setEditPlural('')
      setEditAbbreviation('')
      await loadUnits()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    }
  }

  async function handleDelete() {
    if (!unitToDelete) return

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch(
        `/api/admin/units?id=${unitToDelete.id}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte ta bort enhet')
      }

      setSuccess('Enhet borttagen')
      setDeleteDialogOpen(false)
      setUnitToDelete(null)
      await loadUnits()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
      setDeleteDialogOpen(false)
      setUnitToDelete(null)
    }
  }

  async function handleAdd() {
    if (!newUnitName.trim() || !newUnitPlural.trim()) {
      setError('Namn och plural kan inte vara tomma')
      return
    }

    try {
      setError(null)
      setSuccess(null)
      setIsAdding(true)

      const response = await fetch('/api/admin/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUnitName.trim(),
          plural: newUnitPlural.trim(),
          abbreviation: newUnitAbbreviation.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte skapa enhet')
      }

      setSuccess('Enhet skapad')
      setNewUnitName('')
      setNewUnitPlural('')
      setNewUnitAbbreviation('')
      await loadUnits()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsAdding(false)
    }
  }

  async function handleShowRecipes(unit: Unit) {
    setRecipesDialogTitle(unit.name)
    setRecipesDialogOpen(true)
    setLoadingRecipes(true)
    setLinkedRecipes([])

    try {
      const { getLinkedRecipesByUnit } = await import('@/lib/admin-api')
      const recipes = await getLinkedRecipesByUnit(unit.id)
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

      const response = await fetch('/api/admin/units', {
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
        throw new Error(data.error || 'Kunde inte slå ihop enheter')
      }

      const targetName = units.find(u => u.id === mergeTargetId)?.name
      setSuccess(`"${mergeSource.name}" har slagits ihop med "${targetName}"`)
      setMergeDialogOpen(false)
      setMergeSource(null)
      setMergeTargetId('')
      setMergeSearch('')
      await loadUnits()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsMerging(false)
    }
  }

  function startEdit(unit: Unit) {
    setEditingId(unit.id)
    setEditName(unit.name)
    setEditPlural(unit.plural)
    setEditAbbreviation(unit.abbreviation)
    setError(null)
    setSuccess(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditPlural('')
    setEditAbbreviation('')
    setError(null)
  }

  function confirmDelete(unit: Unit) {
    setUnitToDelete(unit)
    setDeleteDialogOpen(true)
  }

  function startMerge(unit: Unit) {
    setMergeSource(unit)
    setMergeTargetId('')
    setMergeSearch('')
    setMergeDialogOpen(true)
  }

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Enheter
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {total} enheter för ingredienser
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

      {/* Add new unit */}
      <div className="rounded-2xl bg-card p-5 shadow-(--shadow-card)">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Ny enhet
        </p>
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Singular</label>
            <Input
              placeholder="t.ex. matsked"
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
              }}
              disabled={isAdding}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Plural</label>
            <Input
              placeholder="t.ex. matskedar"
              value={newUnitPlural}
              onChange={(e) => setNewUnitPlural(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
              }}
              disabled={isAdding}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Förkortn.</label>
            <Input
              placeholder="t.ex. msk"
              value={newUnitAbbreviation}
              onChange={(e) => setNewUnitAbbreviation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
              }}
              disabled={isAdding}
              className="w-24"
            />
          </div>
          <div className="self-end">
            <Button onClick={handleAdd} disabled={isAdding || !newUnitName.trim() || !newUnitPlural.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              {isAdding ? 'Skapar...' : 'Lägg till'}
            </Button>
          </div>
        </div>
      </div>

      {/* Units list */}
      <div className="overflow-hidden rounded-2xl bg-card shadow-(--shadow-card)">
        {/* List header with filter tabs and search */}
        <div className="border-b border-border/40 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Segmented filter */}
            <div className="inline-flex rounded-lg bg-muted/50 p-0.5">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveFilter(tab.value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                    activeFilter === tab.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="search"
                placeholder="Sök enheter..."
                defaultValue={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-8 w-52 rounded-lg border-0 bg-muted/50 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {filteredUnits.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? 'Inga enheter hittades'
                : activeFilter !== 'all'
                  ? 'Inga enheter matchar filtret'
                  : 'Inga enheter ännu'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filteredUnits.map((unit) => (
              <div
                key={unit.id}
                className="flex items-center px-5 py-3 transition-colors hover:bg-muted/30"
              >
                {editingId === unit.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      placeholder="Singular"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdate(unit.id, editName, editPlural, editAbbreviation)
                        } else if (e.key === 'Escape') {
                          cancelEdit()
                        }
                      }}
                      autoFocus
                      className="flex-1"
                    />
                    <Input
                      placeholder="Plural"
                      value={editPlural}
                      onChange={(e) => setEditPlural(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdate(unit.id, editName, editPlural, editAbbreviation)
                        } else if (e.key === 'Escape') {
                          cancelEdit()
                        }
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Förk."
                      value={editAbbreviation}
                      onChange={(e) => setEditAbbreviation(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdate(unit.id, editName, editPlural, editAbbreviation)
                        } else if (e.key === 'Escape') {
                          cancelEdit()
                        }
                      }}
                      className="w-20"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(unit.id, editName, editPlural, editAbbreviation)}
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
                      <div className="flex items-baseline gap-2">
                        <span className="text-[15px] font-medium">{unit.name}</span>
                        {unit.plural !== unit.name && (
                          <span className="text-xs text-muted-foreground/60">
                            pl. {unit.plural}
                          </span>
                        )}
                        {unit.abbreviation && (
                          <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {unit.abbreviation}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleShowRecipes(unit)}
                        className={cn(
                          'mt-0.5 text-xs',
                          unit.ingredient_count > 0
                            ? 'text-primary/70 hover:text-primary hover:underline'
                            : 'text-muted-foreground/60 cursor-default'
                        )}
                        disabled={unit.ingredient_count === 0}
                      >
                        {unit.ingredient_count}{' '}
                        {unit.ingredient_count === 1 ? 'ingrediens' : 'ingredienser'}
                      </button>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => startMerge(unit)}
                        className="rounded-lg p-2 text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-foreground"
                        aria-label="Slå ihop enhet"
                        title="Slå ihop med annan enhet"
                      >
                        <GitMerge className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => startEdit(unit)}
                        className="rounded-lg p-2 text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-foreground"
                        aria-label="Redigera enhet"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => confirmDelete(unit)}
                        className="rounded-lg p-2 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Ta bort enhet"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && activeFilter === 'all' && (
          <div className="border-t border-border/40 px-5 py-3">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      if (currentPage > 1) {
                        updateURL(currentPage - 1, searchQuery)
                      }
                    }}
                    className={
                      currentPage === 1
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
                          updateURL(pageNum, searchQuery)
                        }}
                        isActive={pageNum === currentPage}
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
                      if (currentPage < totalPages) {
                        updateURL(currentPage + 1, searchQuery)
                      }
                    }}
                    className={
                      currentPage === totalPages
                        ? 'pointer-events-none opacity-50'
                        : ''
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog (enhanced) */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort enhet</DialogTitle>
            <DialogDescription>
              Är du säker på att du vill ta bort enheten &quot;
              {unitToDelete?.name}&quot;?
              {unitToDelete && unitToDelete.ingredient_count > 0 && (
                <span className="mt-2 block font-semibold text-destructive">
                  Varning: {unitToDelete.ingredient_count}{' '}
                  {unitToDelete.ingredient_count === 1 ? 'ingrediens' : 'ingredienser'} kommer
                  att förlora sin enhet.
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
            <DialogTitle>Recept med enheten &quot;{recipesDialogTitle}&quot;</DialogTitle>
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
                  href={`/recept/${recipe.id}`}
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
            <DialogTitle>Slå ihop enhet</DialogTitle>
            <DialogDescription>
              Alla ingredienser med enheten &quot;{mergeSource?.name}&quot; kommer att uppdateras
              till den valda enheten. Sedan tas &quot;{mergeSource?.name}&quot; bort.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Sök målenhet..."
              value={mergeSearch}
              onChange={(e) => setMergeSearch(e.target.value)}
            />
            <div className="max-h-60 divide-y divide-border/40 overflow-y-auto rounded-lg border">
              {mergeTargetOptions.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Inga enheter hittades
                </p>
              ) : (
                mergeTargetOptions.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setMergeTargetId(u.id)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors',
                      mergeTargetId === u.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <span>
                      {u.name}
                      {u.abbreviation && (
                        <span className="ml-1.5 text-xs text-muted-foreground">({u.abbreviation})</span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      {u.ingredient_count} ingredienser
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

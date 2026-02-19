'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { UnitsPaginatedResponse } from '@/lib/admin-api'
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
import { Pencil, Trash2, Plus, AlertCircle } from '@/lib/icons'
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
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Debounce the URL update
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
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > 3) {
        pages.push('ellipsis')
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }

      // Always show last page
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
        headers: {
          'Content-Type': 'application/json',
        },
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
        {
          method: 'DELETE',
        }
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
        headers: {
          'Content-Type': 'application/json',
        },
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

  function formatUnitDisplay(unit: Unit): string {
    if (unit.abbreviation) {
      return `${unit.name} (${unit.abbreviation})`
    }
    return unit.name
  }

  return (
    <>
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Hantera enheter
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Skapa, redigera och ta bort enheter för ingredienser.
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
      <Card className="p-4">
        <h2 className="mb-4 text-lg font-semibold">Lägg till enhet</h2>
        <div className="flex gap-2">
          <Input
            placeholder="t.ex. matsked"
            value={newUnitName}
            onChange={(e) => setNewUnitName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAdd()
              }
            }}
            disabled={isAdding}
          />
          <Input
            placeholder="t.ex. matskedar"
            value={newUnitPlural}
            onChange={(e) => setNewUnitPlural(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAdd()
              }
            }}
            disabled={isAdding}
          />
          <Input
            placeholder="t.ex. msk"
            value={newUnitAbbreviation}
            onChange={(e) => setNewUnitAbbreviation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAdd()
              }
            }}
            disabled={isAdding}
          />
          <Button onClick={handleAdd} disabled={isAdding || !newUnitName.trim() || !newUnitPlural.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            {isAdding ? 'Skapar...' : 'Lägg till'}
          </Button>
        </div>
      </Card>

      {/* Search */}
      <Card className="p-4">
        <Input
          type="search"
          placeholder="Sök enheter..."
          defaultValue={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-md"
        />
      </Card>

      {/* Units list */}
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Enheter</h2>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'enhet' : 'enheter'}
          </p>
        </div>

        {units.length === 0 ? (
          <p className="text-center text-muted-foreground">
            {searchQuery ? 'Inga enheter hittades' : 'Inga enheter ännu'}
          </p>
        ) : (
          <div className="space-y-2">
            {units.map((unit) => (
              <div
                key={unit.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent/50"
              >
                {editingId === unit.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      placeholder="t.ex. matsked"
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
                      placeholder="t.ex. matskedar"
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
                      placeholder="t.ex. msk"
                      value={editAbbreviation}
                      onChange={(e) => setEditAbbreviation(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdate(unit.id, editName, editPlural, editAbbreviation)
                        } else if (e.key === 'Escape') {
                          cancelEdit()
                        }
                      }}
                      className="flex-1"
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
                    <div className="flex-1">
                      <span className="font-medium">{formatUnitDisplay(unit)}</span>
                      {unit.plural !== unit.name && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          (plural: {unit.plural})
                        </span>
                      )}
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({unit.ingredient_count}{' '}
                        {unit.ingredient_count === 1 ? 'ingrediens' : 'ingredienser'})
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(unit)}
                        aria-label="Redigera enhet"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => confirmDelete(unit)}
                        aria-label="Ta bort enhet"
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
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort enhet</DialogTitle>
            <DialogDescription>
              Är du säker på att du vill ta bort enheten &quot;
              {unitToDelete?.name}&quot;?
              {unitToDelete && unitToDelete.ingredient_count > 0 && (
                <span className="mt-2 block font-semibold text-destructive">
                  Varning: Denna enhet används av {unitToDelete.ingredient_count}{' '}
                  {unitToDelete.ingredient_count === 1 ? 'ingrediens' : 'ingredienser'}.
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

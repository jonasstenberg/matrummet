import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter, Link } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, ChevronUp, ChevronDown } from '@/lib/icons'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import type { AdminRecipe, RecipeSortField, SortDir, RecipesPaginatedResponse } from '@/lib/admin-api'

interface ReceptClientProps {
  initialData: RecipesPaginatedResponse
  page: number
  search: string
  sortBy: RecipeSortField
  sortDir: SortDir
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sv-SE')
}

export function ReceptClient({
  initialData,
  page,
  search,
  sortBy,
  sortDir,
}: ReceptClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [recipes, setRecipes] = useState<AdminRecipe[]>(initialData.items)
  const [total, setTotal] = useState(initialData.total)
  const [totalPages, setTotalPages] = useState(initialData.totalPages)

  useEffect(() => {
    setRecipes(initialData.items)
    setTotal(initialData.total)
    setTotalPages(initialData.totalPages)
  }, [initialData])

  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  function navigate(overrides: {
    page?: number
    search?: string
    sort?: RecipeSortField
    dir?: SortDir
  }) {
    const p = overrides.page ?? page
    const s = overrides.search ?? search
    const sort = overrides.sort ?? sortBy
    const dir = overrides.dir ?? sortDir

    startTransition(() => {
      router.navigate({
        to: '/admin/recept',
        search: {
          page: p > 1 ? p : undefined,
          search: s || undefined,
          sortBy: sort !== 'date_published' || dir !== 'desc' ? sort : undefined,
          sortDir: sort !== 'date_published' || dir !== 'desc' ? dir : undefined,
        },
        replace: true,
      })
    })
  }

  function handleSearchChange(value: string) {
    clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      navigate({ page: 1, search: value })
    }, 300)
  }

  function handleSort(field: RecipeSortField) {
    if (sortBy === field) {
      navigate({ page: 1, sort: field, dir: sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      navigate({ page: 1, sort: field, dir: 'asc' })
    }
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

  function SortableHeader({ field, children, className }: { field: RecipeSortField; children: React.ReactNode; className?: string }) {
    const active = sortBy === field
    return (
      <TableHead className={className}>
        <button
          onClick={() => handleSort(field)}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          {children}
          {active ? (
            sortDir === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-30" />
          )}
        </button>
      </TableHead>
    )
  }

  return (
    <>
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Recept
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Översikt över alla recept från alla användare.
        </p>
      </header>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Sök recept..."
            defaultValue={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {/* Recipes list */}
      <Card>
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Recept</h2>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'recept' : 'recept'}
          </p>
        </div>

        {isPending ? (
          <div className="p-4">
            {/* Desktop skeleton */}
            <div className="hidden space-y-3 md:block">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
            {/* Mobile skeleton */}
            <div className="space-y-3 md:hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <Skeleton className="mb-2 h-5 w-40" />
                  <Skeleton className="mb-2 h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        ) : recipes.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">
            {search ? 'Inga recept hittades' : 'Inga recept finns ännu'}
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="name">Namn</SortableHeader>
                    <SortableHeader field="owner">Ägare</SortableHeader>
                    <SortableHeader field="date_published">Publicerad</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipes.map((recipe) => (
                    <TableRow key={recipe.id}>
                      <TableCell>
                        <Link
                          to="/admin/recept/$id"
                          params={{ id: recipe.id }}
                          className="font-medium text-foreground hover:underline"
                        >
                          {recipe.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{recipe.owner_name || recipe.owner}</p>
                          {recipe.owner_name && (
                            <p className="text-xs text-muted-foreground">{recipe.owner}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">
                        {formatDate(recipe.date_published)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 p-4 md:hidden">
              {recipes.map((recipe) => (
                <Link
                  key={recipe.id}
                  to="/admin/recept/$id"
                  params={{ id: recipe.id }}
                  className="block rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{recipe.name}</span>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {recipe.owner_name || recipe.owner}
                    </p>
                    <div className="mt-1.5 flex gap-4 text-sm text-muted-foreground">
                      <span>{formatDate(recipe.date_published)}</span>
                      <span>{recipe.ingredient_count} ingredienser</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-border p-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (page > 1) navigate({ page: page - 1 })
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
                              navigate({ page: pageNum })
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
                          if (page < totalPages) navigate({ page: page + 1 })
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
    </>
  )
}

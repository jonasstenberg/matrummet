'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import type { PantryItem } from '@/lib/ingredient-search-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface PantryTableProps {
  items: PantryItem[]
  selectedIds: Set<string>
  onSelectionChange: (selectedIds: Set<string>) => void
  onRemoveItem: (foodId: string) => void
  showSelection?: boolean
}

function formatDate(dateString: string | null): string {
  if (!dateString) return ''

  const date = new Date(dateString)
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

const columnHelper = createColumnHelper<PantryItem>()

export function PantryTable({
  items,
  selectedIds,
  onSelectionChange,
  onRemoveItem,
  showSelection = true,
}: PantryTableProps) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const columns = useMemo(
    () => [
      // Conditionally include selection column
      ...(showSelection
        ? [
            columnHelper.display({
              id: 'select',
              header: ({ table }) => {
                const allRowsSelected = table.getRowModel().rows.every((row) =>
                  selectedIds.has(row.original.food_id)
                )
                const someRowsSelected =
                  table.getRowModel().rows.some((row) =>
                    selectedIds.has(row.original.food_id)
                  ) && !allRowsSelected

                return (
                  <Checkbox
                    checked={allRowsSelected}
                    data-state={someRowsSelected ? 'indeterminate' : undefined}
                    onCheckedChange={(checked) => {
                      const newSelectedIds = new Set(selectedIds)
                      if (checked) {
                        table.getRowModel().rows.forEach((row) => {
                          newSelectedIds.add(row.original.food_id)
                        })
                      } else {
                        table.getRowModel().rows.forEach((row) => {
                          newSelectedIds.delete(row.original.food_id)
                        })
                      }
                      onSelectionChange(newSelectedIds)
                    }}
                    aria-label="Markera alla"
                  />
                )
              },
              cell: ({ row }) => (
                <Checkbox
                  checked={selectedIds.has(row.original.food_id)}
                  onCheckedChange={(checked) => {
                    const newSelectedIds = new Set(selectedIds)
                    if (checked) {
                      newSelectedIds.add(row.original.food_id)
                    } else {
                      newSelectedIds.delete(row.original.food_id)
                    }
                    onSelectionChange(newSelectedIds)
                  }}
                  aria-label={`Markera ${row.original.food_name}`}
                />
              ),
            }),
          ]
        : []),
      columnHelper.accessor('food_name', {
        header: 'Ingrediens',
        cell: (info) => (
          <span className="font-medium">{info.getValue()}</span>
        ),
        filterFn: 'includesString',
      }),
      columnHelper.accessor('added_at', {
        header: 'Tillagd',
        cell: (info) => (
          <span className="text-muted-foreground">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemoveItem(row.original.food_id)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Ta bort ${row.original.food_name}`}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only md:not-sr-only md:ml-2">Ta bort</span>
          </Button>
        ),
      }),
    ],
    [selectedIds, onSelectionChange, onRemoveItem, showSelection]
  )

  // eslint-disable-next-line -- @tanstack/react-table patterns trigger react-compiler warnings
  const table = useReactTable({
    data: items,
    columns,
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  const filterValue =
    (table.getColumn('food_name')?.getFilterValue() as string) ?? ''

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filtrera ingredienser..."
          value={filterValue}
          onChange={(e) =>
            table.getColumn('food_name')?.setFilterValue(e.target.value)
          }
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={
                    selectedIds.has(row.original.food_id) ? 'selected' : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {items.length === 0
                    ? 'Ditt skafferi är tomt.'
                    : 'Inga ingredienser matchar filtret.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Visar {table.getState().pagination.pageIndex * 10 + 1}-
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * 10,
              table.getFilteredRowModel().rows.length
            )}{' '}
            av {table.getFilteredRowModel().rows.length} ingredienser
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only md:not-sr-only md:ml-1">Föregående</span>
            </Button>
            <span className="text-sm text-muted-foreground">
              Sida {table.getState().pagination.pageIndex + 1} av{' '}
              {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only md:not-sr-only md:mr-1">Nästa</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Selection summary */}
      {showSelection && selectedIds.size > 0 && (
        <p className="text-sm text-muted-foreground">
          {selectedIds.size} ingrediens{selectedIds.size !== 1 ? 'er' : ''} vald
          {selectedIds.size !== 1 ? 'a' : ''} för sökning
        </p>
      )}
    </div>
  )
}

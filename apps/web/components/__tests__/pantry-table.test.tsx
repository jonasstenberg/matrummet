/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PantryTable } from '../my-pantry/pantry-table'
import type { PantryItem } from '@/lib/ingredient-search-types'

const items: PantryItem[] = Array.from({ length: 12 }, (_, index) => ({
  id: `item-${index}`,
  food_id: `food-${index}`,
  food_name: index === 11 ? 'Tomat' : `Ingrediens ${index + 1}`,
  quantity: null,
  unit: null,
  added_at: '2026-01-01',
  expires_at: null,
}))

function renderTable() {
  const onSelectionChange = vi.fn()
  const onRemoveItem = vi.fn()
  render(<PantryTable items={items} selectedIds={new Set()} onSelectionChange={onSelectionChange} onRemoveItem={onRemoveItem} />)
  return { onSelectionChange, onRemoveItem }
}

describe('PantryTable', () => {
  it('paginates and resets the page when filtering', async () => {
    renderTable()
    expect(screen.getByText('Sida 1 av 2')).toBeInTheDocument()
    expect(screen.queryByText('Tomat')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nästa' }))
    expect(screen.getByText('Sida 2 av 2')).toBeInTheDocument()
    expect(screen.getByText('Tomat')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Filtrera ingredienser...'), { target: { value: 'ingrediens 1' } })
    await waitFor(() => expect(screen.getByText('Ingrediens 1')).toBeInTheDocument())
    expect(screen.getByText('Ingrediens 10')).toBeInTheDocument()
    expect(screen.queryByText('Tomat')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nästa' })).not.toBeInTheDocument()
  })

  it('selects only the visible page and removes the requested ingredient', () => {
    const { onSelectionChange, onRemoveItem } = renderTable()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Markera alla' }))
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(items.slice(0, 10).map(item => item.food_id)))
    fireEvent.click(screen.getByRole('button', { name: 'Nästa' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Markera alla' }))
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(items.slice(10).map(item => item.food_id)))
    fireEvent.click(screen.getByRole('button', { name: 'Ta bort Tomat' }))
    expect(onRemoveItem).toHaveBeenCalledWith('food-11')
  })
})

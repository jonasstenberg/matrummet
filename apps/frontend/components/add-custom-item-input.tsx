'use client'

import { useState, useCallback, useRef, useEffect, useTransition } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addCustomShoppingListItem } from '@/lib/actions'
import { searchFoodsWithIds } from '@/lib/ingredient-search-actions'
import type { ShoppingListItem } from '@/lib/types'

interface FoodSuggestion {
  id: string
  name: string
}

interface AddCustomItemInputProps {
  listId?: string
  onItemAdded: (item: ShoppingListItem) => void
}

export function AddCustomItemInput({ listId, onItemAdded }: AddCustomItemInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [showDropdown, setShowDropdown] = useState(false)
  const [, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([])
      setIsLoadingSuggestions(false)
      return
    }

    setIsLoadingSuggestions(true)
    try {
      const results = await searchFoodsWithIds(query, 6)
      setSuggestions(results)
    } catch {
      setSuggestions([])
    } finally {
      setIsLoadingSuggestions(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)

    if (!inputValue) {
      setSuggestions([])
      setIsLoadingSuggestions(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(inputValue)
    }, 200)

    return () => clearTimeout(debounceRef.current)
  }, [inputValue, fetchSuggestions])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function addItem(name: string, foodId?: string) {
    const trimmed = name.trim()
    if (!trimmed) return

    const optimisticItem: ShoppingListItem = {
      id: crypto.randomUUID(),
      shopping_list_id: listId || '',
      food_id: foodId || null,
      unit_id: null,
      display_name: trimmed,
      display_unit: '',
      quantity: 1,
      is_checked: false,
      checked_at: null,
      sort_order: 999999,
      item_name: trimmed,
      unit_name: '',
      list_name: '',
      source_recipes: null,
      date_published: new Date().toISOString(),
    }

    onItemAdded(optimisticItem)
    setInputValue('')
    setSuggestions([])
    setShowDropdown(false)
    setHighlightedIndex(-1)
    inputRef.current?.focus()

    startTransition(async () => {
      await addCustomShoppingListItem(trimmed, listId, foodId)
    })
  }

  function handleSelectSuggestion(suggestion: FoodSuggestion) {
    addItem(suggestion.name, suggestion.id)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      handleSelectSuggestion(suggestions[highlightedIndex])
    } else {
      addItem(inputValue)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case 'Escape':
        setShowDropdown(false)
        setHighlightedIndex(-1)
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Plus className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setShowDropdown(true)
              setHighlightedIndex(-1)
            }}
            onFocus={() => inputValue && setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder="Lägg till vara..."
            autoComplete="off"
            className="w-full bg-transparent py-1 pl-6 text-[15px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
          {isLoadingSuggestions && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
            </div>
          )}
        </div>
      </form>

      {showDropdown && inputValue && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border/50 bg-card shadow-md">
          <ul role="listbox" className="py-1">
            {suggestions.map((item, index) => (
              <li
                key={item.id}
                role="option"
                aria-selected={index === highlightedIndex}
                className={cn(
                  'relative cursor-pointer py-2.5 pl-10 pr-4 text-[15px]',
                  index === highlightedIndex ? 'bg-primary/10' : 'hover:bg-muted/50'
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelectSuggestion(item)
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <Plus className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                {item.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

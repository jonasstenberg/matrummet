'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Loader2, Search, Plus, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { SelectedIngredient, PantryItem, CommonPantryItem } from '@/lib/ingredient-search-types'
import { searchFoodsWithIds } from '@/lib/ingredient-search-actions'

interface FoodSuggestion {
  id: string
  name: string
}

interface IngredientSearchProps {
  pantryItems: PantryItem[]
  commonPantryItems?: CommonPantryItem[]
  onIngredientAdd: (ingredient: SelectedIngredient) => void
  isLoading: boolean
}

type CategoryKey = 'basic' | 'seasoning' | 'herb' | 'spice'

const categoryLabels: Record<CategoryKey, string> = {
  basic: 'Basvaror',
  seasoning: 'Smaksättare',
  herb: 'Örter',
  spice: 'Kryddor',
}

const categoryOrder: CategoryKey[] = ['basic', 'seasoning', 'herb', 'spice']

export function IngredientSearch({
  pantryItems,
  commonPantryItems = [],
  onIngredientAdd,
  isLoading,
}: IngredientSearchProps) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('basic')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const existingFoodIds = useMemo(
    () => new Set(pantryItems.map((item) => item.food_id)),
    [pantryItems]
  )

  // Group common items by category
  const commonByCategory = useMemo(() => {
    const grouped: Record<CategoryKey, CommonPantryItem[]> = {
      basic: [],
      seasoning: [],
      herb: [],
      spice: [],
    }
    commonPantryItems.forEach((item) => {
      if (grouped[item.category]) {
        grouped[item.category].push(item)
      }
    })
    return grouped
  }, [commonPantryItems])

  // Get available categories
  const availableCategories = useMemo(
    () => categoryOrder.filter((cat) => commonByCategory[cat].length > 0),
    [commonByCategory]
  )

  // Filter pantry items based on search
  const matchingPantryItems = useMemo(() => {
    if (!inputValue) return []
    const lowerInput = inputValue.toLowerCase()
    return pantryItems
      .filter((item) => item.food_name.toLowerCase().includes(lowerInput))
      .slice(0, 5)
  }, [pantryItems, inputValue])

  // Filter suggestions to exclude items already in pantry
  const addSuggestions = useMemo(
    () => suggestions.filter((s) => !existingFoodIds.has(s.id)).slice(0, 5),
    [suggestions, existingFoodIds]
  )

  // Combined list for keyboard navigation
  const allItems = useMemo(() => {
    const items: Array<{ type: 'pantry' | 'add'; id: string; name: string }> = []
    matchingPantryItems.forEach((item) =>
      items.push({ type: 'pantry', id: item.food_id, name: item.food_name })
    )
    addSuggestions.forEach((item) =>
      items.push({ type: 'add', id: item.id, name: item.name })
    )
    return items
  }, [matchingPantryItems, addSuggestions])

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSuggestions([])
      setIsLoadingSuggestions(false)
      return
    }

    setIsLoadingSuggestions(true)

    try {
      const results = await searchFoodsWithIds(query, 10)
      setSuggestions(results)
    } catch (error) {
      console.error('Error fetching suggestions:', error)
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

  const handleAddItem = useCallback(
    (item: FoodSuggestion) => {
      if (existingFoodIds.has(item.id)) return
      onIngredientAdd({ id: item.id, name: item.name })
      setInputValue('')
      setShowDropdown(false)
      setHighlightedIndex(-1)
      inputRef.current?.focus()
    },
    [existingFoodIds, onIngredientAdd]
  )

  const handlePantryItemClick = useCallback(() => {
    // Just clear search when clicking existing pantry item
    setInputValue('')
    setShowDropdown(false)
    setHighlightedIndex(-1)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || allItems.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        if (highlightedIndex >= 0 && allItems[highlightedIndex]) {
          e.preventDefault()
          const item = allItems[highlightedIndex]
          if (item.type === 'add') {
            handleAddItem({ id: item.id, name: item.name })
          } else {
            handlePantryItemClick()
          }
        }
        break
      case 'Escape':
        setShowDropdown(false)
        setHighlightedIndex(-1)
        break
    }
  }

  const hasResults = matchingPantryItems.length > 0 || addSuggestions.length > 0

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setShowDropdown(true)
            setHighlightedIndex(-1)
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder="Lägg till ingrediens..."
          className="bg-white pl-10 pr-10"
          autoComplete="off"
          disabled={isLoading}
        />
        {isLoadingSuggestions && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Search results dropdown */}
      {showDropdown && inputValue && hasResults && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg">
          {/* Matching items in pantry */}
          {matchingPantryItems.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                I skafferiet
              </div>
              <ul role="listbox">
                {matchingPantryItems.map((item, index) => (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={index === highlightedIndex}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                      index === highlightedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handlePantryItemClick()
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <Check className="h-3.5 w-3.5 text-primary" />
                    {item.food_name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions to add */}
          {addSuggestions.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                Lägg till
              </div>
              <ul role="listbox">
                {addSuggestions.map((item, index) => {
                  const globalIndex = matchingPantryItems.length + index
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={globalIndex === highlightedIndex}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                        globalIndex === highlightedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleAddItem(item)
                      }}
                      onMouseEnter={() => setHighlightedIndex(globalIndex)}
                    >
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      {item.name}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Common ingredients dropdown (when focused but no search) */}
      {showDropdown && !inputValue && availableCategories.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg">
          {/* Category tabs */}
          <div className="flex border-b bg-muted/30">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={cn(
                  'flex-1 px-3 py-2 text-xs font-medium transition-colors',
                  activeCategory === cat
                    ? 'bg-white text-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setActiveCategory(cat)
                }}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>

          {/* Items in active category */}
          <div className="max-h-48 overflow-y-auto p-2">
            <div className="flex flex-wrap gap-1.5">
              {commonByCategory[activeCategory].map((item) => {
                const isInPantry = existingFoodIds.has(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      isInPantry
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-primary hover:text-primary-foreground'
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      if (!isInPantry) {
                        handleAddItem({ id: item.id, name: item.name })
                      }
                    }}
                  >
                    {isInPantry ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {item.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

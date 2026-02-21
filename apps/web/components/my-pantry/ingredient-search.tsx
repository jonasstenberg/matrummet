
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Loader2, Plus, Check, CalendarDays } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { SelectedIngredient } from '@/lib/ingredient-search-types'
import { searchFoodsWithIds } from '@/lib/ingredient-search-actions'

interface FoodSuggestion {
  id: string
  name: string
}

interface IngredientSearchProps {
  existingFoodIds: Set<string>
  onIngredientAdd: (ingredient: SelectedIngredient, expiresAt?: string) => void
  isLoading: boolean
}

export function IngredientSearch({
  existingFoodIds,
  onIngredientAdd,
  isLoading,
}: IngredientSearchProps) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [showDropdown, setShowDropdown] = useState(false)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const addSuggestions = useMemo(
    () => suggestions.filter((s) => !existingFoodIds.has(s.id)).slice(0, 6),
    [suggestions, existingFoodIds]
  )

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
        setExpandedItemId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAddItem = useCallback(
    (item: FoodSuggestion, expiresAt?: string) => {
      if (existingFoodIds.has(item.id)) return
      onIngredientAdd({ id: item.id, name: item.name }, expiresAt)
      setInputValue('')
      setShowDropdown(false)
      setHighlightedIndex(-1)
      setExpandedItemId(null)
      inputRef.current?.focus()
    },
    [existingFoodIds, onIngredientAdd]
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || addSuggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < addSuggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        if (highlightedIndex >= 0 && addSuggestions[highlightedIndex]) {
          e.preventDefault()
          handleAddItem(addSuggestions[highlightedIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        setHighlightedIndex(-1)
        setExpandedItemId(null)
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
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
            setExpandedItemId(null)
          }}
          onFocus={() => inputValue && setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder="Lägg till ingrediens..."
          autoComplete="off"
          disabled={isLoading}
          className="w-full bg-transparent py-1 pl-6 text-[15px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />
        {isLoadingSuggestions && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
          </div>
        )}
      </div>

      {showDropdown && inputValue && addSuggestions.length > 0 && (
        <div className="absolute bottom-full z-50 mb-1 w-full overflow-hidden rounded-lg border border-border/50 bg-card shadow-md">
          <ul role="listbox" className="py-1">
            {addSuggestions.map((item, index) => {
              const isExpanded = expandedItemId === item.id

              return (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  className={cn(
                    'cursor-pointer',
                    !isExpanded && (index === highlightedIndex ? 'bg-primary/10' : 'hover:bg-muted/50')
                  )}
                >
                  {/* Main row */}
                  <div className="relative flex items-center pr-1">
                    <span
                      className="flex-1 py-2.5 pl-10 pr-2 text-[15px]"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleAddItem(item)
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      {existingFoodIds.has(item.id) ? (
                        <Check className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                      ) : (
                        <Plus className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                      )}
                      {item.name}
                    </span>
                    <button
                      type="button"
                      className={cn(
                        'shrink-0 rounded-full p-2 transition-colors',
                        isExpanded
                          ? 'text-primary bg-primary/10'
                          : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50'
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setExpandedItemId(isExpanded ? null : item.id)
                      }}
                      aria-label={`Sätt utgångsdatum för ${item.name}`}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Expanded date picker row */}
                  {isExpanded && (
                    <div className="flex items-center gap-2 px-4 pb-2.5 pt-0.5">
                      <input
                        type="date"
                        autoFocus
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddItem(item, e.target.value)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.stopPropagation()
                            setExpandedItemId(null)
                          }
                        }}
                        className="flex-1 rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleAddItem(item)
                        }}
                        className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                      >
                        Utan datum
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

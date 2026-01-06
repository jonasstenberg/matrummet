'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { SelectedIngredient } from '@/lib/ingredient-search-types'
import { searchFoodsWithIds } from '@/lib/ingredient-search-actions'

interface FoodSuggestion {
  id: string
  name: string
}

interface IngredientSearchProps {
  selectedIngredients: SelectedIngredient[]
  onIngredientsChange: (ingredients: SelectedIngredient[]) => void
  onIngredientAdd: (ingredient: SelectedIngredient) => void
  isLoading: boolean
}

export function IngredientSearch({
  selectedIngredients,
  onIngredientsChange,
  onIngredientAdd,
  isLoading,
}: IngredientSearchProps) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [showSuggestions, setShowSuggestions] = useState(false)
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
      const results = await searchFoodsWithIds(query, 8)
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
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback(
    (suggestion: FoodSuggestion) => {
      // Prevent duplicates
      if (selectedIngredients.some((i) => i.id === suggestion.id)) {
        setInputValue('')
        setShowSuggestions(false)
        return
      }

      const ingredient = { id: suggestion.id, name: suggestion.name }
      const newIngredients = [...selectedIngredients, ingredient]
      onIngredientsChange(newIngredients)
      // Also save to pantry
      onIngredientAdd(ingredient)
      setInputValue('')
      setShowSuggestions(false)
      setHighlightedIndex(-1)
      inputRef.current?.focus()
    },
    [selectedIngredients, onIngredientsChange, onIngredientAdd]
  )

  const handleRemove = useCallback(
    (id: string) => {
      const newIngredients = selectedIngredients.filter((i) => i.id !== id)
      onIngredientsChange(newIngredients)
    },
    [selectedIngredients, onIngredientsChange]
  )

  const handleClearAll = useCallback(() => {
    onIngredientsChange([])
    setInputValue('')
    inputRef.current?.focus()
  }, [onIngredientsChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          e.preventDefault()
          handleSelect(suggestions[highlightedIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setHighlightedIndex(-1)
        break
    }
  }

  const filteredSuggestions = suggestions.filter(
    (s) => !selectedIngredients.some((i) => i.id === s.id)
  )

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setShowSuggestions(true)
              setHighlightedIndex(-1)
            }}
            onFocus={() => inputValue && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Sök ingrediens..."
            className="pr-10"
            autoComplete="off"
            disabled={isLoading}
          />
          {isLoadingSuggestions && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white py-1 shadow-lg"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <li
                key={suggestion.id}
                role="option"
                aria-selected={index === highlightedIndex}
                className={cn(
                  'cursor-pointer px-3 py-2 text-sm',
                  index === highlightedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(suggestion)
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {suggestion.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Selected ingredients chips */}
      {selectedIngredients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIngredients.map((ingredient) => (
            <span
              key={ingredient.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
            >
              {ingredient.name}
              <button
                type="button"
                onClick={() => handleRemove(ingredient.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                aria-label={`Ta bort ${ingredient.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {selectedIngredients.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="ghost" onClick={handleClearAll} disabled={isLoading}>
            Rensa alla
          </Button>
        </div>
      )}
    </div>
  )
}

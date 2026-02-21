
import * as React from 'react'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface AutocompleteOption {
  display: string
  value: string
}

interface AsyncAutocompleteInputProps extends Omit<React.ComponentProps<'input'>, 'onChange'> {
  fetchUrl: string
  value: string
  onChange: (value: string) => void
  maxSuggestions?: number
  debounceMs?: number
}

export function AsyncAutocompleteInput({
  fetchUrl,
  value,
  onChange,
  maxSuggestions = 8,
  debounceMs = 200,
  className,
  ...props
}: AsyncAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [suggestions, setSuggestions] = useState<AutocompleteOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const showSuggestions = isOpen && suggestions.length > 0

  // Store fetchUrl and maxSuggestions in refs to avoid dependency changes
  const fetchUrlRef = useRef(fetchUrl)
  const maxSuggestionsRef = useRef(maxSuggestions)
  fetchUrlRef.current = fetchUrl
  maxSuggestionsRef.current = maxSuggestions

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!query || query.length < 1) {
        setSuggestions([])
        setIsLoading(false)
        return
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController()

      setIsLoading(true)

      try {
        const url = `${fetchUrlRef.current}?q=${encodeURIComponent(query)}&limit=${maxSuggestionsRef.current}`
        const response = await fetch(url, {
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to fetch suggestions')
        }

        const data: AutocompleteOption[] = await response.json()
        setSuggestions(data)
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error fetching suggestions:', error)
          setSuggestions([])
        }
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // Debounced fetch effect
  useEffect(() => {
    clearTimeout(debounceTimeoutRef.current)

    if (!value) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    debounceTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(value)
    }, debounceMs)

    return () => {
      clearTimeout(debounceTimeoutRef.current)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [value, fetchSuggestions, debounceMs])

  const handleSelect = useCallback(
    (option: AutocompleteOption) => {
      onChange(option.value)
      setIsOpen(false)
      setHighlightedIndex(-1)
      inputRef.current?.focus()
    },
    [onChange]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        if (highlightedIndex >= 0) {
          e.preventDefault()
          handleSelect(suggestions[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
      case 'Tab':
        if (highlightedIndex >= 0) {
          handleSelect(suggestions[highlightedIndex])
        }
        setIsOpen(false)
        break
    }
  }

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => value && setIsOpen(true)}
          className={className}
          autoComplete="off"
          {...props}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        )}
      </div>
      {showSuggestions && (
        <ul
          role="listbox"
          tabIndex={0}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white py-1 shadow-lg"
        >
          {suggestions.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={index === highlightedIndex}
              className={cn(
                'cursor-pointer px-3 py-2 text-sm',
                index === highlightedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted'
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(option)
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {option.display}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

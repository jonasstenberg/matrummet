'use client'

import * as React from 'react'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface AutocompleteInputProps extends Omit<React.ComponentProps<'input'>, 'onChange'> {
  suggestions: string[]
  value: string
  onChange: (value: string) => void
  maxSuggestions?: number
}

export function AutocompleteInput({
  suggestions,
  value,
  onChange,
  maxSuggestions = 8,
  className,
  ...props
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredSuggestions = React.useMemo(() => {
    if (!value || value.length < 1) return []
    const search = value.toLowerCase()
    return suggestions
      .filter((s) => s.toLowerCase().includes(search))
      .slice(0, maxSuggestions)
  }, [suggestions, value, maxSuggestions])

  const showSuggestions = isOpen && filteredSuggestions.length > 0

  const handleSelect = useCallback(
    (suggestion: string) => {
      onChange(suggestion)
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
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        if (highlightedIndex >= 0) {
          e.preventDefault()
          handleSelect(filteredSuggestions[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
      case 'Tab':
        if (highlightedIndex >= 0) {
          handleSelect(filteredSuggestions[highlightedIndex])
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
      {showSuggestions && (
        <ul
          role="listbox"
          tabIndex={0}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white py-1 shadow-lg"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={suggestion}
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
                handleSelect(suggestion)
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

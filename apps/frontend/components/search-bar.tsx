'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  className?: string
}

export function SearchBar({ className }: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if we're on /alla-recept to scope the search
  const isAllRecipesPage = pathname.startsWith('/alla-recept')

  // URL is the source of truth
  const urlQuery = searchParams.get('q') || ''

  // Local state for responsive typing
  const [inputValue, setInputValue] = useState(urlQuery)
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery)
  const [isFocused, setIsFocused] = useState(false)

  // Sync from URL when it changes externally (browser back/forward)
  // Only sync if input is not focused (user isn't typing)
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery)
    if (!isFocused) {
      setInputValue(urlQuery)
    }
  }

  function getSearchUrl(term: string) {
    // When on /alla-recept, search should stay within that scope
    if (isAllRecipesPage) {
      return `/alla-recept/sok?q=${encodeURIComponent(term)}`
    }
    return `/sok?q=${encodeURIComponent(term)}`
  }

  function getEmptyUrl() {
    // When on /alla-recept, clear should go back to /alla-recept
    return isAllRecipesPage ? '/alla-recept' : '/'
  }

  function handleSearch(term: string) {
    // Update local state immediately for responsive UI
    setInputValue(term)

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce the navigation
    debounceTimerRef.current = setTimeout(() => {
      startTransition(() => {
        if (term.trim()) {
          router.push(getSearchUrl(term.trim()))
        } else {
          // Empty search - go to appropriate page
          router.push(getEmptyUrl())
        }
      })
    }, 300)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Clear debounce timer for immediate navigation
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    const input = e.currentTarget.elements.namedItem('search') as HTMLInputElement
    const term = input.value.trim()

    startTransition(() => {
      if (term) {
        router.push(getSearchUrl(term))
      } else {
        router.push(getEmptyUrl())
      }
    })
  }

  function handleClear() {
    // Clear local state immediately
    setInputValue('')

    // Clear debounce timer for immediate navigation
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    startTransition(() => {
      router.push(getEmptyUrl())
    })
  }

  return (
    <form onSubmit={handleSubmit} className={cn('relative w-full max-w-md group', className)}>
      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70 transition-colors group-focus-within:text-primary" />
      <input
        type="search"
        name="search"
        placeholder="Sök recept..."
        value={inputValue}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoComplete="off"
        className={cn(
          'flex h-10 w-full rounded-full bg-white pl-10 pr-10 text-sm transition-all duration-200',
          'border border-border/80 shadow-sm',
          'placeholder:text-muted-foreground',
          'hover:border-border hover:shadow',
          'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          isPending && 'opacity-70'
        )}
      />
      {inputValue && (
        <button
          type="button"
          onClick={handleClear}
          disabled={isPending}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Rensa sökning</span>
        </button>
      )}
    </form>
  )
}

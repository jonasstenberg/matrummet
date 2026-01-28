'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRecentSearches } from '@/lib/hooks/use-recent-searches'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'

interface SearchBarProps {
  className?: string
}

export function SearchBar({ className }: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const { searches, addSearch, removeSearch, clearAll } = useRecentSearches()

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

    // Save to recent searches
    if (term) {
      addSearch(term)
    }

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

  // Show recent searches when focused, empty, and have searches
  const showRecent = isFocused && inputValue === '' && searches.length > 0

  return (
    <Popover open={showRecent}>
      <PopoverAnchor asChild>
        <form onSubmit={handleSubmit} className={cn('relative w-full max-w-md group', className)}>
          <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/70 transition-colors group-focus-within:text-primary" />
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
              'flex h-12 w-full rounded-full bg-muted/50 pl-10 pr-10 text-base transition-all duration-200',
              'border border-transparent',
              'placeholder:text-muted-foreground',
              'hover:border-border/50',
              'focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20',
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
      </PopoverAnchor>
      <PopoverContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[--radix-popover-trigger-width] p-2"
        align="start"
        sideOffset={4}
      >
        <div className="space-y-1">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Senaste sökningar
          </div>
          {searches.map((term) => (
            <div key={term} className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-muted">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault() // prevent blur on input
                  setInputValue(term)
                  // Navigate to search
                  startTransition(() => {
                    router.push(getSearchUrl(term))
                  })
                  addSearch(term) // move to top of recent
                }}
                className="flex flex-1 items-center gap-2 text-left text-sm"
              >
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {term}
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault() // prevent blur on input
                  removeSearch(term)
                }}
                className="rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-background"
                aria-label={`Ta bort "${term}"`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                clearAll()
              }}
              className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Rensa alla
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

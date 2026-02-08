import { useState, useCallback } from 'react'

const STORAGE_KEY = 'matrummet-recent-searches'
const MAX_SEARCHES = 5

function getInitialSearches(): string[] {
  // Only access localStorage on client-side to avoid hydration mismatch
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    // Silent fail - storage unavailable or corrupted
    return []
  }
}

export function useRecentSearches() {
  const [searches, setSearches] = useState<string[]>(getInitialSearches)

  const addSearch = useCallback((term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return

    try {
      setSearches((prev) => {
        // Remove case-insensitive duplicates
        const filtered = prev.filter(
          (s) => s.toLowerCase() !== trimmed.toLowerCase()
        )
        // Prepend new term and limit to MAX_SEARCHES
        const updated = [trimmed, ...filtered].slice(0, MAX_SEARCHES)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        return updated
      })
    } catch {
      // Silent fail - storage unavailable
    }
  }, [])

  const removeSearch = useCallback((term: string) => {
    try {
      setSearches((prev) => {
        const updated = prev.filter((s) => s !== term)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        return updated
      })
    } catch {
      // Silent fail - storage unavailable
    }
  }, [])

  const clearAll = useCallback(() => {
    try {
      setSearches([])
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Silent fail - storage unavailable
    }
  }, [])

  return { searches, addSearch, removeSearch, clearAll }
}

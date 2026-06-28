import type { Recipe } from '@/lib/types'

export interface RecipeFilterState {
  /** Categories selected in the URL (OR-matched). */
  activeCategories: string[]
  /** Whether the pantry ("skafferi") match filter is on. */
  isFilterActive: boolean
  /** Minimum pantry match percentage when the pantry filter is on. */
  minMatchPercentage: number
  /** Whether the user actually has pantry items (pantry filter is a no-op otherwise). */
  hasPantry: boolean
}

/**
 * Client-side filtering shared by the home and search grids: optionally restrict to
 * recipes whose pantry match meets the threshold (sorted best-match first), then
 * apply the OR category filter. Pure and non-mutating.
 */
export function applyRecipeFilters(
  recipes: Recipe[],
  { activeCategories, isFilterActive, minMatchPercentage, hasPantry }: RecipeFilterState,
): Recipe[] {
  let result = recipes

  if (isFilterActive && hasPantry) {
    result = recipes
      .filter((r) => (r.pantry_match_percentage ?? 0) >= minMatchPercentage)
      .sort((a, b) => (b.pantry_match_percentage ?? 0) - (a.pantry_match_percentage ?? 0))
  }

  if (activeCategories.length > 0) {
    const set = new Set(activeCategories.map((c) => c.toLowerCase()))
    result = result.filter((r) => r.categories?.some((c) => set.has(c.toLowerCase())))
  }

  return result
}

/** Summary line shown while the pantry filter is active. */
export function pantryMatchSummary(isFilterActive: boolean, count: number): string | null {
  if (!isFilterActive) return null
  if (count === 0) return 'Inga matchande recept hittades'
  if (count === 1) return '1 recept matchar ditt skafferi'
  return `${count} recept matchar ditt skafferi`
}

import { MemberFilter } from '@/components/member-filter'
import { CategoryFilter } from '@/components/category-filter'
import { IngredientFilterToggle } from '@/components/ingredient-filter-toggle'
import type { CategoryGroup } from '@/lib/types'
import type { PantryItem } from '@/lib/ingredient-search-types'

type Member = {
  id: string
  name: string
  isCurrentUser: boolean
  type?: 'household' | 'shared-book'
}

interface RecipeFiltersProps {
  groupedCategories: CategoryGroup[]
  pantryItems: PantryItem[]
  isAuthenticated: boolean
  // Pantry filter state (from useRecipeBrowser / useRecipeFilters)
  isFilterActive: boolean
  minMatchPercentage: number
  onFilterToggle: (active: boolean) => void
  onMinMatchChange: (value: number) => void
  resultsSummary: string | null
  // Member filter is optional — collections aren't filtered by household member.
  members?: Member[]
  selectedMemberIds?: string[]
}

/**
 * The shared filter row above a recipe grid: member filter (optional),
 * category filter, and pantry ("skafferi") match filter, plus the pantry
 * summary line. Used by the home, search, and collection pages.
 */
export function RecipeFilters({
  groupedCategories,
  pantryItems,
  isAuthenticated,
  isFilterActive,
  minMatchPercentage,
  onFilterToggle,
  onMinMatchChange,
  resultsSummary,
  members,
  selectedMemberIds = [],
}: RecipeFiltersProps) {
  return (
    <>
      {members && members.length > 1 && (
        <MemberFilter members={members} selectedIds={selectedMemberIds} />
      )}

      <CategoryFilter groupedCategories={groupedCategories} />

      {isAuthenticated && (
        <IngredientFilterToggle
          pantryItems={pantryItems}
          isFilterActive={isFilterActive}
          minMatchPercentage={minMatchPercentage}
          isLoading={false}
          onFilterToggle={onFilterToggle}
          onMinMatchChange={onMinMatchChange}
        />
      )}

      {resultsSummary && (
        <p className="text-sm text-muted-foreground">{resultsSummary}</p>
      )}
    </>
  )
}

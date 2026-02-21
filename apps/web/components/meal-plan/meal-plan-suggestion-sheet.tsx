
import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { BookmarkPlus, Clock, Loader2, Tag, Sparkles, UtensilsCrossed } from '@/lib/icons'
import type { MealPlanEntry, SuggestedRecipe } from '@/lib/meal-plan/types'
import { toast } from 'sonner'
import { saveEntryAsRecipe } from '@/lib/meal-plan-actions'

interface MealPlanSuggestionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: MealPlanEntry | null
  onSaved: (entryId: string, recipeId: string) => void
}

export function MealPlanSuggestionSheet({
  open,
  onOpenChange,
  entry,
  onSaved,
}: MealPlanSuggestionSheetProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recipe = entry?.suggested_recipe
  const isBaseRecipe = !!recipe?.source_url
  if (!recipe) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl px-0 pb-6">
          <div className="flex justify-center pt-2 pb-4">
            <div className="w-9 h-1 rounded-full bg-muted" />
          </div>
          <div className="px-6 text-center py-8">
            <p className="text-muted-foreground">Inget recept att visa</p>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)

  async function handleSave() {
    if (!entry || !recipe) return
    setSaving(true)
    setError(null)

    try {
      const result = await saveEntryAsRecipe(entry.id, recipe as SuggestedRecipe)

      if ('error' in result) {
        setError(result.error)
        setSaving(false)
        return
      }

      setSaving(false)
      onSaved(entry.id, result.recipe_id)
      onOpenChange(false)
    } catch {
      setSaving(false)
      toast.error('Ett fel uppstod. Försök igen.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl px-0 pb-6">
        {/* Drag indicator */}
        <div className="flex justify-center pt-2 pb-4">
          <div className="w-9 h-1 rounded-full bg-muted" />
        </div>

        <div className="px-6">
          <SheetHeader className="mb-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              {isBaseRecipe ? (
                <>
                  <UtensilsCrossed className="h-4 w-4 text-warm" />
                  <span className="text-xs font-medium text-warm uppercase tracking-wider">Basrecept</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-warm" />
                  <span className="text-xs font-medium text-warm uppercase tracking-wider">AI-förslag</span>
                </>
              )}
            </div>
            <SheetTitle className="text-center">{recipe.recipe_name}</SheetTitle>
            {recipe.description && (
              <p className="text-sm text-muted-foreground text-center mt-1">{recipe.description}</p>
            )}
          </SheetHeader>

          {/* Meta badges */}
          <div className="flex items-center justify-center gap-3 mb-5 flex-wrap">
            {totalTime > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Clock className="h-3 w-3" />
                {totalTime} min
              </span>
            )}
            {recipe.recipe_yield && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                {recipe.recipe_yield}
              </span>
            )}
            {recipe.categories && recipe.categories.length > 0 && recipe.categories.map((cat) => (
              <span key={cat} className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Tag className="h-3 w-3" />
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="max-h-[50vh] overflow-y-auto px-6">
          {/* Ingredients */}
          {recipe.ingredient_groups.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold mb-2">Ingredienser</h3>
              {recipe.ingredient_groups.map((group, gi) => (
                <div key={gi} className="mb-3">
                  {group.group_name && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      {group.group_name}
                    </p>
                  )}
                  <ul className="space-y-1">
                    {group.ingredients.map((ing, ii) => (
                      <li key={ii} className="text-sm flex gap-2">
                        <span className="text-muted-foreground shrink-0">
                          {ing.quantity && `${ing.quantity} ${ing.measurement}`.trim()}
                        </span>
                        <span>{ing.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Instructions */}
          {recipe.instruction_groups.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold mb-2">Instruktioner</h3>
              {recipe.instruction_groups.map((group, gi) => (
                <div key={gi} className="mb-3">
                  {group.group_name && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      {group.group_name}
                    </p>
                  )}
                  <ol className="space-y-2">
                    {group.instructions.map((inst, ii) => (
                      <li key={ii} className="text-sm flex gap-3">
                        <span className="shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {ii + 1}
                        </span>
                        <span className="leading-relaxed">{inst.step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-6 pt-4 border-t border-border/40 space-y-2">
          {error && (
            <p className="text-center text-sm text-destructive mb-2">{error}</p>
          )}
          {isBaseRecipe && recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs text-muted-foreground underline-offset-2 hover:underline mb-1"
            >
              Källa: {recipe.source_site || new URL(recipe.source_url).hostname}
            </a>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sparar...
              </>
            ) : (
              <>
                <BookmarkPlus className="mr-2 h-4 w-4" />
                Spara till mina recept
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

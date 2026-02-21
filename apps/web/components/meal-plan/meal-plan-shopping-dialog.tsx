
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Check } from '@/lib/icons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ShoppingListSelector } from '@/components/add-to-shopping-list-dialog/shopping-list-selector'
import { useIsMobile } from '@/lib/hooks/use-media-query'
import { useAuth } from '@/components/auth-provider'
import {
  getUserShoppingLists,
  createShoppingList,
  addRecipeToShoppingList,
  addCustomShoppingListItem,
} from '@/lib/actions'
import { getRecipeIngredientsByIds } from '@/lib/meal-plan-actions'
import { getUserPantry } from '@/lib/ingredient-search-actions'
import { scaleQuantity } from '@/lib/quantity-utils'
import type { MealPlanEntry } from '@/lib/meal-plan/types'
import type { ShoppingList } from '@/lib/types'

interface IngredientItem {
  key: string
  name: string
  quantity: string
  measurement: string
  inPantry: boolean
  recipeId: string | null
  ingredientId: string | null
}

interface RecipeGroup {
  recipeName: string
  recipeId: string | null
  ingredients: IngredientItem[]
}

interface MealPlanShoppingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  homeId?: string
  entries: MealPlanEntry[]
}

export function MealPlanShoppingDialog({
  open,
  onOpenChange,
  homeId,
  entries,
}: MealPlanShoppingDialogProps) {
  const router = useRouter()
  const { homes } = useAuth()
  const isMobile = useIsMobile()

  const [allLists, setAllLists] = useState<ShoppingList[]>([])
  const [selectedHomeId, setSelectedHomeId] = useState(homeId || homes[0]?.home_id || '')
  const [selectedListId, setSelectedListId] = useState('')
  const [isLoadingLists, setIsLoadingLists] = useState(false)
  const [isCreatingList, setIsCreatingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isLoadingData, setIsLoadingData] = useState(false)
  const [recipeIngredientsMap, setRecipeIngredientsMap] = useState<
    Map<string, Array<{ id: string; name: string; quantity: string; measurement: string; in_pantry?: boolean }>>
  >(new Map())
  const [pantryNames, setPantryNames] = useState<Set<string>>(new Set())
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set())
  const hasInitialized = useRef(false)
  const dataReady = useRef(false)

  const recipeGroups = useMemo(() => {
    const groups: RecipeGroup[] = []

    for (const entry of entries) {
      const recipeName = entry.recipe_id
        ? (entry.recipe_name || 'Okänt recept')
        : (entry.suggested_name || 'Förslag')

      const ingredients: IngredientItem[] = []

      if (entry.recipe_id) {
        const ings = recipeIngredientsMap.get(entry.recipe_id) || []
        for (const ing of ings) {
          ingredients.push({
            key: `r-${ing.id}`,
            name: ing.name,
            quantity: ing.quantity,
            measurement: ing.measurement,
            inPantry: ing.in_pantry ?? false,
            recipeId: entry.recipe_id,
            ingredientId: ing.id,
          })
        }
      } else if (entry.suggested_recipe) {
        let idx = 0
        for (const group of entry.suggested_recipe.ingredient_groups) {
          for (const ing of group.ingredients) {
            ingredients.push({
              key: `s-${entry.id}-${idx}`,
              name: ing.name,
              quantity: ing.quantity,
              measurement: ing.measurement,
              inPantry: pantryNames.has(ing.name.toLowerCase()),
              recipeId: null,
              ingredientId: null,
            })
            idx++
          }
        }
      }

      if (ingredients.length > 0) {
        groups.push({ recipeName, recipeId: entry.recipe_id, ingredients })
      }
    }

    return groups
  }, [entries, recipeIngredientsMap, pantryNames])

  const allIngredients = useMemo(
    () => recipeGroups.flatMap((g) => g.ingredients),
    [recipeGroups],
  )

  const allKeys = useMemo(
    () => allIngredients.map((i) => i.key),
    [allIngredients],
  )

  const pantryCount = useMemo(
    () => allIngredients.filter((i) => i.inPantry).length,
    [allIngredients],
  )

  const allSelected = allKeys.length > 0 && selectedIngredients.size === allKeys.length
  const someSelected = selectedIngredients.size > 0 && !allSelected

  const lists = useMemo(
    () => allLists.filter((l) => l.home_id === selectedHomeId),
    [allLists, selectedHomeId],
  )

  // Fetch shopping lists and recipe ingredients when dialog opens
  useEffect(() => {
    if (!open) {
      hasInitialized.current = false
      dataReady.current = false
      return
    }

    // Mark data as not ready synchronously — prevents pre-selection from firing too early
    dataReady.current = false
    hasInitialized.current = false

    setIsLoadingLists(true)
    setError(null)
    getUserShoppingLists()
      .then((result) => {
        if (!('error' in result)) {
          setAllLists(result)
          const homeLists = result.filter((l) => l.home_id === selectedHomeId)
          const defaultList = homeLists.find((l) => l.is_default) || homeLists[0]
          if (defaultList) setSelectedListId(defaultList.id)
        }
      })
      .finally(() => setIsLoadingLists(false))

    // Fetch pantry + recipe ingredients in parallel
    const recipeIds = [...new Set(entries.filter((e) => e.recipe_id).map((e) => e.recipe_id!))]

    setIsLoadingData(true)
    Promise.all([
      recipeIds.length > 0
        ? getRecipeIngredientsByIds(recipeIds, homeId)
        : Promise.resolve([]),
      getUserPantry(homeId),
    ])
      .then(([recipes, pantryResult]) => {
        const map = new Map<string, typeof recipes[0]['ingredients']>()
        for (const recipe of recipes) {
          map.set(recipe.id, recipe.ingredients || [])
        }
        setRecipeIngredientsMap(map)

        if (!('error' in pantryResult)) {
          setPantryNames(new Set(pantryResult.map((item) => item.food_name.toLowerCase())))
        }

        dataReady.current = true
      })
      .finally(() => setIsLoadingData(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Pre-select ingredients: deselect pantry items, select the rest
  // dataReady ref is set synchronously in the fetch .then() to avoid race with async state
  useEffect(() => {
    if (open && dataReady.current && allIngredients.length > 0 && !hasInitialized.current) {
      const hasPantryData = allIngredients.some((i) => i.inPantry)
      if (hasPantryData) {
        setSelectedIngredients(
          new Set(allIngredients.filter((i) => !i.inPantry).map((i) => i.key)),
        )
      } else {
        setSelectedIngredients(new Set(allKeys))
      }
      hasInitialized.current = true
    }
  }, [open, allIngredients, allKeys, isLoadingData])

  function toggleIngredient(key: string) {
    setSelectedIngredients((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIngredients(new Set())
    } else {
      setSelectedIngredients(new Set(allKeys))
    }
  }

  function handleHomeChange(newHomeId: string) {
    setSelectedHomeId(newHomeId)
    const homeLists = allLists.filter((l) => l.home_id === newHomeId)
    const defaultList = homeLists.find((l) => l.is_default) || homeLists[0]
    setSelectedListId(defaultList?.id ?? '')
  }

  async function handleCreateList() {
    if (!newListName.trim()) return
    setIsCreatingList(true)
    try {
      const result = await createShoppingList(newListName.trim(), selectedHomeId || undefined)
      if ('id' in result) {
        const selectedHome = homes.find((h) => h.home_id === selectedHomeId)
        const newList: ShoppingList = {
          id: result.id,
          name: newListName.trim(),
          is_default: lists.length === 0,
          item_count: 0,
          checked_count: 0,
          date_published: new Date().toISOString(),
          date_modified: new Date().toISOString(),
          home_id: selectedHomeId || null,
          home_name: selectedHome?.home_name ?? null,
        }
        setAllLists((prev) => [newList, ...prev])
        setSelectedListId(result.id)
        setNewListName('')
      } else {
        setError(result.error)
      }
    } finally {
      setIsCreatingList(false)
    }
  }

  async function handleSubmit() {
    if (selectedIngredients.size === 0) {
      setError('Välj minst en ingrediens')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Process saved recipes — use addRecipeToShoppingList per recipe
      for (const group of recipeGroups) {
        if (group.recipeId) {
          const selectedIds = group.ingredients
            .filter((i) => selectedIngredients.has(i.key) && i.ingredientId)
            .map((i) => i.ingredientId!)

          if (selectedIds.length > 0) {
            const result = await addRecipeToShoppingList(
              group.recipeId,
              { ingredientIds: selectedIds, listId: selectedListId || undefined },
              selectedHomeId || undefined,
            )
            if ('error' in result) {
              setError(result.error)
              setIsSubmitting(false)
              return
            }
          }
        }
      }

      // Process AI suggestion ingredients — add as custom items
      for (const group of recipeGroups) {
        if (!group.recipeId) {
          for (const ing of group.ingredients) {
            if (selectedIngredients.has(ing.key)) {
              const displayName = [ing.quantity, ing.measurement, ing.name]
                .filter(Boolean)
                .join(' ')
              await addCustomShoppingListItem(
                displayName,
                selectedListId || undefined,
                undefined,
                selectedHomeId || undefined,
              )
            }
          }
        }
      }

      onOpenChange(false)
      if (selectedHomeId) {
        router.navigate({ to: '/hem/$homeId/inkopslista', params: { homeId: selectedHomeId }, search: { list: undefined } })
      } else {
        router.navigate({ to: '/inkopslista' })
      }
    } catch {
      setError('Ett fel uppstod. Försök igen.')
      setIsSubmitting(false)
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setError(null)
      setNewListName('')
    }
    onOpenChange(newOpen)
  }

  const content = (
    <>
      {homes.length > 1 && (
        <div className="shrink-0 space-y-2 py-4 rounded-lg bg-muted/30">
          <label className="text-sm font-medium">Vilket hem lagar du i?</label>
          <Select value={selectedHomeId} onValueChange={handleHomeChange}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Välj hem" />
            </SelectTrigger>
            <SelectContent>
              {homes.map((home) => (
                <SelectItem key={home.home_id} value={home.home_id}>
                  {home.home_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <ShoppingListSelector
        lists={lists}
        selectedListId={selectedListId}
        onSelectedListChange={setSelectedListId}
        isLoading={isLoadingLists}
        newListName={newListName}
        onNewListNameChange={setNewListName}
        onCreateList={handleCreateList}
        isCreating={isCreatingList}
      />

      {/* Pantry summary */}
      {!isLoadingData && pantryCount > 0 && (
        <div className="shrink-0 flex items-center gap-2 py-3 px-3 rounded-lg bg-primary/10 border border-primary/20">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
          <span className="text-sm text-foreground">
            <span className="font-medium">{pantryCount}</span> av{' '}
            {allIngredients.length} ingredienser finns i ditt skafferi
          </span>
        </div>
      )}

      {/* Select all toggle */}
      {!isLoadingData && allKeys.length > 0 && (
        <div className="shrink-0 flex items-center gap-3 py-3 border-y">
          <Checkbox
            id="select-all-mp"
            checked={allSelected}
            onCheckedChange={toggleAll}
            className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
          />
          <label
            htmlFor="select-all-mp"
            className="text-sm font-medium cursor-pointer select-none flex-1"
          >
            {allSelected ? 'Avmarkera alla' : 'Välj alla'}
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {selectedIngredients.size} av {allKeys.length} valda
          </span>
        </div>
      )}

      {/* Ingredients grouped by recipe */}
      {isLoadingData ? (
        <p className="text-sm text-muted-foreground py-4">Laddar ingredienser...</p>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="py-2 space-y-1">
            {recipeGroups.map((group) => (
              <div key={group.recipeId || group.recipeName}>
                <div className="sticky top-0 text-xs font-semibold uppercase tracking-wider text-primary py-2 px-1 bg-background/95 backdrop-blur-sm border-b border-border/50 mb-1">
                  {group.recipeName}
                </div>
                <div className="space-y-0.5">
                  {group.ingredients.map((ing) => (
                    <label
                      key={ing.key}
                      className="flex items-center gap-3 py-3 sm:py-2 px-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted"
                    >
                      <Checkbox
                        checked={selectedIngredients.has(ing.key)}
                        onCheckedChange={() => toggleIngredient(ing.key)}
                        aria-label={`Välj ${ing.name}`}
                        className="h-5 w-5 sm:h-4 sm:w-4 shrink-0"
                      />
                      <span className="flex-1 text-sm">
                        <span className="font-semibold tabular-nums text-foreground">
                          {scaleQuantity(ing.quantity, 1)}
                          {ing.measurement ? ` ${ing.measurement}` : ''}
                        </span>{' '}
                        <span className="text-muted-foreground">{ing.name}</span>
                      </span>
                      {ing.inPantry && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="shrink-0 mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  )

  const footer = (
    <>
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isSubmitting}
      >
        Avbryt
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || selectedIngredients.size === 0}
      >
        {isSubmitting ? 'Lägger till...' : 'Lägg till i inköpslista'}
      </Button>
    </>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="h-[100dvh] flex flex-col gap-0 px-4 rounded-t-xl">
          <SheetHeader className="shrink-0 pb-4 text-left">
            <SheetTitle>Lägg till i inköpslista</SheetTitle>
            <SheetDescription>
              Välj ingredienser att lägga till från matplanen.
            </SheetDescription>
          </SheetHeader>
          {content}
          <SheetFooter className="shrink-0 pt-4 border-t flex-row gap-2">
            {footer}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-lg gap-0">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>Lägg till i inköpslista</DialogTitle>
          <DialogDescription>
            Välj ingredienser att lägga till från matplanen.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {content}
        </div>
        <DialogFooter className="shrink-0 pt-4 border-t gap-2">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

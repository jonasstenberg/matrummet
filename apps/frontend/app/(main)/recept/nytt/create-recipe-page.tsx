'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RecipeForm } from '@/components/recipe-form'
import { RecipeImportForm } from '@/components/recipe-import-form'
import { RecipeParser } from '@/components/recipe-parser'
import { useAuth } from '@/components/auth-provider'
import { isAdmin } from '@/lib/is-admin'
import { createRecipe } from '@/lib/actions'
import { CreateRecipeInput, Recipe, IngredientGroup, Ingredient, InstructionGroup, Instruction } from '@/lib/types'
import { ParsedRecipe } from '@/lib/recipe-parser/types'

// Type for import data that can be either flat (from URL import) or grouped (from Gemini parser)
type ImportData = Partial<CreateRecipeInput> | ParsedRecipe

function isGroupedFormat(data: ImportData): data is ParsedRecipe {
  return 'ingredient_groups' in data && Array.isArray(data.ingredient_groups)
}

function processIngredients(data: ImportData): {
  groups: IngredientGroup[]
  items: Ingredient[]
} {
  const groups: IngredientGroup[] = []
  const items: Ingredient[] = []

  if (isGroupedFormat(data)) {
    // Grouped format from Gemini parser
    for (const group of data.ingredient_groups || []) {
      const groupId = group.group_name ? crypto.randomUUID() : null

      if (group.group_name) {
        groups.push({
          id: groupId!,
          name: group.group_name,
          sort_order: groups.length,
        })
      }

      for (const ing of group.ingredients) {
        items.push({
          name: ing.name,
          measurement: ing.measurement,
          quantity: ing.quantity,
          group_id: groupId,
          sort_order: items.length,
        })
      }
    }
  } else if (data.ingredients) {
    // Flat format from URL import with group markers
    let currentGroupId: string | null = null
    for (const item of data.ingredients) {
      if ('group' in item) {
        const groupId = crypto.randomUUID()
        groups.push({
          id: groupId,
          name: item.group,
          sort_order: groups.length,
        })
        currentGroupId = groupId
      } else {
        items.push({
          name: item.name,
          measurement: item.measurement,
          quantity: item.quantity,
          group_id: currentGroupId,
          sort_order: items.length,
        })
      }
    }
  }

  return { groups, items }
}

function processInstructions(data: ImportData): {
  groups: InstructionGroup[]
  items: Instruction[]
} {
  const groups: InstructionGroup[] = []
  const items: Instruction[] = []

  if (isGroupedFormat(data)) {
    // Grouped format from Gemini parser
    for (const group of data.instruction_groups || []) {
      const groupId = group.group_name ? crypto.randomUUID() : null

      if (group.group_name) {
        groups.push({
          id: groupId!,
          name: group.group_name,
          sort_order: groups.length,
        })
      }

      for (const inst of group.instructions) {
        items.push({
          step: inst.step,
          group_id: groupId,
          sort_order: items.length,
        })
      }
    }
  } else if (data.instructions) {
    // Flat format from URL import with group markers
    let currentGroupId: string | null = null
    for (const item of data.instructions) {
      if ('group' in item) {
        const groupId = crypto.randomUUID()
        groups.push({
          id: groupId,
          name: item.group,
          sort_order: groups.length,
        })
        currentGroupId = groupId
      } else {
        items.push({
          step: item.step,
          group_id: currentGroupId,
          sort_order: items.length,
        })
      }
    }
  }

  return { groups, items }
}

export function CreateRecipePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [importedData, setImportedData] = useState<Partial<Recipe> | null>(null)
  const [lowConfidenceIngredients, setLowConfidenceIngredients] = useState<number[]>([])
  const [importKey, setImportKey] = useState(0)

  function handleImport(data: ImportData, lowConfidenceIndices?: number[]) {
    const { groups: ingredientGroups, items: ingredients } = processIngredients(data)
    const { groups: instructionGroups, items: instructions } = processInstructions(data)

    const recipeData: Partial<Recipe> = {
      name: data.recipe_name || '',
      description: data.description || '',
      author: data.author || null,
      url: 'url' in data ? data.url || null : null,
      recipe_yield: data.recipe_yield ? parseInt(data.recipe_yield, 10) : null,
      recipe_yield_name: data.recipe_yield_name || null,
      prep_time: data.prep_time || null,
      cook_time: data.cook_time || null,
      cuisine: data.cuisine || null,
      image: 'image' in data ? data.image || null : null,
      thumbnail: 'thumbnail' in data ? data.thumbnail || null : null,
      date_published: 'date_published' in data ? data.date_published || null : null,
      categories: data.categories || [],
      ingredient_groups: ingredientGroups,
      ingredients: ingredients,
      instruction_groups: instructionGroups,
      instructions: instructions,
    }

    setImportedData(recipeData)
    setLowConfidenceIngredients(lowConfidenceIndices || [])
    setImportKey((prev) => prev + 1)
  }

  async function handleSubmit(data: CreateRecipeInput) {
    setIsSubmitting(true)

    try {
      const result = await createRecipe(data)

      if ('error' in result) {
        throw new Error(result.error)
      }

      // Redirect to the new recipe page
      router.push(`/recept/${result.id}`)
    } catch (error) {
      setIsSubmitting(false)
      throw error
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Skapa nytt recept
        </h1>
      </header>
      {isAdmin(user) && <RecipeParser onParse={handleImport} />}
      <RecipeImportForm onImport={handleImport} />
      <RecipeForm
        key={importKey}
        initialData={importedData as Recipe | undefined}
        lowConfidenceIngredients={lowConfidenceIngredients}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}

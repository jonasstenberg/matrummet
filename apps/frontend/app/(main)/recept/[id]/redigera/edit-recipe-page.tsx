'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RecipeForm } from '@/components/recipe-form'
import { updateRecipe } from '@/lib/actions'
import { setRecipeFeatured } from '@/lib/admin-actions'
import { Recipe, CreateRecipeInput, UpdateRecipeInput } from '@/lib/types'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Star } from 'lucide-react'

interface EditRecipePageProps {
  recipe: Recipe
  isAdmin?: boolean
}

export function EditRecipePage({ recipe, isAdmin = false }: EditRecipePageProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFeatured, setIsFeatured] = useState(recipe.is_featured ?? false)
  const [isTogglingFeatured, setIsTogglingFeatured] = useState(false)

  async function handleToggleFeatured(checked: boolean) {
    setIsTogglingFeatured(true)
    try {
      const result = await setRecipeFeatured(recipe.id, checked)
      if (result.success) {
        setIsFeatured(checked)
      }
    } finally {
      setIsTogglingFeatured(false)
    }
  }

  async function handleSubmit(data: CreateRecipeInput) {
    setIsSubmitting(true)

    try {
      // Convert CreateRecipeInput to UpdateRecipeInput format
      const updateData: UpdateRecipeInput = {
        recipe_id: recipe.id,
        ...data,
      }

      const result = await updateRecipe(recipe.id, updateData)

      if ('error' in result) {
        throw new Error(result.error)
      }

      // Redirect back to the recipe page
      router.push(`/recept/${recipe.id}`)
    } catch (error) {
      setIsSubmitting(false)
      throw error
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Redigera recept
        </h1>
      </header>

      {/* Admin-only featured toggle */}
      {isAdmin && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <Star className="h-5 w-5 text-amber-600" />
          <div className="flex-1">
            <Label htmlFor="featured-toggle" className="text-sm font-medium text-amber-900">
              Utvalt recept
            </Label>
            <p className="text-xs text-amber-700">
              Visa på startsidan för besökare
            </p>
          </div>
          <Switch
            id="featured-toggle"
            checked={isFeatured}
            onCheckedChange={handleToggleFeatured}
            disabled={isTogglingFeatured}
          />
        </div>
      )}

      <RecipeForm
        initialData={recipe}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}

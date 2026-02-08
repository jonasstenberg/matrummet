import { useState, useCallback } from 'react'
import { UseFormReturn } from 'react-hook-form'
import type { RecipeFormValues } from '@/lib/schemas'

export interface UseAiRefinementOptions {
  /** Original prompt used to generate the recipe (if any) */
  originalPrompt: string | null
  /** Whether the recipe was AI-generated (even without a prompt) */
  aiGenerated?: boolean
  /** React Hook Form instance for accessing and updating form values */
  form: UseFormReturn<RecipeFormValues>
}

export interface UseAiRefinementReturn {
  /** Whether the original prompt section is expanded */
  isPromptExpanded: boolean
  /** User's refinement instructions text */
  refinementText: string
  /** Whether the refinement is in progress */
  isRefining: boolean
  /** Error message from refinement attempt */
  refineError: string | null
  /** Whether to show the AI refinement UI (true if recipe was AI-generated) */
  showAiRefinement: boolean
  /** Toggle the original prompt expansion */
  setIsPromptExpanded: (expanded: boolean) => void
  /** Update the refinement text */
  setRefinementText: (text: string) => void
  /** Execute the AI refinement */
  handleRefine: () => Promise<void>
  /** Clear the refinement error */
  clearError: () => void
}

/**
 * Hook for managing AI refinement logic in recipe forms
 *
 * Handles:
 * - Original prompt display and expansion
 * - Refinement text input
 * - API call to refine the recipe based on user instructions
 * - Applying refinement updates to the form
 * - Error handling
 */
export function useAiRefinement(options: UseAiRefinementOptions): UseAiRefinementReturn {
  const { originalPrompt, aiGenerated = false, form } = options

  const [isPromptExpanded, setIsPromptExpanded] = useState(false)
  const [refinementText, setRefinementText] = useState("")
  const [isRefining, setIsRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)

  const showAiRefinement = aiGenerated || !!originalPrompt

  const clearError = useCallback(() => {
    setRefineError(null)
  }, [])

  const handleRefine = useCallback(async () => {
    if (!refinementText.trim()) return

    setIsRefining(true)
    setRefineError(null)

    try {
      const formValues = form.getValues()
      const response = await fetch("/api/admin/ai/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentRecipe: {
            recipe_name: formValues.name,
            description: formValues.description,
            ingredients: formValues.ingredients,
            instructions: formValues.instructions,
            ingredientGroups: formValues.ingredientGroups,
            instructionGroups: formValues.instructionGroups,
          },
          refinementInstructions: refinementText.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Förfining misslyckades")
      }

      const data = await response.json()
      const updates = data.updates

      // Apply refinement updates using setValue
      if (updates.name !== undefined) form.setValue("name", updates.name)
      if (updates.description !== undefined) form.setValue("description", updates.description)
      if (updates.ingredients !== undefined) form.setValue("ingredients", updates.ingredients)
      if (updates.instructions !== undefined) form.setValue("instructions", updates.instructions)
      if (updates.ingredientGroups !== undefined) form.setValue("ingredientGroups", updates.ingredientGroups)
      if (updates.instructionGroups !== undefined) form.setValue("instructionGroups", updates.instructionGroups)

      setRefinementText("")
    } catch (err) {
      setRefineError(
        err instanceof Error ? err.message : "Förfining misslyckades"
      )
    } finally {
      setIsRefining(false)
    }
  }, [refinementText, form])

  return {
    isPromptExpanded,
    refinementText,
    isRefining,
    refineError,
    showAiRefinement,
    setIsPromptExpanded,
    setRefinementText,
    handleRefine,
    clearError,
  }
}

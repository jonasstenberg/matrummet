"use client"

import { IngredientEditor } from "@/components/ingredient-editor"
import { InstructionEditor } from "@/components/instruction-editor"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RecipeFormData } from "@/components/create-recipe-wizard"

interface RecipeContentStepProps {
  formData: RecipeFormData
  onChange: (updates: Partial<RecipeFormData>) => void
  lowConfidenceIngredients: number[]
  submitError: string | null
}

export function RecipeContentStep({
  formData,
  onChange,
  lowConfidenceIngredients,
  submitError,
}: RecipeContentStepProps) {
  return (
    <div className="space-y-6 mt-8 pt-8 border-t">
      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Ingredients */}
      <div className="rounded-lg border bg-card p-4">
        <IngredientEditor
          ingredients={formData.ingredients}
          groups={formData.ingredientGroups}
          lowConfidenceIndices={lowConfidenceIngredients}
          onChange={(ingredients, groups) =>
            onChange({
              ingredients,
              ingredientGroups: groups,
            })
          }
        />
      </div>

      {/* Instructions */}
      <div className="rounded-lg border bg-card p-4">
        <InstructionEditor
          instructions={formData.instructions}
          groups={formData.instructionGroups}
          onChange={(instructions, groups) =>
            onChange({
              instructions,
              instructionGroups: groups,
            })
          }
        />
      </div>
    </div>
  )
}

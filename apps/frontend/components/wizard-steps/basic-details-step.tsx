"use client"

import { useState } from "react"
import { CategorySelector } from "@/components/category-selector"
import { ImageUpload } from "@/components/image-upload"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { RecipeFormData } from "@/components/create-recipe-wizard"
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from "lucide-react"

interface BasicDetailsStepProps {
  formData: RecipeFormData
  onChange: (updates: Partial<RecipeFormData>) => void
  onRefine?: (refinedData: Partial<RecipeFormData>) => void
}

export function BasicDetailsStep({ formData, onChange, onRefine }: BasicDetailsStepProps) {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false)
  const [refinementText, setRefinementText] = useState("")
  const [isRefining, setIsRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)

  async function handleRefine() {
    if (!refinementText.trim()) return

    setIsRefining(true)
    setRefineError(null)

    try {
      const response = await fetch("/api/admin/gemini/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentRecipe: {
            recipe_name: formData.name,
            description: formData.description,
            ingredients: formData.ingredients,
            instructions: formData.instructions,
            ingredientGroups: formData.ingredientGroups,
            instructionGroups: formData.instructionGroups,
          },
          refinementInstructions: refinementText.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Förfining misslyckades")
      }

      const data = await response.json()
      if (onRefine) {
        onRefine(data.updates)
      }
      setRefinementText("")
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : "Förfining misslyckades")
    } finally {
      setIsRefining(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Original prompt and refinement section */}
      {formData.originalPrompt && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-warm" />
              <span>AI-genererat recept</span>
            </div>
            <button
              type="button"
              onClick={() => setIsPromptExpanded(!isPromptExpanded)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {isPromptExpanded ? (
                <>Dölj ursprunglig prompt <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Visa ursprunglig prompt <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          </div>

          {isPromptExpanded && (
            <div className="text-sm text-muted-foreground bg-background rounded p-3 whitespace-pre-wrap">
              {formData.originalPrompt}
            </div>
          )}

          <div className="space-y-2">
            <Textarea
              placeholder="Beskriv hur du vill förfina receptet, t.ex. 'Lägg till mer vitlök' eller 'Gör det veganskt'..."
              value={refinementText}
              onChange={(e) => {
                setRefinementText(e.target.value)
                setRefineError(null)
              }}
              className="min-h-[60px] text-sm"
              disabled={isRefining}
            />
            {refineError && (
              <Alert variant="destructive">
                <AlertDescription>{refineError}</AlertDescription>
              </Alert>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRefine}
              disabled={!refinementText.trim() || isRefining}
              className="w-full"
            >
              {isRefining ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Förfinar...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-3 w-3" />
                  Förfina med AI
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <FieldGroup>
        {/* Required fields */}
        <Field>
          <FieldLabel htmlFor="name">
            Receptnamn <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="T.ex. Köttbullar med potatismos"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="description">
            Beskrivning <span className="text-destructive">*</span>
          </FieldLabel>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="En kort beskrivning av receptet"
            className="min-h-[100px]"
          />
        </Field>

        {/* Yield fields */}
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="recipe-yield">Portioner</FieldLabel>
            <Input
              id="recipe-yield"
              type="number"
              min="1"
              value={formData.recipeYield}
              onChange={(e) => onChange({ recipeYield: e.target.value })}
              placeholder="T.ex. 4"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="recipe-yield-name">Enhet</FieldLabel>
            <Input
              id="recipe-yield-name"
              value={formData.recipeYieldName}
              onChange={(e) => onChange({ recipeYieldName: e.target.value })}
              placeholder="T.ex. portioner"
            />
            <FieldDescription>
              T.ex. portioner, bitar, eller liter
            </FieldDescription>
          </Field>
        </div>

        {/* Time fields */}
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="prep-time">Förberedelse</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="prep-time"
                type="number"
                min="0"
                value={formData.prepTime}
                onChange={(e) => onChange({ prepTime: e.target.value })}
                placeholder="15"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>min</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="cook-time">Tillagning</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="cook-time"
                type="number"
                min="0"
                value={formData.cookTime}
                onChange={(e) => onChange({ cookTime: e.target.value })}
                placeholder="30"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>min</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </div>

        {/* Optional fields */}
        <Field>
          <FieldLabel htmlFor="author">Författare</FieldLabel>
          <Input
            id="author"
            value={formData.author}
            onChange={(e) => onChange({ author: e.target.value })}
            placeholder="T.ex. Mormor Inga"
          />
          <FieldDescription>
            Vem har skapat eller inspirerat detta recept
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="url">Källa (URL)</FieldLabel>
          <Input
            id="url"
            type="url"
            value={formData.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://..."
          />
          <FieldDescription>
            Länk till originalreceptet om det finns
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="cuisine">Kök/Ursprung</FieldLabel>
          <Input
            id="cuisine"
            value={formData.cuisine}
            onChange={(e) => onChange({ cuisine: e.target.value })}
            placeholder="T.ex. Svenskt, Italienskt"
          />
          <FieldDescription>
            Vilken matlagningskultur receptet kommer från
          </FieldDescription>
        </Field>

        {/* Image */}
        <ImageUpload
          value={formData.image}
          onChange={(image) => onChange({ image })}
          pendingFile={formData.pendingImageFile}
          onFileSelect={(file) => onChange({ pendingImageFile: file })}
        />

        {/* Categories */}
        <div className="pt-2">
          <CategorySelector
            selectedCategories={formData.categories}
            onChange={(categories) => onChange({ categories })}
          />
        </div>
      </FieldGroup>
    </div>
  )
}

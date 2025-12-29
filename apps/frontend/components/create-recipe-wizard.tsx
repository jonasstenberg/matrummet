"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Stepper,
  StepperHeader,
  StepperContent,
  StepperFooter,
  useStepper,
  Step,
} from "@/components/ui/stepper"
import { useAuth } from "@/components/auth-provider"
import { isAdmin } from "@/lib/is-admin"
import { createRecipe } from "@/lib/actions"
import {
  CreateRecipeInput,
  IngredientGroup,
  Ingredient,
  InstructionGroup,
  Instruction,
} from "@/lib/types"
import { ParsedRecipe } from "@/lib/recipe-parser/types"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

// Import step components
import { SourceSelectionStep } from "./wizard-steps/source-selection-step"
import { BasicDetailsStep } from "./wizard-steps/basic-details-step"
import { RecipeContentStep } from "./wizard-steps/recipe-content-step"

// Type for import data - union of possible import formats
type ImportData = Partial<CreateRecipeInput> | ParsedRecipe | {
  recipe_name?: string
  description?: string
  author?: string | null
  recipe_yield?: string | number | null
  recipe_yield_name?: string | null
  prep_time?: number | null
  cook_time?: number | null
  cuisine?: string | null
  categories?: string[]
  ingredient_groups?: Array<{
    group_name?: string
    ingredients: Array<{
      name: string
      measurement: string
      quantity: string
    }>
  }>
  instruction_groups?: Array<{
    group_name?: string
    instructions: Array<{ step: string }>
  }>
}

function isGroupedFormat(data: ImportData): data is ParsedRecipe {
  return "ingredient_groups" in data && Array.isArray(data.ingredient_groups)
}

function processIngredients(data: ImportData): {
  groups: IngredientGroup[]
  items: Ingredient[]
} {
  const groups: IngredientGroup[] = []
  const items: Ingredient[] = []

  if (isGroupedFormat(data)) {
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
  } else if ("ingredients" in data && data.ingredients) {
    let currentGroupId: string | null = null
    for (const item of data.ingredients) {
      if ("group" in item) {
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
  } else if ("instructions" in data && data.instructions) {
    let currentGroupId: string | null = null
    for (const item of data.instructions) {
      if ("group" in item) {
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

// Recipe form data state
export interface RecipeFormData {
  name: string
  description: string
  author: string
  url: string
  recipeYield: string
  recipeYieldName: string
  prepTime: string
  cookTime: string
  cuisine: string
  image: string | null
  pendingImageFile: File | null
  categories: string[]
  ingredients: Array<{
    name: string
    measurement: string
    quantity: string
    group_id?: string | null
  }>
  ingredientGroups: Array<{ id: string; name: string }>
  instructions: Array<{ step: string; group_id?: string | null }>
  instructionGroups: Array<{ id: string; name: string }>
}

const initialFormData: RecipeFormData = {
  name: "",
  description: "",
  author: "",
  url: "",
  recipeYield: "",
  recipeYieldName: "",
  prepTime: "",
  cookTime: "",
  cuisine: "",
  image: null,
  pendingImageFile: null,
  categories: [],
  ingredients: [{ name: "", measurement: "", quantity: "" }],
  ingredientGroups: [],
  instructions: [{ step: "" }],
  instructionGroups: [],
}

const STEPS: Step[] = [
  {
    id: "source",
    title: "Importera",
    description: "Välj källa",
  },
  {
    id: "details",
    title: "Recept",
    description: "Detaljer & innehåll",
  },
]

function WizardNavigation({
  onSubmit,
  isSubmitting,
  canProceed,
  sourceOption,
  onSourceOptionClear,
}: {
  onSubmit: () => void
  isSubmitting: boolean
  canProceed: boolean
  sourceOption: "url" | "ai" | null
  onSourceOptionClear: () => void
}) {
  const { isFirstStep, isLastStep, nextStep, prevStep } = useStepper()

  // On first step with sub-view selected, back button clears sub-view
  const handleBack = () => {
    if (isFirstStep && sourceOption !== null) {
      onSourceOptionClear()
    } else {
      prevStep()
    }
  }

  // Disable back only when on first step with no sub-view selected
  const isBackDisabled = (isFirstStep && sourceOption === null) || isSubmitting

  return (
    <StepperFooter>
      <Button
        type="button"
        variant="outline"
        onClick={handleBack}
        disabled={isBackDisabled}
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        Tillbaka
      </Button>

      {isLastStep ? (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !canProceed}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sparar...
            </>
          ) : (
            "Spara recept"
          )}
        </Button>
      ) : (
        <Button type="button" onClick={nextStep} disabled={!canProceed}>
          Nästa
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </StepperFooter>
  )
}

type SourceOption = null | "url" | "ai"

interface WizardHistoryState {
  step: number
  sourceOption: SourceOption
}

export function CreateRecipeWizard() {
  const router = useRouter()
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [sourceOption, setSourceOption] = useState<SourceOption>(null)
  const [formData, setFormData] = useState<RecipeFormData>(initialFormData)
  const [lowConfidenceIngredients, setLowConfidenceIngredients] = useState<
    number[]
  >([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isHistoryNavigation, setIsHistoryNavigation] = useState(false)

  // Initialize history state on mount
  useEffect(() => {
    const initialState: WizardHistoryState = { step: 0, sourceOption: null }
    window.history.replaceState(initialState, "")
  }, [])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as WizardHistoryState | null
      if (state) {
        setIsHistoryNavigation(true)
        setCurrentStep(state.step)
        setSourceOption(state.sourceOption)
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // Push history state when step or source option changes (but not from popstate)
  const updateHistoryState = useCallback((step: number, option: SourceOption) => {
    const state: WizardHistoryState = { step, sourceOption: option }
    window.history.pushState(state, "")
  }, [])

  const handleStepChange = useCallback((step: number) => {
    if (isHistoryNavigation) {
      setIsHistoryNavigation(false)
      return
    }
    setCurrentStep(step)
    updateHistoryState(step, step === 0 ? sourceOption : null)
  }, [isHistoryNavigation, sourceOption, updateHistoryState])

  const handleSourceOptionChange = useCallback((option: SourceOption) => {
    setSourceOption(option)
    if (option !== null) {
      updateHistoryState(0, option)
    }
  }, [updateHistoryState])

  const handleImport = useCallback(
    (data: ImportData, lowConfidenceIndices?: number[]) => {
      const { groups: ingredientGroups, items: ingredients } =
        processIngredients(data)
      const { groups: instructionGroups, items: instructions } =
        processInstructions(data)

      setFormData((prev) => ({
        ...prev,
        name: data.recipe_name || "",
        description: data.description || "",
        author: data.author || "",
        url: "url" in data ? data.url || "" : "",
        recipeYield: data.recipe_yield ? String(data.recipe_yield) : "",
        recipeYieldName: data.recipe_yield_name || "",
        prepTime: data.prep_time ? String(data.prep_time) : "",
        cookTime: data.cook_time ? String(data.cook_time) : "",
        cuisine: data.cuisine || "",
        image: "image" in data ? data.image || null : null,
        categories: data.categories || [],
        ingredientGroups: ingredientGroups.map((g) => ({
          id: g.id!,
          name: g.name,
        })),
        ingredients:
          ingredients.length > 0
            ? ingredients
            : [{ name: "", measurement: "", quantity: "" }],
        instructionGroups: instructionGroups.map((g) => ({
          id: g.id!,
          name: g.name,
        })),
        instructions:
          instructions.length > 0 ? instructions : [{ step: "" }],
      }))

      setLowConfidenceIngredients(lowConfidenceIndices || [])

      // Auto-advance to next step after import
      setCurrentStep(1)
      setSourceOption(null)
      updateHistoryState(1, null)
    },
    [updateHistoryState]
  )

  const handleStartBlank = useCallback(() => {
    setCurrentStep(1)
    setSourceOption(null)
    updateHistoryState(1, null)
  }, [updateHistoryState])

  const updateFormData = useCallback(
    (updates: Partial<RecipeFormData>) => {
      setFormData((prev) => ({ ...prev, ...updates }))
    },
    []
  )

  // Transform form data for submission
  const transformIngredientsToInlineFormat = useCallback(
    (
      ingredients: RecipeFormData["ingredients"],
      groups: RecipeFormData["ingredientGroups"]
    ) => {
      const result: Array<
        | { group: string }
        | { name: string; measurement: string; quantity: string }
      > = []
      const groupMap = new Map(groups.map((g) => [g.id, g.name]))
      let lastGroupId: string | null = null

      ingredients.forEach((ingredient) => {
        const currentGroupId = ingredient.group_id || null

        if (currentGroupId && currentGroupId !== lastGroupId) {
          const groupName = groupMap.get(currentGroupId) || "Grupp"
          result.push({ group: groupName })
          lastGroupId = currentGroupId
        } else if (!currentGroupId && lastGroupId !== null) {
          lastGroupId = null
        }

        if (ingredient.name.trim()) {
          result.push({
            name: ingredient.name,
            measurement: ingredient.measurement,
            quantity: ingredient.quantity,
          })
        }
      })

      return result
    },
    []
  )

  const transformInstructionsToInlineFormat = useCallback(
    (
      instructions: RecipeFormData["instructions"],
      groups: RecipeFormData["instructionGroups"]
    ) => {
      const result: Array<{ group: string } | { step: string }> = []
      const groupMap = new Map(groups.map((g) => [g.id, g.name]))
      let lastGroupId: string | null = null

      instructions.forEach((instruction) => {
        const currentGroupId = instruction.group_id || null

        if (currentGroupId && currentGroupId !== lastGroupId) {
          const groupName = groupMap.get(currentGroupId) || "Grupp"
          result.push({ group: groupName })
          lastGroupId = currentGroupId
        } else if (!currentGroupId && lastGroupId !== null) {
          lastGroupId = null
        }

        if (instruction.step.trim()) {
          result.push({ step: instruction.step })
        }
      })

      return result
    },
    []
  )

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Handle image upload if needed
      let finalImage: string | null = formData.image

      if (formData.pendingImageFile) {
        const imageFormData = new FormData()
        imageFormData.append("file", formData.pendingImageFile)
        const response = await fetch("/api/upload", {
          method: "POST",
          body: imageFormData,
        })
        if (response.ok) {
          const data = await response.json()
          finalImage = data.filename
        }
      } else if (
        formData.image?.startsWith("http://") ||
        formData.image?.startsWith("https://")
      ) {
        // Download image from URL via server action
        const { downloadAndSaveImage } = await import("@/lib/actions")
        const result = await downloadAndSaveImage(formData.image)
        if (!("error" in result)) {
          finalImage = result.filename
        }
      }

      const transformedIngredients = transformIngredientsToInlineFormat(
        formData.ingredients,
        formData.ingredientGroups
      )
      const transformedInstructions = transformInstructionsToInlineFormat(
        formData.instructions,
        formData.instructionGroups
      )

      const createData: CreateRecipeInput = {
        recipe_name: formData.name.trim(),
        author: formData.author.trim() || null,
        description: formData.description.trim(),
        url: formData.url.trim() || null,
        recipe_yield: formData.recipeYield || null,
        recipe_yield_name: formData.recipeYieldName.trim() || null,
        prep_time: formData.prepTime.trim()
          ? parseInt(formData.prepTime.trim(), 10)
          : null,
        cook_time: formData.cookTime.trim()
          ? parseInt(formData.cookTime.trim(), 10)
          : null,
        cuisine: formData.cuisine.trim() || null,
        image: finalImage,
        thumbnail: finalImage,
        categories: formData.categories,
        ingredients: transformedIngredients,
        instructions: transformedInstructions,
      }

      const result = await createRecipe(createData)

      if ("error" in result) {
        throw new Error(result.error)
      }

      router.push(`/recept/${result.id}`)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Ett oväntat fel uppstod"
      )
      setIsSubmitting(false)
    }
  }, [formData, router, transformIngredientsToInlineFormat, transformInstructionsToInlineFormat])

  // Validation for each step
  const canProceedStep0 = true // Can always proceed from source (either import or start blank)
  const canProceedStep1 =
    formData.name.trim() !== "" &&
    formData.description.trim() !== "" &&
    formData.ingredients.some((i) => i.name.trim() !== "") &&
    formData.instructions.some((i) => i.step.trim() !== "")

  const canProceed = [canProceedStep0, canProceedStep1][currentStep]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Skapa nytt recept
        </h1>
      </header>

      <Card className="p-6">
        <Stepper
          steps={STEPS}
          currentStep={currentStep}
          onStepChange={handleStepChange}
        >
          <StepperHeader className="mb-8" />

          <StepperContent step={0}>
            <SourceSelectionStep
              onImport={handleImport}
              onStartBlank={handleStartBlank}
              isAdmin={isAdmin(user)}
              selectedOption={sourceOption}
              onOptionChange={handleSourceOptionChange}
            />
          </StepperContent>

          <StepperContent step={1}>
            <BasicDetailsStep
              formData={formData}
              onChange={updateFormData}
            />
            <RecipeContentStep
              formData={formData}
              onChange={updateFormData}
              lowConfidenceIngredients={lowConfidenceIngredients}
              submitError={submitError}
            />
          </StepperContent>

          <WizardNavigation
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            canProceed={canProceed}
            sourceOption={sourceOption}
            onSourceOptionClear={() => handleSourceOptionChange(null)}
          />
        </Stepper>
      </Card>
    </div>
  )
}

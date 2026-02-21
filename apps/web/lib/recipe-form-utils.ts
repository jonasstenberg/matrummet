import { CreateRecipeInput, IngredientGroup, Ingredient, InstructionGroup, Instruction, Recipe } from "@/lib/types"
import { RecipeFormValues } from "@/lib/schemas"
import { ParsedRecipe } from "@/lib/recipe-parser/types"

// Type for import data - union of possible import formats
export type ImportData = Partial<CreateRecipeInput> | ParsedRecipe | {
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
    form?: string
    group_id?: string | null
  }>
  ingredientGroups: Array<{ id: string; name: string }>
  instructions: Array<{ step: string; group_id?: string | null }>
  instructionGroups: Array<{ id: string; name: string }>
  // Original prompt used for AI import (for display and refinement)
  originalPrompt: string | null
}

export const initialFormData: RecipeFormData = {
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
  ingredients: [{ name: "", measurement: "", quantity: "", form: "" }],
  ingredientGroups: [],
  instructions: [{ step: "" }],
  instructionGroups: [],
  originalPrompt: null,
}

function isGroupedFormat(data: ImportData): data is ParsedRecipe {
  return "ingredient_groups" in data && Array.isArray(data.ingredient_groups)
}

export function processIngredients(data: ImportData): {
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

export function processInstructions(data: ImportData): {
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

// Transform ingredients from editor format to API inline format
export function transformIngredientsToInlineFormat(
  ingredients: RecipeFormData["ingredients"],
  groups: RecipeFormData["ingredientGroups"]
): Array<
  | { group: string }
  | { name: string; measurement: string; quantity: string; form?: string }
> {
  const result: Array<
    | { group: string }
    | { name: string; measurement: string; quantity: string; form?: string }
  > = []
  const groupMap = new Map(groups.map((g) => [g.id, g.name]))
  let lastGroupId: string | null = null

  ingredients.forEach((ingredient) => {
    const currentGroupId = ingredient.group_id || null

    // If we encounter a new group, add a group marker
    if (currentGroupId && currentGroupId !== lastGroupId) {
      const groupName = groupMap.get(currentGroupId) ?? "Grupp"
      result.push({ group: groupName })
      lastGroupId = currentGroupId
    } else if (!currentGroupId && lastGroupId !== null) {
      // Transitioning from grouped to ungrouped
      lastGroupId = null
    }

    // Add the ingredient (only if it has a name)
    if (ingredient.name.trim()) {
      result.push({
        name: ingredient.name,
        measurement: ingredient.measurement,
        quantity: ingredient.quantity,
        form: ingredient.form || undefined,
      })
    }
  })

  return result
}

// Transform instructions from editor format to API inline format
export function transformInstructionsToInlineFormat(
  instructions: RecipeFormData["instructions"],
  groups: RecipeFormData["instructionGroups"]
): Array<{ group: string } | { step: string }> {
  const result: Array<{ group: string } | { step: string }> = []
  const groupMap = new Map(groups.map((g) => [g.id, g.name]))
  let lastGroupId: string | null = null

  instructions.forEach((instruction) => {
    const currentGroupId = instruction.group_id || null

    // If we encounter a new group, add a group marker
    if (currentGroupId && currentGroupId !== lastGroupId) {
      const groupName = groupMap.get(currentGroupId) ?? "Grupp"
      result.push({ group: groupName })
      lastGroupId = currentGroupId
    } else if (!currentGroupId && lastGroupId !== null) {
      // Transitioning from grouped to ungrouped
      lastGroupId = null
    }

    // Add the instruction (only if it has a step)
    if (instruction.step.trim()) {
      result.push({ step: instruction.step })
    }
  })

  return result
}

// Convert ImportData to RecipeFormData
export function importDataToFormData(
  data: ImportData,
  lowConfidenceIndices?: number[],
  originalPrompt?: string
): { formData: RecipeFormData; lowConfidenceIngredients: number[] } {
  const { groups: ingredientGroups, items: ingredients } = processIngredients(data)
  const { groups: instructionGroups, items: instructions } = processInstructions(data)

  const formData: RecipeFormData = {
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
    pendingImageFile: null,
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
    originalPrompt: originalPrompt || null,
  }

  return {
    formData,
    lowConfidenceIngredients: lowConfidenceIndices || [],
  }
}

// Type guard functions
function isRecipe(data: Recipe | RecipeFormData): data is Recipe {
  return 'recipe_yield' in data || 'prep_time' in data || 'cook_time' in data
}

function isRecipeFormData(data: Recipe | RecipeFormData | undefined): data is RecipeFormData {
  return data !== undefined && 'recipeYield' in data
}

// Compute default values for react-hook-form from Recipe or RecipeFormData
export function computeDefaultValues(initialData?: Recipe | RecipeFormData): RecipeFormValues {
  // Empty form defaults
  const emptyDefaults: RecipeFormValues = {
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
    categories: [],
    ingredients: [{ name: "", measurement: "", quantity: "", form: "" }],
    ingredientGroups: [],
    instructions: [{ step: "" }],
    instructionGroups: [],
  }

  if (!initialData) return emptyDefaults

  if (isRecipe(initialData)) {
    // Normalize Recipe type (API format) to form values
    // Map ingredients to only include form-expected fields (exclude id, sort_order, food_id, unit_id, in_pantry)
    const mappedIngredients = initialData.ingredients?.length
      ? initialData.ingredients.map((ing) => ({
          name: ing.name || "",
          measurement: ing.measurement || "",
          quantity: ing.quantity || "",
          form: ing.form || undefined,
          group_id: ing.group_id ?? null,
        }))
      : emptyDefaults.ingredients;

    // Map instructions to only include form-expected fields (exclude id, sort_order)
    const mappedInstructions = initialData.instructions?.length
      ? initialData.instructions.map((inst) => ({
          step: inst.step || "",
          group_id: inst.group_id ?? null,
        }))
      : emptyDefaults.instructions;

    return {
      name: initialData.name || "",
      description: initialData.description || "",
      author: initialData.author || "",
      url: initialData.url || "",
      recipeYield: initialData.recipe_yield?.toString() || "",
      recipeYieldName: initialData.recipe_yield_name || "",
      prepTime: initialData.prep_time?.toString() || "",
      cookTime: initialData.cook_time?.toString() || "",
      cuisine: initialData.cuisine || "",
      image: initialData.image || null,
      categories: initialData.categories || [],
      ingredients: mappedIngredients,
      ingredientGroups: initialData.ingredient_groups?.map((g) => ({
        id: g.id!,
        name: g.name,
      })) || [],
      instructions: mappedInstructions,
      instructionGroups: initialData.instruction_groups?.map((g) => ({
        id: g.id!,
        name: g.name,
      })) || [],
    }
  }

  if (isRecipeFormData(initialData)) {
    // RecipeFormData is already in form format
    return {
      name: initialData.name,
      description: initialData.description,
      author: initialData.author,
      url: initialData.url,
      recipeYield: initialData.recipeYield,
      recipeYieldName: initialData.recipeYieldName,
      prepTime: initialData.prepTime,
      cookTime: initialData.cookTime,
      cuisine: initialData.cuisine,
      image: initialData.image,
      categories: initialData.categories,
      ingredients: initialData.ingredients?.length
        ? initialData.ingredients
        : emptyDefaults.ingredients,
      ingredientGroups: initialData.ingredientGroups || [],
      instructions: initialData.instructions?.length
        ? initialData.instructions
        : emptyDefaults.instructions,
      instructionGroups: initialData.instructionGroups || [],
    }
  }

  return emptyDefaults
}

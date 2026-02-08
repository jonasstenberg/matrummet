import { Recipe } from './types'

/**
 * Converts minutes to ISO 8601 duration format (PT#H#M)
 */
function minutesToIsoDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0 && mins > 0) {
    return `PT${hours}H${mins}M`
  } else if (hours > 0) {
    return `PT${hours}H`
  } else {
    return `PT${mins}M`
  }
}

/**
 * Generates JSON-LD structured data for a recipe following schema.org Recipe spec
 * https://schema.org/Recipe
 */
export function generateRecipeJsonLd(
  recipe: Recipe,
  baseUrl: string
): Record<string, unknown> {
  const recipeUrl = `${baseUrl}/recept/${recipe.id}`
  const imageUrl = recipe.image
    ? `${baseUrl}/api/images/${recipe.image.replace(/\.webp$/, '')}/full`
    : undefined

  // Build ingredient strings (combining quantity, measurement, and name)
  const recipeIngredients = recipe.ingredients.map((ing) => {
    const parts = []
    if (ing.quantity) parts.push(ing.quantity)
    if (ing.measurement) parts.push(ing.measurement)
    parts.push(ing.name)
    if (ing.form) parts.push(`(${ing.form})`)
    return parts.join(' ')
  })

  // Build instruction steps as HowToStep objects
  const recipeInstructions = recipe.instructions.map((inst, index) => ({
    '@type': 'HowToStep',
    position: index + 1,
    text: inst.step,
  }))

  // Build yield string
  const recipeYield = recipe.recipe_yield
    ? recipe.recipe_yield_name
      ? `${recipe.recipe_yield} ${recipe.recipe_yield_name}`
      : `${recipe.recipe_yield} portioner`
    : undefined

  // Calculate total time
  const totalMinutes =
    (recipe.prep_time || 0) + (recipe.cook_time || 0)

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.name,
    url: recipeUrl,
  }

  // Add optional fields only if they have values
  if (recipe.description) {
    jsonLd.description = recipe.description
  }

  if (imageUrl) {
    jsonLd.image = imageUrl
  }

  if (recipe.author) {
    jsonLd.author = {
      '@type': 'Person',
      name: recipe.author,
    }
  }

  if (recipe.date_published) {
    jsonLd.datePublished = recipe.date_published
  }

  if (recipe.date_modified) {
    jsonLd.dateModified = recipe.date_modified
  }

  if (recipe.prep_time && recipe.prep_time > 0) {
    jsonLd.prepTime = minutesToIsoDuration(recipe.prep_time)
  }

  if (recipe.cook_time && recipe.cook_time > 0) {
    jsonLd.cookTime = minutesToIsoDuration(recipe.cook_time)
  }

  if (totalMinutes > 0) {
    jsonLd.totalTime = minutesToIsoDuration(totalMinutes)
  }

  if (recipeYield) {
    jsonLd.recipeYield = recipeYield
  }

  if (recipe.categories && recipe.categories.length > 0) {
    jsonLd.recipeCategory = recipe.categories
  }

  if (recipe.cuisine) {
    jsonLd.recipeCuisine = recipe.cuisine
  }

  if (recipeIngredients.length > 0) {
    jsonLd.recipeIngredient = recipeIngredients
  }

  if (recipeInstructions.length > 0) {
    jsonLd.recipeInstructions = recipeInstructions
  }

  return jsonLd
}

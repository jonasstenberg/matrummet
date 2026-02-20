import { load } from "cheerio"
import { JsonLdRecipe, HowToStep } from "./types"

const XOR_KEY = "lkdsoisadfgkljnsdfglaish"

export const PROVECHO_HOSTNAMES = ["www.provecho.co", "provecho.co"] as const

interface ProvechoIngredient {
  text: string
  qty?: number
  unit?: string
}

interface ProvechoDirection {
  text: string
}

interface ProvechoSubRecipe {
  tabname?: string
  ingredients?: ProvechoIngredient[]
  directions?: ProvechoDirection[]
  tools?: unknown[]
}

interface ProvechoRecipe {
  name?: string
  description?: string
  images?: string[]
  totalTime?: string
  timeToCook?: string
  timeToPrep?: string
  authorUsername?: string
  subRecipes?: ProvechoSubRecipe[]
}

function decodeProvechoRecipe(encoded: string): ProvechoRecipe | null {
  try {
    // Provecho encodes: Buffer.from(xorString).toString("base64")
    // where xorString is char-by-char XOR of JSON.stringify(recipe) with key.
    // Decode: base64 → UTF-8 string → char-by-char XOR → JSON.parse
    const decoded = Buffer.from(encoded, "base64").toString()
    const json = Array.from(decoded, (ch, i) =>
      String.fromCharCode(ch.charCodeAt(0) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length))
    ).join("")
    return JSON.parse(json)
  } catch {
    return null
  }
}

function isSectionHeader(text: string): boolean {
  return /:\s*$/.test(text.trim())
}

function formatIngredient(ing: ProvechoIngredient): string | null {
  if (!ing.qty && isSectionHeader(ing.text)) return null
  return [ing.qty && String(ing.qty), ing.unit, ing.text]
    .filter(Boolean)
    .join(" ")
    .trim()
}

function filterDirections(directions: ProvechoDirection[]): ProvechoDirection[] {
  return directions.filter(
    (dir) => dir.text?.trim() && !(isSectionHeader(dir.text) && dir.text.trim().length < 40)
  )
}

function extractRecipeFromHtml(html: string): ProvechoRecipe | null {
  const $ = load(html)
  const nextDataScript = $("#__NEXT_DATA__").html()
  if (!nextDataScript) return null

  try {
    const nextData = JSON.parse(nextDataScript)
    const encoded = nextData?.props?.pageProps?.encodedRecipe as string | undefined
    return encoded ? decodeProvechoRecipe(encoded) : null
  } catch {
    return null
  }
}

/**
 * Extract recipe as readable text for AI translation.
 */
export function extractProvechoRecipeText(html: string): string | null {
  const recipe = extractRecipeFromHtml(html)
  if (!recipe?.name) return null

  const header = [
    `Title: ${recipe.name}`,
    recipe.description && `Description: ${recipe.description}`,
    recipe.authorUsername && `Author: ${recipe.authorUsername}`,
    recipe.images?.[0] && `[Receptbild: ${recipe.images[0]}]`,
    recipe.totalTime && `Total time: ${recipe.totalTime}`,
    recipe.timeToPrep && `Prep time: ${recipe.timeToPrep}`,
    recipe.timeToCook && `Cook time: ${recipe.timeToCook}`,
  ].filter(Boolean)

  const subRecipeSections = (recipe.subRecipes || []).flatMap((sub) => {
    const ingredients = (sub.ingredients || [])
      .map(formatIngredient)
      .filter(Boolean)
      .map((ing) => `- ${ing}`)

    const directions = filterDirections(sub.directions || [])
      .map((dir, i) => `${i + 1}. ${dir.text.trim()}`)

    return ["", "Ingredients:", ...ingredients, "", "Instructions:", ...directions]
  })

  return [...header, ...subRecipeSections].join("\n")
}

/**
 * Extract recipe data from provecho.co HTML as JsonLdRecipe.
 * Used as fallback when AI import fails.
 */
export function extractProvechoRecipe(html: string): JsonLdRecipe | null {
  const recipe = extractRecipeFromHtml(html)
  if (!recipe?.name) return null

  const subs = recipe.subRecipes || []

  const ingredients = subs
    .flatMap((sub) => sub.ingredients || [])
    .map(formatIngredient)
    .filter((s): s is string => s !== null)

  const instructions: HowToStep[] = subs
    .flatMap((sub) => filterDirections(sub.directions || []))
    .map((dir) => ({ "@type": "HowToStep" as const, text: dir.text.trim() }))

  return {
    "@type": "Recipe",
    name: recipe.name,
    description: recipe.description || undefined,
    image: recipe.images?.[0] || undefined,
    author: recipe.authorUsername ? { name: recipe.authorUsername } : undefined,
    totalTime: recipe.totalTime || undefined,
    cookTime: recipe.timeToCook || undefined,
    prepTime: recipe.timeToPrep || undefined,
    recipeIngredient: ingredients.length > 0 ? ingredients : undefined,
    recipeInstructions: instructions.length > 0 ? instructions : undefined,
  }
}

import type { CreateRecipeInput } from '@/lib/types'
import { createMistralClient, MISTRAL_MODEL } from '@/lib/ai-client'

/**
 * Heuristic check for whether text is likely Swedish.
 * Looks for Swedish-specific characters and common words.
 */
function isLikelySwedish(text: string): boolean {
  const lower = text.toLowerCase()

  // Check for Swedish characters
  const hasSwedishChars = /[åäö]/.test(lower)

  // Common Swedish words that are unlikely in other languages
  const swedishWords = [
    'och', 'med', 'eller', 'som', 'för', 'till', 'från',
    'på', 'av', 'det', 'den', 'ett', 'en', 'är', 'var',
    'ska', 'kan', 'inte', 'att', 'har', 'hade', 'blev',
    'tsk', 'msk', 'krm', 'klyfta', 'matsked', 'tesked',
    'grädde', 'smör', 'mjölk', 'ström', 'häll', 'stek',
  ]
  const wordRegex = new RegExp(`(?<=\\s|^)(${swedishWords.join('|')})(?=\\s|$|[,.;:!?])`)
  const hasSwedishWords = wordRegex.test(lower)

  return hasSwedishChars && hasSwedishWords
}

/**
 * Collect translatable text from a recipe to determine language
 * and to send for translation.
 */
function collectRecipeText(recipe: Partial<CreateRecipeInput>): string {
  const parts: string[] = []
  if (recipe.recipe_name) parts.push(recipe.recipe_name)
  if (recipe.description) parts.push(recipe.description)
  if (recipe.ingredients) {
    for (const ing of recipe.ingredients) {
      if ('name' in ing) parts.push(ing.name)
      if ('group' in ing) parts.push(ing.group)
    }
  }
  if (recipe.instructions) {
    for (const inst of recipe.instructions) {
      if ('step' in inst) parts.push(inst.step)
      if ('group' in inst) parts.push(inst.group)
    }
  }
  return parts.join(' ')
}

const TRANSLATION_SCHEMA = {
  type: 'object' as const,
  properties: {
    recipe_name: { type: 'string' as const },
    description: { type: 'string' as const },
    ingredients: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          type: { type: 'string' as const, enum: ['group', 'ingredient'] },
          group: { type: 'string' as const },
          name: { type: 'string' as const },
          measurement: { type: 'string' as const },
        },
        required: ['type'] as const,
      },
    },
    instructions: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          type: { type: 'string' as const, enum: ['group', 'step'] },
          text: { type: 'string' as const },
        },
        required: ['type', 'text'] as const,
      },
    },
  },
  required: ['recipe_name', 'description', 'ingredients', 'instructions'] as const,
}

interface TranslationResult {
  recipe_name: string
  description: string
  ingredients: Array<
    | { type: 'group'; group: string }
    | { type: 'ingredient'; name: string; measurement: string }
  >
  instructions: Array<{ type: 'group' | 'step'; text: string }>
}

/**
 * Translate a recipe to Swedish using Mistral AI.
 * Returns the original recipe unchanged if it's already Swedish or on failure.
 */
export async function translateRecipeToSwedish(
  recipe: Partial<CreateRecipeInput>,
): Promise<Partial<CreateRecipeInput>> {
  const text = collectRecipeText(recipe)
  if (!text || isLikelySwedish(text)) {
    return recipe
  }

  // Build a compact representation for translation
  const ingredientItems = (recipe.ingredients ?? []).map((ing) => {
    if ('group' in ing) return { type: 'group' as const, group: ing.group, name: '', measurement: '' }
    return { type: 'ingredient' as const, group: '', name: ing.name, measurement: ing.measurement }
  })

  const instructionItems = (recipe.instructions ?? []).map((inst) => {
    if ('group' in inst) return { type: 'group' as const, text: inst.group }
    return { type: 'step' as const, text: inst.step }
  })

  const inputData = {
    recipe_name: recipe.recipe_name ?? '',
    description: recipe.description ?? '',
    ingredients: ingredientItems,
    instructions: instructionItems,
  }

  try {
    const client = createMistralClient()
    const response = await client.chat.complete({
      model: MISTRAL_MODEL,
      messages: [
        {
          role: 'system',
          content: `Du är en översättare som översätter recept till svenska. Översätt ALL text till idiomatisk svenska.
Regler:
- Översätt receptnamn, beskrivning, ingrediensnamn, gruppnamn och instruktionssteg
- Använd svenska måttenheter (dl, msk, tsk, krm, g, kg, ml, l, st)
- Konvertera cups/tablespoons/teaspoons till svenska enheter (1 cup ≈ 2.5 dl, 1 tbsp = 1 msk, 1 tsp = 1 tsk)
- Behåll originalnamnet i parentes för svåröversatta utländska namn (t.ex. "Bouillabaisse")
- Ändra INTE strukturen, bara översätt texten
- Behåll fältet "type" exakt som det är`,
        },
        {
          role: 'user',
          content: `Översätt detta recept till svenska:\n${JSON.stringify(inputData)}`,
        },
      ],
      responseFormat: {
        type: 'json_schema',
        jsonSchema: {
          name: 'translated_recipe',
          schemaDefinition: TRANSLATION_SCHEMA,
          strict: true,
        },
      },
    })

    const content = response.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') return recipe

    const translated: TranslationResult = JSON.parse(content)

    // Apply translations back to the recipe
    const result: Partial<CreateRecipeInput> = { ...recipe }

    if (translated.recipe_name) result.recipe_name = translated.recipe_name
    if (translated.description) result.description = translated.description

    if (recipe.ingredients && translated.ingredients?.length === recipe.ingredients.length) {
      result.ingredients = recipe.ingredients.map((ing, i) => {
        const t = translated.ingredients[i]
        if ('group' in ing) {
          return { group: t.type === 'group' && t.group ? t.group : ing.group }
        }
        return {
          ...ing,
          name: t.type === 'ingredient' && t.name ? t.name : ing.name,
          measurement: t.type === 'ingredient' && t.measurement ? t.measurement : ing.measurement,
        }
      })
    }

    if (recipe.instructions && translated.instructions?.length === recipe.instructions.length) {
      result.instructions = recipe.instructions.map((inst, i) => {
        const t = translated.instructions[i]
        if ('group' in inst) {
          return { group: t.type === 'group' ? t.text : inst.group }
        }
        return { step: t.type === 'step' ? t.text : inst.step }
      })
    }

    return result
  } catch {
    // Graceful degradation: return original on any failure
    return recipe
  }
}

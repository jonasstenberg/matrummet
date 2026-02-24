import type { Recipe } from './types'

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} tim ${m} min` : `${h} tim`
}

export function recipeToMarkdown(recipe: Recipe): string {
  const lines: string[] = []

  lines.push(`# ${recipe.name}`)
  lines.push('')

  if (recipe.description) {
    lines.push(recipe.description)
    lines.push('')
  }

  // Metadata table
  const meta: [string, string][] = []
  if (recipe.recipe_yield) {
    const yieldName = recipe.recipe_yield_name || 'portioner'
    meta.push(['Portioner', `${recipe.recipe_yield} ${yieldName}`])
  }
  if (recipe.prep_time) {
    meta.push(['Förberedningstid', formatTime(recipe.prep_time)])
  }
  if (recipe.cook_time) {
    meta.push(['Tillagningstid', formatTime(recipe.cook_time)])
  }
  if (recipe.categories && recipe.categories.length > 0) {
    meta.push(['Kategorier', recipe.categories.join(', ')])
  }

  if (meta.length > 0) {
    lines.push('| | |')
    lines.push('|---|---|')
    for (const [label, value] of meta) {
      lines.push(`| ${label} | ${value} |`)
    }
    lines.push('')
  }

  // Ingredients
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    lines.push('## Ingredienser')
    lines.push('')

    // Build group map
    const groupMap = new Map<string | null, typeof recipe.ingredients>()
    for (const ing of recipe.ingredients) {
      const groupId = ing.group_id ?? null
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, [])
      }
      groupMap.get(groupId)!.push(ing)
    }

    const groupNames = new Map<string, string>()
    if (recipe.ingredient_groups) {
      for (const g of recipe.ingredient_groups) {
        if (g.id) groupNames.set(g.id, g.name)
      }
    }

    for (const [groupId, ingredients] of groupMap) {
      if (groupId && groupNames.has(groupId)) {
        lines.push(`### ${groupNames.get(groupId)}`)
        lines.push('')
      }

      for (const ing of ingredients) {
        const parts: string[] = []
        if (ing.quantity && ing.quantity !== '0') parts.push(ing.quantity)
        if (ing.measurement) parts.push(ing.measurement)
        parts.push(ing.name)
        if (ing.form) parts.push(`(${ing.form})`)
        lines.push(`- ${parts.join(' ')}`)
      }
      lines.push('')
    }
  }

  // Instructions
  if (recipe.instructions && recipe.instructions.length > 0) {
    lines.push('## Instruktioner')
    lines.push('')

    const groupMap = new Map<string | null, typeof recipe.instructions>()
    for (const inst of recipe.instructions) {
      const groupId = inst.group_id ?? null
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, [])
      }
      groupMap.get(groupId)!.push(inst)
    }

    const groupNames = new Map<string, string>()
    if (recipe.instruction_groups) {
      for (const g of recipe.instruction_groups) {
        if (g.id) groupNames.set(g.id, g.name)
      }
    }

    for (const [groupId, instructions] of groupMap) {
      if (groupId && groupNames.has(groupId)) {
        lines.push(`### ${groupNames.get(groupId)}`)
        lines.push('')
      }

      instructions.forEach((inst, i) => {
        lines.push(`${i + 1}. ${inst.step}`)
      })
      lines.push('')
    }
  }

  return lines.join('\n').trimEnd()
}

export function recipesToMarkdown(recipes: Recipe[]): string {
  const date = new Date().toLocaleDateString('sv-SE')
  const header = `# Mina recept\n\nExporterad ${date} — ${recipes.length} recept\n`

  if (recipes.length === 0) {
    return header
  }

  const recipesMd = recipes.map(recipeToMarkdown).join('\n\n---\n\n')
  return `${header}\n---\n\n${recipesMd}\n`
}

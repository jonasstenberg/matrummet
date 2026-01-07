import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { GoogleGenAI } from '@google/genai'

const GEMINI_MODEL = 'gemini-2.5-flash'
const AI_BATCH_SIZE = 20 // Items per AI call
const REQUEST_LIMIT = 50 // Items per HTTP request

interface PendingFood {
  id: string
  name: string
  created_by: string
  date_published: string
}

interface AINormalizationResult {
  normalizedName: string | null
  quantity: number | null
  unit: string | null
  isGibberish: boolean
}

interface ReviewDetail {
  foodName: string
  normalizedTo: string | null
  action: 'linked' | 'created' | 'rejected' | 'deleted'
  linkedToFoodId?: string
}

interface ReviewSummary {
  totalProcessed: number
  normalized: number
  created: number
  rejected: number
  deleted: number
  ingredientsUpdated: number
  recipesAffected: number
  details: ReviewDetail[]
}

interface ExistingFood {
  id: string
  name: string
}

/**
 * Authenticate request via session or cron secret
 */
async function authenticateRequest(
  request: NextRequest
): Promise<{ authorized: boolean; email: string | null; error?: string }> {
  // Check for cron secret header
  const cronSecret = request.headers.get('X-Cron-Secret')
  if (cronSecret && env.CRON_SECRET && cronSecret === env.CRON_SECRET) {
    return { authorized: true, email: 'system@cron.local' }
  }

  // Fall back to session-based auth
  const session = await getSession()

  if (!session) {
    return { authorized: false, email: null, error: 'Unauthorized' }
  }

  if (session.role !== 'admin') {
    return { authorized: false, email: null, error: 'Forbidden' }
  }

  return { authorized: true, email: session.email }
}

/**
 * Call Gemini AI to normalize food names
 */
async function normalizeFoodsWithAI(
  ai: GoogleGenAI,
  foods: PendingFood[]
): Promise<AINormalizationResult[]> {
  if (foods.length === 0) {
    return []
  }

  const foodsList = foods.map((f, i) => `${i + 1}. "${f.name}"`).join('\n')

  const prompt = `Du hjälper till att normalisera livsmedelsnamn i en svensk receptdatabas.

För varje livsmedelsnamn:
1. Ta bort tillagningsinstruktioner (hackad, riven, hel, halv, strimlad, tärnad, skivad, malen, krossad, pressad, färsk, fryst, torkad, finriven, grovhackad, finhackad, rumstempererad, smält, kokta, stekt, urkärnad, skalad, delad, etc.)
2. Ta bort mängdangivelser som "(70g)", "2 dl", "ca 100g" etc. och extrahera dem separat
3. Returnera det normaliserade basnamnet med stor första bokstav

Exempel:
- "Schalottenlök, finhackad" -> { "normalizedName": "Schalottenlök", "quantity": null, "unit": null, "isGibberish": false }
- "Hel fresnopeppar" -> { "normalizedName": "Fresnopeppar", "quantity": null, "unit": null, "isGibberish": false }
- "Muskotnöt, halv" -> { "normalizedName": "Muskotnöt", "quantity": null, "unit": null, "isGibberish": false }
- "finrivna morötter (70g)" -> { "normalizedName": "Morötter", "quantity": 70, "unit": "g", "isGibberish": false }
- "smör, rumstempererat" -> { "normalizedName": "Smör", "quantity": null, "unit": null, "isGibberish": false }
- "asdfghjk" -> { "normalizedName": null, "quantity": null, "unit": null, "isGibberish": true }
- "2 dl vatten" -> { "normalizedName": "Vatten", "quantity": 2, "unit": "dl", "isGibberish": false }

Livsmedel att normalisera:
${foodsList}

Svara med JSON-array (samma ordning):
[
  { "normalizedName": "...", "quantity": null, "unit": null, "isGibberish": false },
  ...
]

Svara ENDAST med JSON-arrayen, ingen annan text.`

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })

  const text = response.text
  if (!text) {
    throw new Error('No response from AI')
  }

  // Parse JSON array from response (handle potential markdown code blocks)
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('No JSON array found in AI response')
  }

  const parsed = JSON.parse(jsonMatch[0]) as AINormalizationResult[]

  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array')
  }

  if (parsed.length !== foods.length) {
    throw new Error(`AI returned ${parsed.length} results but expected ${foods.length}`)
  }

  // Validate and normalize each result
  for (let i = 0; i < parsed.length; i++) {
    const result = parsed[i]
    // Ensure fields exist with defaults
    if (result.normalizedName === undefined) result.normalizedName = null
    if (result.quantity === undefined) result.quantity = null
    if (result.unit === undefined) result.unit = null
    if (result.isGibberish === undefined) result.isGibberish = false
  }

  return parsed
}

/**
 * Find existing approved food by normalized name (case-insensitive)
 */
async function findExistingFood(
  token: string,
  normalizedName: string
): Promise<ExistingFood | null> {
  const response = await fetch(
    `${env.POSTGREST_URL}/foods?name=ilike.${encodeURIComponent(normalizedName)}&status=eq.approved&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  if (!response.ok) {
    return null
  }

  const foods: ExistingFood[] = await response.json()
  return foods.length > 0 ? foods[0] : null
}

/**
 * Create a new food with approved status
 */
async function createApprovedFood(
  token: string,
  name: string
): Promise<ExistingFood | null> {
  // First check if it already exists to avoid duplicate key error
  const existing = await findExistingFood(token, name)
  if (existing) {
    return existing
  }

  const response = await fetch(`${env.POSTGREST_URL}/foods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      name: name.trim(),
      status: 'approved',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    // If it's a duplicate key error, try to find and return the existing one
    if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
      return findExistingFood(token, name)
    }
    console.error('Failed to create food:', errorText)
    return null
  }

  const created: ExistingFood[] = await response.json()
  return created.length > 0 ? created[0] : null
}

/**
 * Approve a pending food directly (update status to approved)
 */
async function approvePendingFood(
  token: string,
  foodId: string,
  reviewerEmail: string
): Promise<boolean> {
  const response = await fetch(`${env.POSTGREST_URL}/rpc/apply_ai_food_review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      p_food_id: foodId,
      p_decision: 'approved',
      p_confidence: 1.0,
      p_reasoning: 'Godkänt som nytt livsmedel',
      p_suggested_merge_id: null,
      p_reviewer_email: reviewerEmail,
    }),
  })
  return response.ok
}

/**
 * Find a similar approved food using fuzzy matching
 */
async function findSimilarFood(token: string, name: string): Promise<ExistingFood | null> {
  // Try progressively looser matching
  const searchTerms = [
    name, // exact
    name.replace(/or$|ar$|er$|en$|na$|orna$|arna$|erna$/, ''), // remove Swedish plural suffixes
    name.split(' ')[0], // first word only
  ]

  for (const term of searchTerms) {
    if (term.length < 3) continue

    const response = await fetch(
      `${env.POSTGREST_URL}/foods?name=ilike.*${encodeURIComponent(term)}*&status=eq.approved&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (response.ok) {
      const foods: ExistingFood[] = await response.json()
      if (foods.length > 0) {
        return foods[0]
      }
    }
  }

  return null
}

/**
 * Delete a pending food that's not used in any recipes
 */
async function deletePendingFood(token: string, foodId: string): Promise<boolean> {
  const response = await fetch(`${env.POSTGREST_URL}/foods?id=eq.${foodId}&status=eq.pending`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.ok
}

/**
 * Reject a pending food and optionally link its ingredients to merge target
 */
async function rejectPendingFood(
  token: string,
  foodId: string,
  reasoning: string,
  mergeTargetId: string | null,
  reviewerEmail: string
): Promise<boolean> {
  const response = await fetch(`${env.POSTGREST_URL}/rpc/apply_ai_food_review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      p_food_id: foodId,
      p_decision: 'rejected',
      p_confidence: 1.0,
      p_reasoning: reasoning,
      p_suggested_merge_id: mergeTargetId,
      p_reviewer_email: reviewerEmail,
    }),
  })

  return response.ok
}

/**
 * Get ingredients linked to a pending food and update quantity/unit if provided.
 * Note: The actual food_id reassignment happens in apply_ai_food_review when rejecting with merge target.
 */
async function getIngredientsAndUpdateMeasurements(
  token: string,
  pendingFoodId: string,
  quantity: number | null,
  unit: string | null
): Promise<{ ingredientsUpdated: number; recipesAffected: string[] }> {
  // First, get the ingredients that will be affected
  const ingredientsResponse = await fetch(
    `${env.POSTGREST_URL}/ingredients?food_id=eq.${pendingFoodId}&select=id,recipe_id`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  if (!ingredientsResponse.ok) {
    return { ingredientsUpdated: 0, recipesAffected: [] }
  }

  const ingredients: { id: string; recipe_id: string }[] = await ingredientsResponse.json()

  if (ingredients.length === 0) {
    return { ingredientsUpdated: 0, recipesAffected: [] }
  }

  // Collect unique recipe IDs
  const recipeIds = [...new Set(ingredients.map((i) => i.recipe_id))]

  // Update ingredients to point to target food
  // Note: apply_ai_food_review already moves ingredients when rejecting with merge target
  // But we may need to update quantity/unit if AI extracted them

  const ingredientsUpdated = ingredients.length

  // If we have quantity/unit from AI, update the ingredients
  if (quantity !== null || unit !== null) {
    for (const ing of ingredients) {
      const updateBody: Record<string, unknown> = {}
      if (quantity !== null) {
        updateBody.quantity = String(quantity)
      }
      if (unit !== null) {
        updateBody.measurement = unit
      }

      if (Object.keys(updateBody).length > 0) {
        await fetch(`${env.POSTGREST_URL}/ingredients?id=eq.${ing.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updateBody),
        })
      }
    }
  }

  return { ingredientsUpdated, recipesAffected: recipeIds }
}

export async function POST(request: NextRequest) {
  // Authenticate first
  const auth = await authenticateRequest(request)
  if (!auth.authorized || !auth.email) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: auth.error === 'Forbidden' ? 403 : 401 }
    )
  }

  // Check for Gemini API key
  if (!env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API not configured' }, { status: 503 })
  }

  // Parse request body for optional limit
  let requestLimit = REQUEST_LIMIT
  try {
    const body = await request.json().catch(() => ({}))
    if (body.limit && typeof body.limit === 'number' && body.limit > 0) {
      requestLimit = Math.min(body.limit, 200) // Cap at 200 per request
    }
  } catch {
    // Use default limit
  }

  try {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! })
    const token = await signPostgrestToken(auth.email!)

    // Fetch pending foods with limit
    const pendingResponse = await fetch(`${env.POSTGREST_URL}/rpc/get_pending_foods_for_review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_limit: requestLimit + 1 }), // +1 to check if more exist
    })

    if (!pendingResponse.ok) {
      const errorText = await pendingResponse.text()
      throw new Error(`Failed to fetch pending foods: ${errorText}`)
    }

    const allPendingFoods: PendingFood[] = await pendingResponse.json()
    console.log(`[AI Review] Fetched ${allPendingFoods.length} pending foods for user ${auth.email}`)
    const hasMoreFoods = allPendingFoods.length > requestLimit
    const pendingFoods = allPendingFoods.slice(0, requestLimit)

    // Initialize summary for this batch
    const summary: ReviewSummary = {
      totalProcessed: 0,
      normalized: 0,
      created: 0,
      rejected: 0,
      deleted: 0,
      ingredientsUpdated: 0,
      recipesAffected: 0,
      details: [],
    }

    const allAffectedRecipeIds = new Set<string>()

    // Process foods in AI batches
    for (let batchStart = 0; batchStart < pendingFoods.length; batchStart += AI_BATCH_SIZE) {
      const batch = pendingFoods.slice(batchStart, batchStart + AI_BATCH_SIZE)

      try {
        // Call AI to normalize the batch
        const normalizations = await normalizeFoodsWithAI(ai, batch)
        console.log(`[AI Review] AI returned ${normalizations.length} normalizations for batch of ${batch.length}`)

        // Process each food in the batch
        for (let i = 0; i < batch.length; i++) {
          const food = batch[i]
          const norm = normalizations[i]

          // Log first few items for debugging
          if (summary.totalProcessed < 3) {
            console.log(`[AI Review] Item ${summary.totalProcessed}: "${food.name}" -> normalized="${norm.normalizedName}", gibberish=${norm.isGibberish}`)
          }

          summary.totalProcessed++

          // Handle gibberish
          if (norm.isGibberish || !norm.normalizedName) {
            const rejected = await rejectPendingFood(
              token,
              food.id,
              'Ogiltigt livsmedelsnamn (skräptext)',
              null,
              auth.email!
            )

            if (rejected) {
              summary.rejected++
              summary.details.push({
                foodName: food.name,
                normalizedTo: null,
                action: 'rejected',
              })
            }
            continue
          }

          // Search for existing approved food with normalized name
          const existingFood = await findExistingFood(token, norm.normalizedName)

          // Check if this food is used in any recipes
          const { ingredientsUpdated, recipesAffected } = await getIngredientsAndUpdateMeasurements(
            token,
            food.id,
            norm.quantity,
            norm.unit
          )

          // If food is not used in any recipes, just delete it
          if (ingredientsUpdated === 0) {
            const wasDeleted = await deletePendingFood(token, food.id)
            if (summary.totalProcessed <= 3) {
              console.log(`[AI Review] Item "${food.name}": no ingredients, delete result=${wasDeleted}`)
            }
            if (wasDeleted) {
              summary.deleted++
              summary.details.push({
                foodName: food.name,
                normalizedTo: null,
                action: 'deleted',
              })
            }
            continue
          }

          if (existingFood) {
            // Link ingredients to existing food and reject the pending one
            const rejected = await rejectPendingFood(
              token,
              food.id,
              `Normaliserat till befintligt livsmedel: ${existingFood.name}`,
              existingFood.id,
              auth.email!
            )

            if (rejected) {
              summary.normalized++
              summary.ingredientsUpdated += ingredientsUpdated
              recipesAffected.forEach((id: string) => allAffectedRecipeIds.add(id))
              summary.details.push({
                foodName: food.name,
                normalizedTo: existingFood.name,
                action: 'linked',
                linkedToFoodId: existingFood.id,
              })
            }
          } else {
            // If normalized name is same as original (case-insensitive), approve the pending food directly
            if (norm.normalizedName.toLowerCase() === food.name.toLowerCase()) {
              const approved = await approvePendingFood(token, food.id, auth.email!)
              if (approved) {
                summary.created++
                summary.details.push({
                  foodName: food.name,
                  normalizedTo: food.name,
                  action: 'created',
                })
              }
            } else {
              // Try to create new food with normalized name
              const newFood = await createApprovedFood(token, norm.normalizedName)

              if (newFood) {
                // Reject the pending food and link ingredients to the new one
                const rejected = await rejectPendingFood(
                  token,
                  food.id,
                  `Skapat nytt livsmedel med normaliserat namn: ${newFood.name}`,
                  newFood.id,
                  auth.email!
                )

                if (rejected) {
                  summary.created++
                  summary.normalized++
                  summary.ingredientsUpdated += ingredientsUpdated
                  recipesAffected.forEach((id: string) => allAffectedRecipeIds.add(id))
                  summary.details.push({
                    foodName: food.name,
                    normalizedTo: newFood.name,
                    action: 'created',
                    linkedToFoodId: newFood.id,
                  })
                }
              } else {
                // Failed to create - try fuzzy search for a similar approved food
                const similarFood = await findSimilarFood(token, norm.normalizedName)

                if (similarFood) {
                  // Found similar food - link to it
                  const rejected = await rejectPendingFood(
                    token,
                    food.id,
                    `Länkat till liknande livsmedel: ${similarFood.name}`,
                    similarFood.id,
                    auth.email!
                  )

                  if (rejected) {
                    summary.normalized++
                    summary.ingredientsUpdated += ingredientsUpdated
                    recipesAffected.forEach((id: string) => allAffectedRecipeIds.add(id))
                    summary.details.push({
                      foodName: food.name,
                      normalizedTo: similarFood.name,
                      action: 'linked',
                      linkedToFoodId: similarFood.id,
                    })
                  }
                } else {
                  // No similar food found - approve the pending food as-is
                  const approved = await approvePendingFood(token, food.id, auth.email!)
                  if (approved) {
                    summary.created++
                    summary.details.push({
                      foodName: food.name,
                      normalizedTo: food.name,
                      action: 'created',
                    })
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`[AI Review] AI batch normalization FAILED for batch starting at ${batchStart}:`, error)
        // Skip this batch but continue with next
        summary.totalProcessed += batch.length
      }
      console.log(`[AI Review] Batch ${batchStart} done. Stats so far: processed=${summary.totalProcessed}, created=${summary.created}, normalized=${summary.normalized}, rejected=${summary.rejected}, deleted=${summary.deleted}`)
    }

    // =========================================================================
    // PHASE 2: Link orphaned ingredients (only if no more pending foods)
    // =========================================================================
    let hasMoreOrphans = false

    if (!hasMoreFoods) {
      const orphanedResponse = await fetch(
        `${env.POSTGREST_URL}/rpc/get_orphaned_ingredient_names`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ p_limit: requestLimit + 1 }),
        }
      )

      if (orphanedResponse.ok) {
        const allOrphanedNames: { ingredient_name: string; ingredient_count: number }[] =
          await orphanedResponse.json()

        hasMoreOrphans = allOrphanedNames.length > requestLimit
        const orphanedNames = allOrphanedNames.slice(0, requestLimit)

        for (const orphan of orphanedNames) {
          // Try to find matching approved food (exact match first)
          let matchingFood = await findExistingFood(token, orphan.ingredient_name)

          // If no exact match, try fuzzy search
          if (!matchingFood) {
            matchingFood = await findSimilarFood(token, orphan.ingredient_name)
          }

          if (matchingFood) {
            // Link all ingredients with this name to the food
            const linkResponse = await fetch(
              `${env.POSTGREST_URL}/rpc/link_ingredients_to_food`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  p_ingredient_name: orphan.ingredient_name,
                  p_food_id: matchingFood.id,
                }),
              }
            )

            if (linkResponse.ok) {
              const linkedCount = await linkResponse.json()
              if (linkedCount > 0) {
                summary.normalized++
                summary.ingredientsUpdated += linkedCount
                summary.details.push({
                  foodName: orphan.ingredient_name,
                  normalizedTo: matchingFood.name,
                  action: 'linked',
                  linkedToFoodId: matchingFood.id,
                })
              }
            }
          }
        }
      }
    }

    // Update recipes affected count
    summary.recipesAffected = allAffectedRecipeIds.size

    // Return result with continuation info
    return NextResponse.json({
      ...summary,
      hasMore: hasMoreFoods || hasMoreOrphans,
      phase: hasMoreFoods ? 'foods' : 'orphans',
    })
  } catch (error) {
    console.error('AI review error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

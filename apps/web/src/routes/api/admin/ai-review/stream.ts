import { timingSafeEqual } from 'crypto'
import { createFileRoute } from '@tanstack/react-router'
import { getSession, signPostgrestToken, signSystemPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { createMistralClient, MISTRAL_MODEL } from '@/lib/ai-client'
import { Mistral } from '@mistralai/mistralai'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:admin:ai-review-stream' })

const AI_BATCH_SIZE = 20
const DEFAULT_LIMIT = 500
const STUCK_RUN_TIMEOUT_MS = 10 * 60 * 1000

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

interface ExistingFood {
  id: string
  name: string
}

interface Suggestion {
  food_id: string
  food_name: string
  suggested_action: 'alias' | 'create' | 'reject' | 'delete'
  target_food_id: string | null
  target_food_name: string | null
  extracted_unit: string | null
  extracted_quantity: number | null
  ai_reasoning: string
  ingredient_count: number
}

async function authenticateRequest(
  request: Request
): Promise<{ authorized: boolean; email: string | null; role?: 'user' | 'admin'; error?: string }> {
  const cronSecret = request.headers.get('X-Cron-Secret')
  if (cronSecret && env.CRON_SECRET) {
    const a = Buffer.from(cronSecret)
    const b = Buffer.from(env.CRON_SECRET)
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return { authorized: true, email: null, role: 'admin' }
    }
  }

  const session = await getSession()
  if (!session) return { authorized: false, email: null, error: 'Unauthorized' }
  if (session.role !== 'admin') return { authorized: false, email: null, error: 'Forbidden' }
  return { authorized: true, email: session.email, role: session.role }
}

async function normalizeFoodsWithAI(
  client: Mistral,
  foods: PendingFood[]
): Promise<AINormalizationResult[]> {
  if (foods.length === 0) return []

  const foodsList = foods.map((f, i) => `${i + 1}. "${f.name}"`).join('\n')

  const prompt = `Du hjälper till att normalisera livsmedelsnamn i en svensk receptdatabas.

För varje livsmedelsnamn:
1. Ta bort tillagningsinstruktioner (hackad, riven, hel, halv, strimlad, tärnad, skivad, malen, krossad, pressad, färsk, fryst, torkad, finriven, grovhackad, finhackad, rumstempererad, smält, kokta, stekt, urkärnad, skalad, delad, etc.)
2. Extrahera mängdangivelser ("2 dl", "70g", "ca 100g") OCH förpacknings-/enhetsord (burk, burkar, påse, klyfta, skiva, skivor, knippe, näve, bit, bitar, förpackning, paket, flaska) som unit.
3. Returnera det normaliserade basnamnet med stor första bokstav.

Exempel:
- "Schalottenlök, finhackad" -> { "normalizedName": "Schalottenlök", "quantity": null, "unit": null, "isGibberish": false }
- "finrivna morötter (70g)" -> { "normalizedName": "Morötter", "quantity": 70, "unit": "g", "isGibberish": false }
- "smör, rumstempererat" -> { "normalizedName": "Smör", "quantity": null, "unit": null, "isGibberish": false }
- "asdfghjk" -> { "normalizedName": null, "quantity": null, "unit": null, "isGibberish": true }
- "2 dl vatten" -> { "normalizedName": "Vatten", "quantity": 2, "unit": "dl", "isGibberish": false }
- "burk tomater" -> { "normalizedName": "Tomater", "quantity": null, "unit": "burk", "isGibberish": false }
- "burkar tonfisk i olja" -> { "normalizedName": "Tonfisk", "quantity": null, "unit": "burk", "isGibberish": false }
- "klyfta vitlök" -> { "normalizedName": "Vitlök", "quantity": null, "unit": "klyfta", "isGibberish": false }

Livsmedel att normalisera:
${foodsList}

Svara med JSON-array (samma ordning):
[
  { "normalizedName": "...", "quantity": null, "unit": null, "isGibberish": false },
  ...
]

Svara ENDAST med JSON-arrayen, ingen annan text.`

  const response = await client.chat.complete({
    model: MISTRAL_MODEL,
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  })

  const text = response.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string') throw new Error('No response from AI')

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('No JSON array found in AI response')

  const parsed = JSON.parse(jsonMatch[0]) as AINormalizationResult[]
  if (!Array.isArray(parsed)) throw new Error('AI response is not an array')
  if (parsed.length !== foods.length) {
    throw new Error(`AI returned ${parsed.length} results but expected ${foods.length}`)
  }

  for (const result of parsed) {
    if (result.normalizedName === undefined) result.normalizedName = null
    if (result.quantity === undefined) result.quantity = null
    if (result.unit === undefined) result.unit = null
    if (result.isGibberish === undefined) result.isGibberish = false
    result.quantity = parseQuantity(result.quantity)
  }

  return parsed
}

/** Convert AI quantity values (fractions, strings) to a numeric value */
function parseQuantity(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return value
  const s = String(value).trim()
  if (!s) return null
  // Handle fractions like "1/2", "3/4"
  const fractionMatch = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1], 10)
    const den = parseInt(fractionMatch[2], 10)
    return den !== 0 ? num / den : null
  }
  // Handle mixed fractions like "1 1/2"
  const mixedMatch = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10)
    const num = parseInt(mixedMatch[2], 10)
    const den = parseInt(mixedMatch[3], 10)
    return den !== 0 ? whole + num / den : null
  }
  const parsed = parseFloat(s)
  return isNaN(parsed) ? null : parsed
}

async function findExistingFood(
  token: string,
  normalizedName: string
): Promise<ExistingFood | null> {
  const response = await fetch(
    `${env.POSTGREST_URL}/foods?name=ilike.${encodeURIComponent(normalizedName)}&status=eq.approved&canonical_food_id=is.null&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!response.ok) return null
  const foods: ExistingFood[] = await response.json()
  return foods.length > 0 ? foods[0] : null
}

async function countIngredients(token: string, foodId: string): Promise<number> {
  const response = await fetch(
    `${env.POSTGREST_URL}/ingredients?food_id=eq.${foodId}&select=id`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    }
  )
  if (!response.ok) return 0
  const range = response.headers.get('content-range')
  if (!range) return 0
  const match = range.match(/\/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

async function saveBatch(
  token: string,
  runId: string,
  suggestions: Suggestion[],
  totalProcessed: number
) {
  if (suggestions.length > 0) {
    const rows = suggestions.map(s => ({ run_id: runId, ...s }))
    const insertRes = await fetch(`${env.POSTGREST_URL}/ai_review_suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(rows),
    })
    if (!insertRes.ok) {
      const errText = await insertRes.text()
      logger.error({ responseBody: errText, runId }, 'Failed to store batch')
    }
  }

  await fetch(`${env.POSTGREST_URL}/ai_review_runs?id=eq.${runId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ total_processed: totalProcessed }),
  })
}

/**
 * POST /api/admin/ai-review/stream
 * SSE endpoint that streams AI review progress in real time.
 *
 * Events:
 *   started   - { runId, total }
 *   batch     - { processed, suggestions } (cumulative counts after each AI batch)
 *   done      - { runId, processed, suggestions, summary }
 *   error     - { message }
 */
export const Route = createFileRoute('/api/admin/ai-review/stream')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request)
        if (!auth.authorized) {
          return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
            status: auth.error === 'Forbidden' ? 403 : 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        if (!env.MISTRAL_API_KEY) {
          return new Response(JSON.stringify({ error: 'AI API not configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        let requestLimit = DEFAULT_LIMIT
        try {
          const body = await request.json().catch(() => ({}))
          if (body.limit && typeof body.limit === 'number' && body.limit > 0) {
            requestLimit = body.limit
          }
        } catch {
          // Use default limit
        }

        const client = createMistralClient()
        let token: string
        let reviewerEmail: string
        try {
          token = auth.email
            ? await signPostgrestToken(auth.email, auth.role)
            : await signSystemPostgrestToken()
          reviewerEmail = auth.email ?? 'system-cron'
        } catch {
          return new Response(JSON.stringify({ error: 'Failed to create auth token' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Check for existing running/pending run
        const existingRunRes = await fetch(
          `${env.POSTGREST_URL}/ai_review_runs?status=in.(running,pending_approval)&order=started_at.desc&limit=1`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (existingRunRes.ok) {
          const existingRuns = await existingRunRes.json()
          if (existingRuns.length > 0) {
            const existingRun = existingRuns[0]

            if (existingRun.status === 'running') {
              const startedAt = new Date(existingRun.started_at).getTime()
              if (Date.now() - startedAt > STUCK_RUN_TIMEOUT_MS) {
                await fetch(`${env.POSTGREST_URL}/ai_review_runs?id=eq.${existingRun.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ status: 'failed', completed_at: new Date().toISOString() }),
                })
              } else {
                return new Response(
                  JSON.stringify({ error: 'En granskning pågår redan', runId: existingRun.id }),
                  { status: 409, headers: { 'Content-Type': 'application/json' } }
                )
              }
            } else {
              return new Response(
                JSON.stringify({ error: 'En granskning väntar på godkännande', runId: existingRun.id }),
                { status: 409, headers: { 'Content-Type': 'application/json' } }
              )
            }
          }
        }

        // Create the run
        const runRes = await fetch(`${env.POSTGREST_URL}/ai_review_runs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ run_by: reviewerEmail, status: 'running' }),
        })
        if (!runRes.ok) {
          return new Response(JSON.stringify({ error: 'Failed to create review run' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const [run] = (await runRes.json()) as [{ id: string }]
        const runId = run.id

        // Fetch pending foods
        const pendingResponse = await fetch(`${env.POSTGREST_URL}/rpc/get_pending_foods_for_review`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ p_limit: requestLimit }),
        })

        if (!pendingResponse.ok) {
          await fetch(`${env.POSTGREST_URL}/ai_review_runs?id=eq.${runId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: 'failed', completed_at: new Date().toISOString() }),
          })
          return new Response(JSON.stringify({ error: 'Failed to fetch pending foods' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const pendingFoods: PendingFood[] = await pendingResponse.json()
        logger.info({ runId, pendingCount: pendingFoods.length, email: reviewerEmail }, 'AI review run started')

        // Stream the processing as SSE
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            let closed = false
            function send(event: string, data: unknown) {
              if (closed) return
              try {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
              } catch {
                closed = true
              }
            }

            send('started', { runId, total: pendingFoods.length })

            if (pendingFoods.length === 0) {
              await fetch(`${env.POSTGREST_URL}/ai_review_runs?id=eq.${runId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  status: 'pending_approval',
                  completed_at: new Date().toISOString(),
                  total_processed: 0,
                  summary: {},
                }),
              })
              send('done', { runId, processed: 0, suggestions: 0, summary: {} })
              if (!closed) controller.close()
              return
            }

            let totalProcessed = 0
            const allSuggestions: Suggestion[] = []

            try {
              for (let batchStart = 0; batchStart < pendingFoods.length; batchStart += AI_BATCH_SIZE) {
                const batch = pendingFoods.slice(batchStart, batchStart + AI_BATCH_SIZE)
                const batchSuggestions: Suggestion[] = []

                try {
                  const normalizations = await normalizeFoodsWithAI(client, batch)

                  for (let i = 0; i < batch.length; i++) {
                    const food = batch[i]
                    const norm = normalizations[i]
                    totalProcessed++

                    const ingredientCount = await countIngredients(token, food.id)

                    if (norm.isGibberish || !norm.normalizedName) {
                      batchSuggestions.push({
                        food_id: food.id,
                        food_name: food.name,
                        suggested_action: ingredientCount === 0 ? 'delete' : 'reject',
                        target_food_id: null,
                        target_food_name: null,
                        extracted_unit: null,
                        extracted_quantity: null,
                        ai_reasoning: 'Ogiltigt livsmedelsnamn (skräptext)',
                        ingredient_count: ingredientCount,
                      })
                      continue
                    }

                    if (ingredientCount === 0) {
                      batchSuggestions.push({
                        food_id: food.id,
                        food_name: food.name,
                        suggested_action: 'delete',
                        target_food_id: null,
                        target_food_name: null,
                        extracted_unit: norm.unit,
                        extracted_quantity: norm.quantity,
                        ai_reasoning: `Oanvänd matvara, normaliserat namn: ${norm.normalizedName}`,
                        ingredient_count: 0,
                      })
                      continue
                    }

                    const existingFood = await findExistingFood(token, norm.normalizedName)

                    if (existingFood) {
                      batchSuggestions.push({
                        food_id: food.id,
                        food_name: food.name,
                        suggested_action: 'alias',
                        target_food_id: existingFood.id,
                        target_food_name: existingFood.name,
                        extracted_unit: norm.unit,
                        extracted_quantity: norm.quantity,
                        ai_reasoning: `Normaliserat till befintligt livsmedel: ${existingFood.name}`,
                        ingredient_count: ingredientCount,
                      })
                    } else if (norm.normalizedName.toLowerCase() === food.name.toLowerCase()) {
                      batchSuggestions.push({
                        food_id: food.id,
                        food_name: food.name,
                        suggested_action: 'create',
                        target_food_id: null,
                        target_food_name: null,
                        extracted_unit: norm.unit,
                        extracted_quantity: norm.quantity,
                        ai_reasoning: 'Namnet är redan korrekt normaliserat',
                        ingredient_count: ingredientCount,
                      })
                    } else {
                      batchSuggestions.push({
                        food_id: food.id,
                        food_name: food.name,
                        suggested_action: 'create',
                        target_food_id: null,
                        target_food_name: null,
                        extracted_unit: norm.unit,
                        extracted_quantity: norm.quantity,
                        ai_reasoning: `Normaliserat namn: ${norm.normalizedName}`,
                        ingredient_count: ingredientCount,
                      })
                    }
                  }
                } catch (error) {
                  logger.error({ err: error instanceof Error ? error : String(error), runId, batchStart }, 'AI review batch failed')
                  totalProcessed += batch.length
                }

                // Save batch to DB immediately
                allSuggestions.push(...batchSuggestions)
                await saveBatch(token, runId, batchSuggestions, totalProcessed)

                // Emit progress
                send('batch', { processed: totalProcessed, suggestions: allSuggestions.length })
              }

              // Finalize run
              const summary = {
                alias: allSuggestions.filter(s => s.suggested_action === 'alias').length,
                create: allSuggestions.filter(s => s.suggested_action === 'create').length,
                reject: allSuggestions.filter(s => s.suggested_action === 'reject').length,
                delete: allSuggestions.filter(s => s.suggested_action === 'delete').length,
              }

              await fetch(`${env.POSTGREST_URL}/ai_review_runs?id=eq.${runId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  status: 'pending_approval',
                  completed_at: new Date().toISOString(),
                  total_processed: totalProcessed,
                  summary,
                }),
              })

              send('done', { runId, processed: totalProcessed, suggestions: allSuggestions.length, summary })
              logger.info({ runId, totalProcessed, suggestions: allSuggestions.length }, 'AI review run completed')
            } catch (error) {
              logger.error({ err: error instanceof Error ? error : String(error), runId }, 'AI review run failed')

              await fetch(`${env.POSTGREST_URL}/ai_review_runs?id=eq.${runId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  status: 'failed',
                  completed_at: new Date().toISOString(),
                  total_processed: totalProcessed,
                }),
              })

              send('error', { message: error instanceof Error ? error.message : 'Processing failed' })
            }

            if (!closed) controller.close()
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      },
    },
  },
})

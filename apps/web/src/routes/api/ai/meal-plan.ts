import { createFileRoute } from '@tanstack/react-router'
import { apiAuthMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'
import { deductCredit, refundCredit } from '@/lib/credits'
import {
  fetchUserRecipes,
  fetchPantryItems,
  fetchBaseRecipes,
  filterRecipesByCategories,
  generateMealPlan,
  saveMealPlan,
  MealPlanGenerationError,
} from '@/lib/meal-plan/service'
import type { MealPlanPreferencesInput } from '@/lib/meal-plan/service'
import { logger as rootLogger } from '@/lib/logger'
const logger = rootLogger.child({ module: 'api:ai:meal-plan' })

export const Route = createFileRoute('/api/ai/meal-plan')({
  server: {
    middleware: [apiAuthMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        let creditDeducted = false
        const { session, postgrestToken } = context
        const userEmail = session.email

        try {
          // ── Parse request ──────────────────────────────────────────
          const body = await request.json()
          const {
            week_start,
            preferences = { categories: [], meal_types: ['middag'], days: [1, 2, 3, 4, 5, 6, 7], servings: 4, max_suggestions: 3 },
            home_id,
          } = body as {
            week_start: string
            preferences: MealPlanPreferencesInput
            home_id?: string
          }

          if (!week_start) {
            return Response.json(
              { error: 'week_start krävs' },
              { status: 400 },
            )
          }

          if (!env.MISTRAL_API_KEY) {
            return Response.json(
              { error: 'AI-generering är inte konfigurerat' },
              { status: 503 },
            )
          }

          // ── Credit check ───────────────────────────────────────────
          const creditDescription = `Matplan: v.${week_start}`
          const deductResult = await deductCredit(postgrestToken, creditDescription)

          if (!deductResult.success) {
            return Response.json(
              {
                error: 'Du har inga AI-poäng kvar. Köp fler i menyn.',
                code: 'INSUFFICIENT_CREDITS',
              },
              { status: 402 },
            )
          }
          creditDeducted = true

          const aiStartTime = Date.now()

          // ── Fetch data ─────────────────────────────────────────────
          const [recipes, pantryItems, baseRecipes] = await Promise.all([
            fetchUserRecipes(postgrestToken, home_id),
            fetchPantryItems(postgrestToken, home_id),
            fetchBaseRecipes(postgrestToken, undefined, preferences.categories),
          ])

          const filteredRecipes = filterRecipesByCategories(recipes, preferences.categories)

          // ── Generate plan via AI ───────────────────────────────────
          const result = await generateMealPlan({
            filteredRecipes,
            baseRecipes,
            userRecipes: recipes,
            preferences,
            pantryItems,
          })

          // ── Save to DB ─────────────────────────────────────────────
          const planId = await saveMealPlan(
            postgrestToken,
            week_start,
            preferences,
            result.entries,
            preferences.servings,
            home_id,
          )

          const durationMs = Date.now() - aiStartTime
          logger.info({ durationMs, planId, entryCount: result.entries.length, email: userEmail }, 'Meal plan generated successfully')
          return Response.json({
            plan_id: planId,
            entries: result.entries,
            summary: result.summary,
            remainingCredits: deductResult.remainingCredits,
          })
        } catch (error) {
          // ── Error handling ─────────────────────────────────────────
          if (error instanceof MealPlanGenerationError) {
            if (userEmail) {
              const reason = error.code === 'no_response'
                ? 'Återbetalning: inget AI-svar'
                : 'Återbetalning: ogiltigt AI-svar'
              await refundCredit(userEmail, reason).catch(() => {})
            }
            return Response.json(
              { error: error.message },
              { status: 422 },
            )
          }

          logger.error({ err: error instanceof Error ? error : String(error), email: userEmail }, 'Meal plan generation error')
          if (creditDeducted && userEmail) {
            await refundCredit(userEmail, 'Återbetalning: serverfel').catch(() => {})
          }
          return Response.json(
            { error: 'Internal server error' },
            { status: 500 },
          )
        }
      },
    },
  },
})

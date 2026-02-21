import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { env } from '@/lib/env'
import { actionAuthMiddleware } from './middleware'

// ============================================================================
// Schemas
// ============================================================================

const creditTransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  balance_after: z.number(),
  transaction_type: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
})

const creditTransactionsArraySchema = z.array(creditTransactionSchema)

export type CreditTransaction = z.infer<typeof creditTransactionSchema>

export interface CreditsData {
  balance: number
  transactions: CreditTransaction[]
}

// ============================================================================
// Actions
// ============================================================================

const getCreditsDataFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .handler(async ({ context }): Promise<CreditsData | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const [balanceRes, historyRes] = await Promise.all([
        fetch(`${env.POSTGREST_URL}/rpc/get_user_credits`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${postgrestToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
          cache: 'no-store',
        }),
        fetch(`${env.POSTGREST_URL}/rpc/get_credit_history`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${postgrestToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_limit: 50, p_offset: 0 }),
          cache: 'no-store',
        }),
      ])

      if (!balanceRes.ok) {
        const errorText = await balanceRes.text()
        console.error('Failed to fetch credits balance:', errorText)
        return { error: 'Kunde inte hämta saldo' }
      }

      if (!historyRes.ok) {
        const errorText = await historyRes.text()
        console.error('Failed to fetch credit history:', errorText)
        return { error: 'Kunde inte hämta transaktionshistorik' }
      }

      const balance = await balanceRes.json()
      const rawTransactions = await historyRes.json()

      // Validate transactions with Zod
      const transactionsResult = creditTransactionsArraySchema.safeParse(rawTransactions)
      if (!transactionsResult.success) {
        console.error('Credit transactions validation failed:', transactionsResult.error.message)
        return { error: 'Ogiltigt svar från servern' }
      }

      return { balance, transactions: transactionsResult.data }
    } catch (error) {
      console.error('Error fetching credits data:', error)
      return { error: 'Ett fel uppstod' }
    }
  })

export async function getCreditsData(): Promise<CreditsData | { error: string }> {
  return getCreditsDataFn()
}

// ============================================================================
// Credit Balance (lightweight, for auth provider)
// ============================================================================

export interface CreditBalance {
  balance: number
}

const getCreditBalanceFn = createServerFn({ method: 'GET' })
  .middleware([actionAuthMiddleware])
  .handler(async ({ context }): Promise<CreditBalance | { error: string }> => {
    const { postgrestToken } = context

    if (!postgrestToken) {
      return { error: 'Du måste vara inloggad' }
    }

    try {
      const response = await fetch(`${env.POSTGREST_URL}/rpc/get_user_credits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${postgrestToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to fetch credits balance:', errorText)
        return { error: 'Kunde inte hämta saldo' }
      }

      const balance = await response.json()
      return { balance }
    } catch (error) {
      console.error('Error fetching credit balance:', error)
      return { error: 'Ett fel uppstod' }
    }
  })

export async function getCreditBalance(): Promise<CreditBalance | { error: string }> {
  return getCreditBalanceFn()
}

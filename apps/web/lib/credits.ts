import { env } from '@/lib/env'
import { signSystemPostgrestToken } from '@/lib/auth'

export async function checkCredits(
  postgrestToken: string
): Promise<{ hasCredits: true; balance: number } | { hasCredits: false }> {
  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_user_credits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${postgrestToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    return { hasCredits: false }
  }

  const balance = await response.json()
  if (typeof balance !== 'number' || balance < 1) {
    return { hasCredits: false }
  }
  return { hasCredits: true, balance }
}

export async function deductCredit(
  postgrestToken: string,
  description: string
): Promise<{ success: true; remainingCredits: number } | { success: false }> {
  const response = await fetch(`${env.POSTGREST_URL}/rpc/deduct_credit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${postgrestToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_description: description }),
  })

  if (!response.ok) {
    return { success: false }
  }

  const remainingCredits = await response.json()
  return { success: true, remainingCredits }
}

export async function refundCredit(
  userEmail: string,
  description: string
): Promise<void> {
  const systemToken = await signSystemPostgrestToken()
  await fetch(`${env.POSTGREST_URL}/rpc/add_credits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${systemToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_user_email: userEmail,
      p_amount: 1,
      p_transaction_type: 'refund',
      p_description: description,
    }),
  })
}

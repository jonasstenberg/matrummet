'use server'

import { cookies } from 'next/headers'
import { verifyToken, signPostgrestToken } from '@/lib/auth'

export async function getPostgrestToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return null
  }

  const payload = await verifyToken(authToken)
  if (!payload?.email) {
    return null
  }

  return signPostgrestToken(payload.email)
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return null
  }

  const payload = await verifyToken(authToken)
  return payload?.email ?? null
}

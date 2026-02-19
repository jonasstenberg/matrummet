import type { Metadata } from 'next'
import { AdminAIReviewClient } from './admin-ai-review-client'
import { getPendingFoodCount } from '@/lib/admin-api'

export const metadata: Metadata = {
  title: 'AI-granskning | Admin',
}

export default async function AdminAIReviewPage() {
  const pendingCount = await getPendingFoodCount()

  return <AdminAIReviewClient pendingCount={pendingCount} />
}

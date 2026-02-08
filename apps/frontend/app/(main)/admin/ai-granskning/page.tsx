import type { Metadata } from 'next'
import { AdminAIReviewClient } from './admin-ai-review-client'

export const metadata: Metadata = {
  title: 'AI-granskning | Admin',
}

export default function AdminAIReviewPage() {
  return <AdminAIReviewClient />
}

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { ManualRecipePage } from './manual-recipe-page'

export const metadata: Metadata = {
  title: 'Nytt recept',
  robots: { index: false, follow: false },
}

export default async function ManualPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return <ManualRecipePage />
}

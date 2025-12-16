import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { CreateRecipePage } from './create-recipe-page'

export default async function NewRecipePage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return <CreateRecipePage />
}

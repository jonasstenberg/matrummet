import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CreditsDashboard } from './credits-dashboard'

export default async function CreditsPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="font-heading text-3xl font-bold">AI-krediter</h1>
        <p className="text-muted-foreground">
          Hantera dina AI-genereringar och köp fler
        </p>
      </div>
      <CreditsDashboard />
    </div>
  )
}

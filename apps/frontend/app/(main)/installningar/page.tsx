import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SettingsForm } from '@/components/settings-form'

export default async function SettingsPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="font-heading text-3xl font-bold">Inställningar</h1>
        <p className="text-muted-foreground">
          Hantera ditt konto och dina inställningar
        </p>
      </div>
      <SettingsForm />
    </div>
  )
}

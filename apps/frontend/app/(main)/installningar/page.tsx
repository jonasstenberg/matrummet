import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SettingsForm } from '@/components/settings-form'
import { ApiKeyManager } from '@/components/api-key-manager'
import { getApiKeys } from '@/lib/actions'

export default async function SettingsPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const apiKeysResult = await getApiKeys()
  const apiKeys = 'error' in apiKeysResult ? [] : apiKeysResult

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="font-heading text-3xl font-bold">Inställningar</h1>
        <p className="text-muted-foreground">
          Hantera ditt konto och dina inställningar
        </p>
      </div>
      <div className="space-y-8">
        <SettingsForm />
        <ApiKeyManager initialKeys={apiKeys} />
      </div>
    </div>
  )
}

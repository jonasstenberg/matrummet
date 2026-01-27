import { ApiKeyManager } from '@/components/api-key-manager'
import { getApiKeys } from '@/lib/actions'

export const dynamic = 'force-dynamic'

export default async function SettingsApiKeysPage() {
  const apiKeysResult = await getApiKeys()
  const apiKeys = 'error' in apiKeysResult ? [] : apiKeysResult

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-6">API-nycklar</h2>
      <ApiKeyManager initialKeys={apiKeys} />
    </div>
  )
}

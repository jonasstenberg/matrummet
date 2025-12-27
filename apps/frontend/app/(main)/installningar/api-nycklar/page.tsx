import { ApiKeyManager } from '@/components/api-key-manager'
import { SettingsViewToggle } from '@/components/settings-view-toggle'
import { getApiKeys } from '@/lib/actions'

export default async function SettingsApiKeysPage() {
  const apiKeysResult = await getApiKeys()
  const apiKeys = 'error' in apiKeysResult ? [] : apiKeysResult

  return (
    <div className="space-y-6">
      <SettingsViewToggle activeView="api-nycklar" />
      <ApiKeyManager initialKeys={apiKeys} />
    </div>
  )
}

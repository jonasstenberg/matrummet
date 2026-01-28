import { ApiKeyManager } from '@/components/api-key-manager'
import { getApiKeys } from '@/lib/actions'

export const dynamic = 'force-dynamic'

export default async function SettingsApiKeysPage() {
  const apiKeysResult = await getApiKeys()
  const apiKeys = 'error' in apiKeysResult ? [] : apiKeysResult

  return <ApiKeyManager initialKeys={apiKeys} />
}

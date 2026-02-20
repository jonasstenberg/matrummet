import Link from 'next/link'
import { ApiKeyManager } from '@/components/api-key-manager'
import { getApiKeys } from '@/lib/actions'

export const dynamic = 'force-dynamic'

export default async function SettingsApiKeysPage() {
  const apiKeysResult = await getApiKeys()
  const apiKeys = 'error' in apiKeysResult ? [] : apiKeysResult

  return (
    <>
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          API-nycklar
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Se <Link href="/api-dokumentation" className="underline hover:text-foreground">API-dokumentationen</Link> för hur du använder dina nycklar.
        </p>
      </header>
      <ApiKeyManager initialKeys={apiKeys} />
    </>
  )
}

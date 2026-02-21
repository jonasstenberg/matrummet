import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Link } from '@tanstack/react-router'
import { ApiKeyManager } from '@/components/api-key-manager'
import { getApiKeys } from '@/lib/actions'

const fetchApiKeys = createServerFn({ method: 'GET' }).handler(async () => {
  const apiKeysResult = await getApiKeys()
  const apiKeys = 'error' in apiKeysResult ? [] : apiKeysResult
  return apiKeys
})

export const Route = createFileRoute('/_main/installningar/api-nycklar')({
  loader: () => fetchApiKeys(),
  head: () => ({ meta: [{ title: 'API-nycklar' }] }),
  component: PageComponent,
})

function PageComponent() {
  const apiKeys = Route.useLoaderData()

  return (
    <>
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          API-nycklar
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Se{' '}
          <Link
            to="/api-dokumentation"
            className="underline hover:text-foreground"
          >
            API-dokumentationen
          </Link>{' '}
          för hur du använder dina nycklar.
        </p>
      </header>
      <ApiKeyManager initialKeys={apiKeys} />
    </>
  )
}

import type { Metadata } from 'next'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { SwaggerUI } from './swagger-ui'

export const metadata: Metadata = {
  title: 'API-dokumentation',
  description: 'OpenAPI-dokumentation för Matrummets REST API.',
  robots: { index: false, follow: false },
}

export default async function ApiDocsPage() {
  const session = await getSession()
  let token: string | undefined

  if (session) {
    token = await signPostgrestToken(session.email, session.role)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-heading text-3xl font-bold mb-2">API-dokumentation</h1>
      <p className="text-muted-foreground mb-8">
        {session
          ? `Inloggad som ${session.email}. "Try it out" skickar autentiserade requests.`
          : 'Logga in för att se alla tillgängliga endpoints och testa med autentisering.'}
      </p>
      <SwaggerUI token={token} />
    </div>
  )
}

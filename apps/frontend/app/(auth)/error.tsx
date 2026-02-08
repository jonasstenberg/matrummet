'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorContent } from '@/components/error-content'
import { APP_NAME } from '@/lib/constants'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AuthError({ error, reset }: ErrorProps) {
  const router = useRouter()

  useEffect(() => {
    console.error('Auth error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">{APP_NAME}</h1>
          <p className="text-muted-foreground">Din digitala kokbok</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 shadow-sm space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Något gick fel
            </h2>
            <p className="text-sm text-muted-foreground">
              Det uppstod ett problem med inloggningen. Försök igen.
            </p>
          </div>

          <ErrorContent
            error={error}
            reset={reset}
            onNavigateHome={() => router.push('/')}
            buttonsClassName="flex flex-col gap-3"
          />
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { ErrorContent } from '@/components/error-content'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Global error boundary caught:', error)
  }, [error])

  return (
    <html lang="sv">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-foreground mb-2">Något gick fel</h1>
              <p className="text-muted-foreground">
                Ett oväntat fel uppstod. Försök igen eller kontakta support om problemet kvarstår.
              </p>
            </div>

            <ErrorContent
              error={error}
              reset={reset}
              onNavigateHome={() => (window.location.href = '/')}
              buttonsClassName="flex flex-col gap-3"
            />
          </div>
        </div>
      </body>
    </html>
  )
}

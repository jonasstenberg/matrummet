'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RootError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console in development
    console.error('Root error boundary caught:', error)
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

            <Alert variant="destructive">
              <AlertDescription>
                <p className="font-medium mb-1">Felmeddelande:</p>
                <p className="text-sm">{error.message || 'Okänt fel'}</p>
                {error.digest && (
                  <p className="text-xs mt-2 opacity-70">Fel-ID: {error.digest}</p>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-3">
              <Button onClick={reset} className="w-full">
                Försök igen
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => (window.location.href = '/')}
              >
                Gå till startsidan
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

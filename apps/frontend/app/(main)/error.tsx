'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function MainError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Main layout error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Något gick fel</h1>
          <p className="text-muted-foreground">
            Det gick inte att ladda sidan. Försök igen om en stund.
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

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={reset} className="flex-1">
            Försök igen
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => (window.location.href = '/')}
          >
            Gå till startsidan
          </Button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RecipeDetailError({ error, reset }: ErrorProps) {
  const router = useRouter()

  useEffect(() => {
    console.error('Recipe detail error:', error)
  }, [error])

  // Determine if this is a "not found" type error
  const isNotFound = error.message.includes('404') || error.message.includes('not found')

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {isNotFound ? 'Receptet hittades inte' : 'Kunde inte ladda receptet'}
          </h1>
          <p className="text-muted-foreground">
            {isNotFound
              ? 'Det receptet du letar efter verkar inte finnas.'
              : 'Det gick inte att ladda receptet. Försök igen om en stund.'}
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
          {!isNotFound && (
            <Button onClick={reset} className="flex-1">
              Försök igen
            </Button>
          )}
          <Button
            variant={isNotFound ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => router.push('/')}
          >
            Tillbaka till alla recept
          </Button>
        </div>
      </div>
    </div>
  )
}

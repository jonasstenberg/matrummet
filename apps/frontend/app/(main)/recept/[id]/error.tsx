'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorContent } from '@/components/error-content'

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

        <ErrorContent
          error={error}
          reset={reset}
          onNavigateHome={() => router.push('/')}
          showReset={!isNotFound}
          homeLabel="Tillbaka till alla recept"
        />
      </div>
    </div>
  )
}

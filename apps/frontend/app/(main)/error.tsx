'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorContent } from '@/components/error-content'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function MainError({ error, reset }: ErrorProps) {
  const router = useRouter()

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

        <ErrorContent
          error={error}
          reset={reset}
          onNavigateHome={() => router.push('/')}
        />
      </div>
    </div>
  )
}

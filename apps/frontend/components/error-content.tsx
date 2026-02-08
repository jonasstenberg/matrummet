'use client'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export interface ErrorContentProps {
  error: Error & { digest?: string }
  reset: () => void
  onNavigateHome: () => void
  showReset?: boolean
  homeLabel?: string
  buttonsClassName?: string
}

export function ErrorContent({
  error,
  reset,
  onNavigateHome,
  showReset = true,
  homeLabel = 'Gå till startsidan',
  buttonsClassName = 'flex flex-col sm:flex-row gap-3',
}: ErrorContentProps) {
  return (
    <>
      <Alert variant="destructive">
        <AlertDescription>
          <p className="font-medium mb-1">Felmeddelande:</p>
          <p className="text-sm">{error.message || 'Okänt fel'}</p>
          {error.digest && (
            <p className="text-xs mt-2 opacity-70">Fel-ID: {error.digest}</p>
          )}
        </AlertDescription>
      </Alert>

      <div className={buttonsClassName}>
        {showReset && (
          <Button onClick={reset} className="flex-1">
            Försök igen
          </Button>
        )}
        <Button
          variant={showReset ? 'outline' : 'default'}
          className="flex-1"
          onClick={onNavigateHome}
        >
          {homeLabel}
        </Button>
      </div>
    </>
  )
}

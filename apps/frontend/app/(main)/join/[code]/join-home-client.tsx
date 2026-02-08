'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Home, Users, AlertCircle, CheckCircle2 } from 'lucide-react'
import { joinHomeByCode } from '@/lib/home-actions'

interface JoinHomeClientProps {
  code: string
  userEmail: string
}

export function JoinHomeClient({ code, userEmail }: JoinHomeClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleJoin() {
    setIsLoading(true)
    setError(null)

    try {
      const result = await joinHomeByCode(code)

      if ('error' in result) {
        setError(result.error)
        return
      }

      setSuccess(true)
      // Redirect to home settings after a brief delay
      setTimeout(() => {
        router.push('/hushall')
        router.refresh()
      }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ett oväntat fel uppstod')
    } finally {
      setIsLoading(false)
    }
  }

  function handleCancel() {
    router.push('/')
  }

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle>Välkommen!</CardTitle>
          <CardDescription>
            Du har gått med i hushållet. Du omdirigeras nu...
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle>Gå med i ett hushåll</CardTitle>
        <CardDescription>
          Du har blivit inbjuden att gå med i ett hushåll. Klicka på knappen nedan för att acceptera inbjudan.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Home className="h-4 w-4" />
            <span>Du går med som:</span>
          </div>
          <p className="font-medium">{userEmail}</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isLoading}
          className="flex-1"
        >
          Avbryt
        </Button>
        <Button
          onClick={handleJoin}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? 'Går med...' : 'Gå med'}
        </Button>
      </CardFooter>
    </Card>
  )
}

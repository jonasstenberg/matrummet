
import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { resetPasswordSchema } from '@/lib/schemas'
import { completeResetPasswordFn } from '@/lib/auth-actions'

interface ResetPasswordFormProps {
  token: string
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Validate with Zod
      const result = resetPasswordSchema.safeParse({ password, confirmPassword })

      if (!result.success) {
        const firstError = result.error.issues[0]
        setError(firstError.message)
        setIsLoading(false)
        return
      }

      const data = await completeResetPasswordFn({
        data: {
          token,
          password: result.data.password,
        },
      })

      if ('error' in data && data.error) {
        throw new Error(data.error)
      }

      setSuccess(true)

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.navigate({ to: '/login' })
      }, 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ett fel uppstod')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            Ditt lösenord har återställts! Du dirigeras nu till inloggningssidan...
          </AlertDescription>
        </Alert>
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline font-medium">
            Klicka här om du inte dirigeras automatiskt
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">Nytt lösenord</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">
          Minst 8 tecken, en versal, en gemen och en siffra
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Bekräfta lösenord</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isLoading}
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Återställer...' : 'Återställ lösenord'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link to="/login" className="text-primary hover:underline font-medium">
          Tillbaka till inloggning
        </Link>
      </p>
    </form>
  )
}

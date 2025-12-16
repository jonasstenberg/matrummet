'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { loginInputSchema } from '@/lib/schemas'

export function LoginForm() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Validate with Zod
      const result = loginInputSchema.safeParse({ email, password })

      if (!result.success) {
        const firstError = result.error.issues[0]
        setError(firstError.message)
        setIsLoading(false)
        return
      }

      await login(result.data.email, result.data.password)
      router.push('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ett fel uppstod')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">E-post</Label>
        <Input
          id="email"
          type="email"
          placeholder="din@epost.se"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Lösenord</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Loggar in...' : 'Logga in'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Har du inget konto?{' '}
        <Link
          href="/registrera"
          className="text-primary hover:underline font-medium"
        >
          Registrera dig
        </Link>
      </p>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function AccountDeletionForm() {
  const { user, clearUser } = useAuth()
  const router = useRouter()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [emailConfirmation, setEmailConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isOAuthUser = user?.provider !== null
  const isEmailValid = emailConfirmation === user?.email
  const canDelete = isEmailValid && (isOAuthUser || password)

  async function handleDelete() {
    setError(null)

    if (!isEmailValid) {
      setError('E-postadressen matchar inte ditt konto')
      return
    }

    if (!isOAuthUser && !password) {
      setError('Ange ditt lösenord för att bekräfta')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ password: isOAuthUser ? null : password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Något gick fel')
      }

      clearUser()
      setDialogOpen(false)
      setEmailConfirmation('')
      setPassword('')
      router.push('/')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel')
    } finally {
      setIsLoading(false)
    }
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setEmailConfirmation('')
      setPassword('')
      setError(null)
    }
  }

  return (
    <div className="bg-card border border-destructive/50 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 text-destructive">Radera konto</h3>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Om du raderar ditt konto kommer all din kontoinformation att tas bort permanent.
          Dina recept kommer att bevaras men kommer inte längre att vara kopplade till ditt konto.
        </p>
        <p className="text-sm font-medium text-destructive">
          Denna åtgärd kan inte ångras.
        </p>

        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button variant="destructive">Radera mitt konto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bekräfta radering av konto</DialogTitle>
              <DialogDescription className="space-y-2">
                <span className="block">
                  Du håller på att permanent radera ditt konto. All din kontoinformation
                  kommer att tas bort och kan inte återställas.
                </span>
                <span className="block">
                  Dina recept kommer att bevaras men kommer inte längre att vara kopplade
                  till ditt konto.
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Email confirmation field */}
              <div className="space-y-2">
                <Label htmlFor="emailConfirmation">
                  Bekräfta genom att skriva din e-postadress: <strong>{user?.email}</strong>
                </Label>
                <Input
                  id="emailConfirmation"
                  type="email"
                  value={emailConfirmation}
                  onChange={(e) => setEmailConfirmation(e.target.value)}
                  placeholder={user?.email}
                  disabled={isLoading}
                />
              </div>

              {/* Password confirmation for non-OAuth users */}
              {!isOAuthUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">Ditt lösenord</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ange ditt lösenord"
                    disabled={isLoading}
                  />
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => handleDialogChange(false)}
                disabled={isLoading}
              >
                Avbryt
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!canDelete || isLoading}
              >
                {isLoading ? 'Raderar...' : 'Radera mitt konto'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

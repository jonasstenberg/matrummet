'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertTriangle, Trash2 } from 'lucide-react'

export function AccountDeletionForm() {
  const { user, clearUser } = useAuth()
  const router = useRouter()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [emailConfirmation, setEmailConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [deleteData, setDeleteData] = useState(false)
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
        body: JSON.stringify({
          password: isOAuthUser ? null : password,
          deleteData
        }),
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
      setDeleteData(false)
      setError(null)
    }
  }

  return (
    <>
      {/* Warning card */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive/60 mt-0.5" />
            <div className="space-y-2">
              <p className="text-[15px] text-muted-foreground">
                Om du raderar ditt konto tas all kontoinformation bort permanent.
                Recept bevaras som standard men kopplas bort från ditt konto.
              </p>
              <p className="text-sm font-medium text-destructive">
                Denna åtgärd kan inte ångras.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete button card */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl px-5 py-3.5 text-[15px] text-destructive transition-colors hover:bg-destructive/5"
        >
          <Trash2 className="h-4 w-4" />
          <span className="font-medium">Radera mitt konto</span>
        </button>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bekräfta radering av konto</DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                Du håller på att permanent radera ditt konto. All din kontoinformation
                kommer att tas bort och kan inte återställas.
              </span>
              {deleteData ? (
                <span className="block font-medium text-destructive">
                  Alla dina recept, inköpslistor och övrig data kommer att raderas permanent
                  och kan inte återställas.
                </span>
              ) : (
                <span className="block">
                  Dina recept kommer att bevaras men kommer inte längre att vara kopplade
                  till ditt konto.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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

            <div className="flex items-start space-x-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <Checkbox
                id="deleteData"
                checked={deleteData}
                onCheckedChange={(checked) => setDeleteData(checked === true)}
                disabled={isLoading}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="deleteData" className="text-sm font-medium leading-none cursor-pointer">
                  Radera alla mina recept och data
                </Label>
                <p className="text-xs text-muted-foreground">
                  Om markerad raderas även alla dina recept, inköpslistor och övrig data permanent.
                  Annars bevaras dina recept men kopplas bort från ditt konto.
                </p>
              </div>
            </div>

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
    </>
  )
}

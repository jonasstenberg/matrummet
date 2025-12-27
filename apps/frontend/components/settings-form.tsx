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
import { updateProfileSchema, changePasswordSchema } from '@/lib/schemas'
import { Check, Trash2 } from 'lucide-react'

export function SettingsForm() {
  const { user, updateUser, clearUser } = useAuth()
  const router = useRouter()

  // Profile state
  const [name, setName] = useState(user?.name || '')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [isProfileLoading, setIsProfileLoading] = useState(false)

  // Password state
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)

  // Delete account state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleteLoading, setIsDeleteLoading] = useState(false)

  async function handleUpdateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setProfileError(null)
    setProfileSuccess(false)

    // Client-side validation
    const result = updateProfileSchema.safeParse({ name })
    if (!result.success) {
      setProfileError(result.error.issues[0].message)
      return
    }

    setIsProfileLoading(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Något gick fel')
      }

      // Update user in context
      updateUser({ name })
      setProfileSuccess(true)

      // Hide success message after 3 seconds
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Något gick fel')
    } finally {
      setIsProfileLoading(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    // Client-side validation
    const result = changePasswordSchema.safeParse({ oldPassword, newPassword })
    if (!result.success) {
      setPasswordError(result.error.issues[0].message)
      return
    }

    setIsPasswordLoading(true)
    try {
      const response = await fetch('/api/user/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ oldPassword, newPassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Något gick fel')
      }

      setPasswordSuccess(true)
      setOldPassword('')
      setNewPassword('')

      // Hide success message after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Något gick fel')
    } finally {
      setIsPasswordLoading(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null)

    // Require password for non-OAuth users
    const isOAuthUser = user?.provider !== null
    if (!isOAuthUser && !deletePassword) {
      setDeleteError('Ange ditt lösenord för att bekräfta')
      return
    }

    setIsDeleteLoading(true)

    try {
      const response = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ password: isOAuthUser ? null : deletePassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Något gick fel')
      }

      // Clear user state and redirect to home
      clearUser()
      setDeleteDialogOpen(false)
      setDeletePassword('')
      router.push('/')
      router.refresh()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Något gick fel')
    } finally {
      setIsDeleteLoading(false)
    }
  }

  function handleDeleteDialogChange(open: boolean) {
    setDeleteDialogOpen(open)
    if (!open) {
      setDeletePassword('')
      setDeleteError(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Profile section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Profil</h2>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-postadress</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ''}
              disabled
            />
            <p className="text-sm text-muted-foreground">
              E-postadressen kan inte ändras
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Namn</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isProfileLoading}
            />
          </div>

          {profileError && (
            <Alert variant="destructive">
              <AlertDescription>{profileError}</AlertDescription>
            </Alert>
          )}

          {profileSuccess && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>Namn uppdaterat!</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isProfileLoading}>
            {isProfileLoading ? 'Sparar...' : 'Spara namn'}
          </Button>
        </form>
      </div>

      {/* Password section - only show for non-OAuth users */}
      {user?.provider === null && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Lösenord</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">Nuvarande lösenord</Label>
              <Input
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={isPasswordLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nytt lösenord</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isPasswordLoading}
              />
              <p className="text-sm text-muted-foreground">
                Minst 8 tecken, en versal, en gemen och en siffra
              </p>
            </div>

            {passwordError && (
              <Alert variant="destructive">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}

            {passwordSuccess && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>Lösenord ändrat!</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isPasswordLoading}>
              {isPasswordLoading ? 'Byter lösenord...' : 'Byt lösenord'}
            </Button>
          </form>
        </div>
      )}

      {/* Delete account section */}
      <div className="bg-card border border-destructive/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-destructive">Radera konto</h2>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Om du raderar ditt konto kommer all din kontoinformation att tas bort permanent.
            Dina recept kommer att bevaras men kommer inte längre att vara kopplade till ditt konto.
          </p>
          <p className="text-sm font-medium text-destructive">
            Denna åtgärd kan inte ångras.
          </p>

          <Dialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4" />
                Radera mitt konto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Är du säker?</DialogTitle>
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

              {/* Password confirmation for non-OAuth users */}
              {user?.provider === null && (
                <div className="space-y-2">
                  <Label htmlFor="deletePassword">Bekräfta med ditt lösenord</Label>
                  <Input
                    id="deletePassword"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Ange ditt lösenord"
                    disabled={isDeleteLoading}
                  />
                </div>
              )}

              {deleteError && (
                <Alert variant="destructive">
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => handleDeleteDialogChange(false)}
                  disabled={isDeleteLoading}
                >
                  Avbryt
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={isDeleteLoading}
                >
                  {isDeleteLoading ? 'Raderar...' : 'Radera mitt konto'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}


import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
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
import { updateProfileAction, type UpdateProfileState } from '@/lib/settings-actions'
import {
  changePasswordFn,
  deleteAccountFn,
  type ChangePasswordState,
  type DeleteAccountState,
} from '@/lib/auth-actions'
import { Check, Trash2 } from '@/lib/icons'

export function SettingsForm() {
  const { user, updateUser, clearUser } = useAuth()
  const router = useRouter()

  // Controlled input state for profile
  const [name, setName] = useState(user?.name || '')

  // Profile form state
  const [profileState, setProfileState] = useState<UpdateProfileState>({})
  const [isProfilePending, setIsProfilePending] = useState(false)

  // Password form state
  const [passwordState, setPasswordState] = useState<ChangePasswordState>({})
  const [isPasswordPending, setIsPasswordPending] = useState(false)

  // Delete account form state
  const [deleteState, setDeleteState] = useState<DeleteAccountState>({})
  const [isDeletePending, setIsDeletePending] = useState(false)

  // Delete account dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsProfilePending(true)
    setProfileState({})
    try {
      const result = await updateProfileAction(name)
      setProfileState(result)
      if (result.success) {
        updateUser({ name })
      }
    } catch {
      setProfileState({ error: 'Ett oväntat fel uppstod' })
    } finally {
      setIsProfilePending(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPasswordPending(true)
    setPasswordState({})
    try {
      const formData = new FormData(e.currentTarget)
      const oldPassword = formData.get('oldPassword') as string
      const newPassword = formData.get('newPassword') as string
      const confirmNewPassword = formData.get('confirmNewPassword') as string
      const result = await changePasswordFn({ data: { oldPassword, newPassword, confirmNewPassword } })
      setPasswordState(result)
    } catch {
      setPasswordState({ error: 'Ett oväntat fel uppstod' })
    } finally {
      setIsPasswordPending(false)
    }
  }

  async function handleDeleteSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsDeletePending(true)
    setDeleteState({})
    try {
      const formData = new FormData(e.currentTarget)
      const password = (formData.get('password') as string) || undefined
      const result = await deleteAccountFn({ data: { password } })
      setDeleteState(result)
      if (result.success) {
        clearUser()
        router.navigate({ to: '/' })
        router.invalidate()
      }
    } catch {
      setDeleteState({ error: 'Ett oväntat fel uppstod' })
    } finally {
      setIsDeletePending(false)
    }
  }

  function handleDeleteDialogChange(open: boolean) {
    setDeleteDialogOpen(open)
  }

  return (
    <div className="space-y-8">
      {/* Profile section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Profil</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
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
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isProfilePending}
            />
          </div>

          {profileState.error && (
            <Alert variant="destructive">
              <AlertDescription>{profileState.error}</AlertDescription>
            </Alert>
          )}

          {profileState.success && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>Namn uppdaterat!</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isProfilePending}>
            {isProfilePending ? 'Sparar...' : 'Spara namn'}
          </Button>
        </form>
      </div>

      {/* Password section - only show for non-OAuth users */}
      {user?.provider === null && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Lösenord</h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">Nuvarande lösenord</Label>
              <Input
                id="oldPassword"
                name="oldPassword"
                type="password"
                disabled={isPasswordPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nytt lösenord</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                disabled={isPasswordPending}
              />
              <p className="text-sm text-muted-foreground">
                Minst 8 tecken, en versal, en gemen och en siffra
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Bekräfta nytt lösenord</Label>
              <Input
                id="confirmNewPassword"
                name="confirmNewPassword"
                type="password"
                disabled={isPasswordPending}
              />
            </div>

            {passwordState.error && (
              <Alert variant="destructive">
                <AlertDescription>{passwordState.error}</AlertDescription>
              </Alert>
            )}

            {passwordState.success && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>Lösenord ändrat!</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isPasswordPending}>
              {isPasswordPending ? 'Byter lösenord...' : 'Byt lösenord'}
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

              <form onSubmit={handleDeleteSubmit}>
                {/* Password confirmation for non-OAuth users */}
                {user?.provider === null && (
                  <div className="space-y-2">
                    <Label htmlFor="deletePassword">Bekräfta med ditt lösenord</Label>
                    <Input
                      id="deletePassword"
                      name="password"
                      type="password"
                      placeholder="Ange ditt lösenord"
                      disabled={isDeletePending}
                    />
                  </div>
                )}

                {deleteState.error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertDescription>{deleteState.error}</AlertDescription>
                  </Alert>
                )}

                <DialogFooter className="gap-2 sm:gap-0 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDeleteDialogChange(false)}
                    disabled={isDeletePending}
                  >
                    Avbryt
                  </Button>
                  <Button type="submit" variant="destructive" disabled={isDeletePending}>
                    {isDeletePending ? 'Raderar...' : 'Radera mitt konto'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}

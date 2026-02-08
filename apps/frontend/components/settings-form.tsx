'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SubmitButton } from '@/components/ui/submit-button'
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
  changePassword,
  deleteAccountAction,
  type ChangePasswordState,
  type DeleteAccountState,
} from '@/lib/auth-actions'
import { Check, Trash2 } from 'lucide-react'

export function SettingsForm() {
  const { user, updateUser, clearUser } = useAuth()
  const router = useRouter()

  // Controlled input state for profile
  const [name, setName] = useState(user?.name || '')

  // Profile form state with useActionState
  const [profileState, profileFormAction, isProfilePending] = useActionState<UpdateProfileState, FormData>(
    updateProfileAction,
    {}
  )

  // Password form state with useActionState
  const [passwordState, passwordFormAction, isPasswordPending] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    {}
  )

  // Delete account form state with useActionState
  const [deleteState, deleteFormAction, isDeletePending] = useActionState<DeleteAccountState, FormData>(
    deleteAccountAction,
    {}
  )

  // Delete account dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Track previous success states to detect when they change
  const prevProfileSuccessRef = useRef(false)
  const prevPasswordSuccessRef = useRef(false)
  const prevDeleteSuccessRef = useRef(false)

  // Update auth context when profile is successfully updated
  useEffect(() => {
    if (profileState.success && !prevProfileSuccessRef.current) {
      updateUser({ name })
    }
    prevProfileSuccessRef.current = profileState.success || false
  }, [profileState.success, name, updateUser])

  // Handle successful password change (could reset form or show message)
  useEffect(() => {
    if (passwordState.success && !prevPasswordSuccessRef.current) {
      // Password changed successfully - form will show success message
    }
    prevPasswordSuccessRef.current = passwordState.success || false
  }, [passwordState.success])

  // Handle successful account deletion
  useEffect(() => {
    if (deleteState.success && !prevDeleteSuccessRef.current) {
      // Clear user state and redirect to home
      clearUser()
      // Dialog closes automatically as we navigate away
      router.push('/')
      router.refresh()
    }
    prevDeleteSuccessRef.current = deleteState.success || false
  }, [deleteState.success, clearUser, router])

  function handleDeleteDialogChange(open: boolean) {
    setDeleteDialogOpen(open)
  }

  return (
    <div className="space-y-8">
      {/* Profile section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Profil</h2>
        <form action={profileFormAction} className="space-y-4">
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

          <SubmitButton loadingText="Sparar...">
            Spara namn
          </SubmitButton>
        </form>
      </div>

      {/* Password section - only show for non-OAuth users */}
      {user?.provider === null && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Lösenord</h2>
          <form action={passwordFormAction} className="space-y-4">
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

            <SubmitButton loadingText="Byter lösenord...">
              Byt lösenord
            </SubmitButton>
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

              <form action={deleteFormAction}>
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
                  <SubmitButton variant="destructive" loadingText="Raderar...">
                    Radera mitt konto
                  </SubmitButton>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}

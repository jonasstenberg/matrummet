'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateProfileSchema, changePasswordSchema } from '@/lib/schemas'
import { Check } from 'lucide-react'

export function SettingsForm() {
  const { user, updateUser } = useAuth()

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
    </div>
  )
}

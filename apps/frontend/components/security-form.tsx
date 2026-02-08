'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/auth-provider'
import { SubmitButton } from '@/components/ui/submit-button'
import { changePassword, type ChangePasswordState } from '@/lib/auth-actions'
import { Check, Lock } from 'lucide-react'

export function SecurityForm() {
  const { user } = useAuth()
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, isPending] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    {}
  )

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
    }
  }, [state.success])

  if (user?.provider !== null) {
    return (
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        <div className="px-5 py-8 text-center">
          <Lock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-[15px] text-muted-foreground">
            Du loggar in via {user?.provider}. Lösenord hanteras där.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-card shadow-(--shadow-card)">
      <form ref={formRef} action={formAction}>
        {/* Current password */}
        <div className="px-5 py-4">
          <label
            htmlFor="oldPassword"
            className="block text-xs font-medium text-muted-foreground/70 mb-1.5"
          >
            Nuvarande lösenord
          </label>
          <input
            id="oldPassword"
            name="oldPassword"
            type="password"
            autoComplete="current-password"
            required
            disabled={isPending}
            className="w-full rounded-lg bg-background border border-border px-3 py-2 text-[15px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
            placeholder="Ange nuvarande lösenord"
          />
        </div>

        {/* New password */}
        <div className="border-t border-border/40 px-5 py-4">
          <label
            htmlFor="newPassword"
            className="block text-xs font-medium text-muted-foreground/70 mb-1.5"
          >
            Nytt lösenord
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={isPending}
            className="w-full rounded-lg bg-background border border-border px-3 py-2 text-[15px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
            placeholder="Minst 8 tecken, en versal, en gemen och en siffra"
          />
        </div>

        {/* Confirm password */}
        <div className="border-t border-border/40 px-5 py-4">
          <label
            htmlFor="confirmNewPassword"
            className="block text-xs font-medium text-muted-foreground/70 mb-1.5"
          >
            Bekräfta nytt lösenord
          </label>
          <input
            id="confirmNewPassword"
            name="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={isPending}
            className="w-full rounded-lg bg-background border border-border px-3 py-2 text-[15px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
            placeholder="Skriv lösenordet igen"
          />
        </div>

        {/* Status + submit */}
        <div className="border-t border-border/40 px-5 py-4">
          {state.error && (
            <p className="mb-3 text-sm text-destructive">{state.error}</p>
          )}

          {state.success && (
            <p className="mb-3 flex items-center gap-1.5 text-sm text-primary">
              <Check className="h-3.5 w-3.5" />
              Lösenord ändrat!
            </p>
          )}

          <SubmitButton loadingText="Byter lösenord..." className="w-full sm:w-auto">
            Byt lösenord
          </SubmitButton>
        </div>
      </form>
    </div>
  )
}

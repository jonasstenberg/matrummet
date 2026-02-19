'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/auth-provider'
import { updateProfileAction, type UpdateProfileState } from '@/lib/actions'
import { useActionState } from 'react'
import { Pencil, Check, X, Mail, User } from '@/lib/icons'

export function ProfileForm() {
  const { user, updateUser } = useAuth()

  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(user?.name || '')
  const inputRef = useRef<HTMLInputElement>(null)

  const [state, formAction, isPending] = useActionState<UpdateProfileState, FormData>(
    async (prevState, formData) => {
      const result = await updateProfileAction(prevState, formData)
      if (result.success) {
        updateUser({ name: formData.get('name') as string })
        setIsEditing(false)
      }
      return result
    },
    {}
  )

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
    }
  }, [isEditing])

  function handleCancel() {
    setEditedName(user?.name || '')
    setIsEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') handleCancel()
  }

  return (
    <div className="rounded-2xl bg-card shadow-(--shadow-card)">
      {/* Email row */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-muted-foreground/60" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-muted-foreground/70 mb-0.5">
              E-postadress
            </div>
            <div className="text-[15px] text-foreground/70 truncate">
              {user?.email || ''}
            </div>
          </div>
        </div>
      </div>

      {/* Name row */}
      <div className="border-t border-border/40 px-5 py-4">
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-muted-foreground/60" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-muted-foreground/70 mb-0.5">
              Namn
            </div>
            {isEditing ? (
              <form action={formAction} className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  name="name"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isPending}
                  required
                  className="flex-1 bg-transparent text-[15px] font-medium text-foreground focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isPending || !editedName.trim()}
                  className="rounded-full p-1.5 text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isPending}
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <div className="group flex items-center gap-1.5">
                <span className="text-[15px] font-medium">
                  {user?.name || ''}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-full p-1.5 text-muted-foreground/0 transition-all group-hover:text-muted-foreground hover:bg-muted/30"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
        {state.error && (
          <p className="mt-2 ml-7 text-sm text-destructive">{state.error}</p>
        )}
      </div>
    </div>
  )
}

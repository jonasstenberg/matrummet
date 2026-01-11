'use client'

import { useState } from 'react'
import { HomeMember } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { X } from 'lucide-react'

interface HomeMemberListProps {
  members: HomeMember[]
  currentUserEmail: string
  onRemoveMember?: (email: string) => Promise<void>
}

export function HomeMemberList({
  members,
  currentUserEmail,
  onRemoveMember,
}: HomeMemberListProps) {
  const [memberToRemove, setMemberToRemove] = useState<HomeMember | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  function formatDate(dateString: string | undefined | null) {
    if (!dateString) return null
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return null
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  function getInitial(name: string) {
    return name.charAt(0).toUpperCase()
  }

  async function handleConfirmRemove() {
    if (!memberToRemove || !onRemoveMember) return

    setIsRemoving(true)
    try {
      await onRemoveMember(memberToRemove.email)
      setMemberToRemove(null)
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <>
      <div className="space-y-3">
        {members.map((member) => {
          const isCurrentUser = member.email === currentUserEmail
          return (
            <div
              key={member.email}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {getInitial(member.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{member.name}</span>
                  {isCurrentUser && (
                    <span className="text-xs text-muted-foreground">(du)</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {member.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {formatDate(member.joined_at) && (
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    Gick med {formatDate(member.joined_at)}
                  </div>
                )}
                {!isCurrentUser && onRemoveMember && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setMemberToRemove(member)}
                    title="Ta bort medlem"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Ta bort</span>
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog
        open={memberToRemove !== null}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort medlem</DialogTitle>
            <DialogDescription>
              Är du säker på att du vill ta bort {memberToRemove?.name} från hemmet?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">
              Personen kommer att förlora åtkomst till delade recept och inköpslistor.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMemberToRemove(null)}
              disabled={isRemoving}
            >
              Avbryt
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={isRemoving}
            >
              {isRemoving ? 'Tar bort...' : 'Ta bort'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

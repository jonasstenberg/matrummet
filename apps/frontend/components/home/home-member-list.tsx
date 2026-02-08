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

  if (members.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-muted-foreground">
        Inga medlemmar ännu
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-border/60">
        {members.map((member) => {
          const isCurrentUser = member.email === currentUserEmail
          return (
            <div
              key={member.email}
              className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {getInitial(member.name)}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[15px] font-medium truncate">
                  {member.name}
                  {isCurrentUser && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      (du)
                    </span>
                  )}
                </span>
              </div>
              {!isCurrentUser && onRemoveMember && (
                <button
                  type="button"
                  onClick={() => setMemberToRemove(member)}
                  className="shrink-0 rounded-full p-1.5 opacity-0 text-muted-foreground transition-all group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Ta bort ${member.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
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
              Är du säker på att du vill ta bort {memberToRemove?.name} från
              hushållet?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">
              Personen kommer att förlora åtkomst till delade recept och
              inköpslistor.
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

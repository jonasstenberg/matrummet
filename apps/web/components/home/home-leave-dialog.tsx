
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface HomeLeaveDialogProps {
  homeName: string
  onLeave: () => Promise<void>
  isDelete?: boolean
  children: React.ReactNode
}

export function HomeLeaveDialog({ homeName, onLeave, isDelete, children }: HomeLeaveDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleLeave() {
    setIsLoading(true)
    try {
      await onLeave()
      setOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isDelete ? 'Ta bort hushållet' : 'Lämna hushållet'}</DialogTitle>
          <DialogDescription>
            {isDelete
              ? `Är du säker på att du vill ta bort ${homeName}?`
              : `Är du säker på att du vill lämna ${homeName}?`}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {isDelete
              ? 'Hushållet och alla dess inköpslistor kommer att tas bort permanent. Denna åtgärd kan inte ångras.'
              : 'Du kommer att förlora åtkomst till delade recept och inköpslistor. Denna åtgärd kan inte ångras.'}
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Avbryt
          </Button>
          <Button
            variant="destructive"
            onClick={handleLeave}
            disabled={isLoading}
          >
            {isLoading
              ? (isDelete ? 'Tar bort...' : 'Lämnar...')
              : (isDelete ? 'Ta bort hushållet' : 'Lämna hushållet')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

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
import { LogOut } from 'lucide-react'

interface HomeLeaveDialogProps {
  homeName: string
  onLeave: () => Promise<void>
}

export function HomeLeaveDialog({ homeName, onLeave }: HomeLeaveDialogProps) {
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
        <Button variant="outline" className="text-destructive hover:text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Lämna hemmet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lämna hemmet</DialogTitle>
          <DialogDescription>
            Är du säker på att du vill lämna {homeName}?
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            Du kommer att förlora åtkomst till delade recept och inköpslistor. Denna åtgärd kan inte ångras.
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
            {isLoading ? 'Lämnar...' : 'Lämna hemmet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

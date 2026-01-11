'use client'

import { useState } from 'react'
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
import { Home, Plus } from 'lucide-react'

interface HomeCreateDialogProps {
  onCreateHome: (name: string) => Promise<void>
  trigger?: React.ReactNode
}

export function HomeCreateDialog({ onCreateHome, trigger }: HomeCreateDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      await onCreateHome(name.trim())
      setOpen(false)
      setName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte skapa hemmet')
    } finally {
      setIsLoading(false)
    }
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen)
    if (!newOpen) {
      setName('')
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Skapa nytt hem
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skapa nytt hem</DialogTitle>
          <DialogDescription>
            Ge ditt hem ett namn. Du kan bjuda in medlemmar efteråt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="home-name">Hemnamn</Label>
              <div className="flex gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Home className="h-5 w-5 text-muted-foreground" />
                </div>
                <Input
                  id="home-name"
                  placeholder="t.ex. Familjen Andersson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  className="flex-1"
                  autoFocus
                />
              </div>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Skapar...' : 'Skapa hem'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

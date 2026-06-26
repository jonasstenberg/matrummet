import { useState, useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
import { createCollection } from '@/lib/collections-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Plus } from '@/lib/icons'

interface CreateCollectionDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Render a default trigger button. Set to false when controlling externally. */
  showTrigger?: boolean
}

export function CreateCollectionDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  showTrigger = true,
}: CreateCollectionDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlledOpen ?? internalOpen
  const setIsOpen = controlledOnOpenChange ?? setInternalOpen

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    setIsOpen(next)
    if (!next) {
      setName('')
      setDescription('')
      setError(null)
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Ange ett namn på samlingen.')
      return
    }

    startTransition(async () => {
      setError(null)
      const result = await createCollection({
        name: trimmed,
        description: description.trim() || undefined,
      })

      if ('error' in result) {
        setError(result.error)
        return
      }

      await router.invalidate()
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Skapa samling
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skapa samling</DialogTitle>
          <DialogDescription>
            Samla ihop dina egna recept i en namngiven samling.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="collection-name">Namn</Label>
            <Input
              id="collection-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="T.ex. Vardagsmiddagar"
              autoFocus
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="collection-description">
              Beskrivning <span className="text-muted-foreground">(valfritt)</span>
            </Label>
            <Textarea
              id="collection-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Vad handlar samlingen om?"
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Skapar...' : 'Skapa samling'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

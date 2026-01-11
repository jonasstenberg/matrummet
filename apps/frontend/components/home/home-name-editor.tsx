'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Check, X } from 'lucide-react'

interface HomeNameEditorProps {
  name: string
  onSave: (name: string) => Promise<void>
}

export function HomeNameEditor({ name, onSave }: HomeNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(name)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSave() {
    if (!editedName.trim() || editedName === name) {
      setIsEditing(false)
      setEditedName(name)
      return
    }

    setIsLoading(true)
    try {
      await onSave(editedName.trim())
      setIsEditing(false)
    } catch {
      setEditedName(name)
    } finally {
      setIsLoading(false)
    }
  }

  function handleCancel() {
    setEditedName(name)
    setIsEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="max-w-xs"
          autoFocus
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSave}
          disabled={isLoading}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCancel}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-medium">{name}</span>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setIsEditing(true)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  )
}

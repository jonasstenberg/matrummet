'use client'

import { useState } from 'react'
import { Pencil, Check, X } from '@/lib/icons'

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
    if (e.key === 'Enter') handleSave()
    else if (e.key === 'Escape') handleCancel()
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          autoFocus
          className="flex-1 bg-transparent text-[15px] font-medium text-foreground focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading}
          className="rounded-full p-1.5 text-primary transition-colors hover:bg-primary/10"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading}
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/30"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-1.5">
      <span className="text-[15px] font-medium">{name}</span>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="rounded-full p-1.5 text-muted-foreground/0 transition-all group-hover:text-muted-foreground hover:bg-muted/30"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

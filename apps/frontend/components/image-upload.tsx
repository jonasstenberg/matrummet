'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ImageUploadProps {
  value?: string | null
  onChange: (filename: string | null) => void
  label?: string
}

function getPreviewUrl(value: string | null | undefined): string | null {
  if (!value) return null
  return `/api/images/${value}`
}

export function ImageUpload({ value, onChange, label = 'Bild' }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(getPreviewUrl(value))
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Update preview when value changes (e.g., from import)
  useEffect(() => {
    setPreview(getPreviewUrl(value))
  }, [value])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Vänligen välj en bildfil')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Bilden får vara max 5 MB')
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)

      // Upload file
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Uppladdning misslyckades')
      }

      const data = await response.json()
      onChange(data.filename)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Kunde inte ladda upp bilden')
      setPreview(getPreviewUrl(value))
    } finally {
      setIsUploading(false)
    }
  }

  function handleRemove() {
    setPreview(null)
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {preview && (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Recipe preview"
            className="h-48 w-auto rounded-lg border object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleRemove}
            className="absolute right-2 top-2"
            disabled={isUploading}
          >
            Ta bort
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={isUploading}
          className="hidden"
          id="image-upload"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Laddar upp...' : preview ? 'Byt bild' : 'Välj bild'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, X, Image as ImageIcon, Link } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
  /** Current value: filename (for saved images) or URL (for imported) */
  value?: string | null
  /** Called when value changes (filename or URL) */
  onChange: (value: string | null) => void
  /** Pending file selected by user (not yet uploaded) */
  pendingFile?: File | null
  /** Called when user selects a file */
  onFileSelect?: (file: File | null) => void
  label?: string
}

type UploadMode = 'file' | 'url'

function isUrl(value: string | null | undefined): boolean {
  if (!value) return false
  return value.startsWith('http://') || value.startsWith('https://')
}

function getPreviewUrl(value: string | null | undefined): string | null {
  if (!value) return null
  if (isUrl(value)) {
    return value
  }
  // Use medium size for preview, strip .webp if present
  const imageId = value.replace(/\.webp$/, '')
  return `/api/images/${imageId}/medium`
}

export function ImageUpload({
  value,
  onChange,
  pendingFile,
  onFileSelect,
  label = 'Bild'
}: ImageUploadProps) {
  const [mode, setMode] = useState<UploadMode>('file')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(getPreviewUrl(value))
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [urlPreview, setUrlPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Update preview when value changes (e.g., from import)
  useEffect(() => {
    setPreview(getPreviewUrl(value))
  }, [value])

  // Generate preview for pending file
  useEffect(() => {
    if (!pendingFile) {
      setFilePreview(null)
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setFilePreview(reader.result as string)
    }
    reader.readAsDataURL(pendingFile)

    return () => reader.abort()
  }, [pendingFile])

  // Determine what to show as preview
  const displayPreview = filePreview || preview
  const hasPreview = !!displayPreview || !!pendingFile

  function validateAndSelectFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Vänligen välj en bildfil')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('Bilden får vara max 20 MB')
      return
    }

    setError(null)
    // Don't upload - just pass the file to parent
    onFileSelect?.(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    validateAndSelectFile(file)
  }

  function handleRemove() {
    setPreview(null)
    setFilePreview(null)
    setUrlPreview(null)
    onChange(null)
    onFileSelect?.(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function handleUrlPreviewClick() {
    if (!imageUrl.trim()) {
      setError('Vänligen ange en URL')
      return
    }

    setError(null)

    try {
      new URL(imageUrl)
    } catch {
      setError('Ogiltig URL')
      return
    }

    setUrlPreview(imageUrl)
  }

  function handleUrlImport() {
    if (!urlPreview) return

    // Don't download/upload - just pass the URL to parent
    // It will be downloaded when the recipe is saved
    onChange(urlPreview)
    setImageUrl('')
    setUrlPreview(null)
  }

  function handleModeChange(newMode: UploadMode) {
    setMode(newMode)
    setError(null)
    setUrlPreview(null)
    setImageUrl('')
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (!file) return

    validateAndSelectFile(file)
  }

  return (
    <div className="space-y-3">
      {!hasPreview && <Label>{label}</Label>}

      {/* Preview for uploaded or imported image */}
      {hasPreview && displayPreview && (
        <div className="group relative h-64 w-full max-w-md overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayPreview}
            alt="Recipe preview"
            className="h-full w-full object-cover"
          />

          {/* Overlay with actions */}
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Byt bild
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Ta bort
            </Button>
          </div>
        </div>
      )}

      {/* Mode toggle buttons */}
      {!hasPreview && (
        <div className="flex w-full max-w-md gap-1 rounded-lg border bg-muted/50 p-1">
          <Button
            type="button"
            variant={mode === 'file' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleModeChange('file')}
            className="flex-1 gap-2"
          >
            <Upload className="h-4 w-4" />
            Ladda upp fil
          </Button>
          <Button
            type="button"
            variant={mode === 'url' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleModeChange('url')}
            className="flex-1 gap-2"
          >
            <Link className="h-4 w-4" />
            Importera från URL
          </Button>
        </div>
      )}

      {/* Drop zone for file upload */}
      {!hasPreview && mode === 'file' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'flex h-64 w-full max-w-md cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all',
            isDragging
              ? 'scale-[1.02] border-primary bg-primary/5'
              : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50'
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <ImageIcon className="h-8 w-8 text-primary" />
          </div>
          <p className="mb-1 text-sm font-medium text-foreground">
            {isDragging ? 'Släpp bilden här' : 'Dra och släpp en bild här'}
          </p>
          <p className="mb-4 text-xs text-muted-foreground">
            eller klicka för att välja
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Välj bild
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">Max 20 MB</p>
        </div>
      )}

      {/* URL import mode */}
      {!hasPreview && mode === 'url' && (
        <div
          className={cn(
            'flex min-h-64 w-full max-w-md flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all',
            urlPreview
              ? 'border-primary/30 bg-primary/5'
              : 'border-border bg-muted/30'
          )}
        >
          {!urlPreview ? (
            <>
              <div className="mb-4 rounded-full bg-primary/10 p-4">
                <Link className="h-8 w-8 text-primary" />
              </div>
              <p className="mb-1 text-sm font-medium text-foreground">
                Importera bild från URL
              </p>
              <p className="mb-4 text-center text-xs text-muted-foreground">
                Klistra in en länk till en bild
              </p>
              <div className="flex w-full gap-2">
                <Input
                  type="url"
                  placeholder="https://exempel.se/bild.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleUrlPreviewClick()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="default"
                  onClick={handleUrlPreviewClick}
                  disabled={!imageUrl.trim()}
                >
                  Hämta
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Max 20 MB</p>
            </>
          ) : (
            <div className="w-full space-y-4">
              <div className="relative h-48 overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlPreview}
                  alt="URL preview"
                  className="h-full w-full object-cover"
                  onError={() => {
                    setError('Kunde inte ladda bilden från URL:en')
                    setUrlPreview(null)
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setUrlPreview(null)
                    setImageUrl('')
                  }}
                  className="absolute right-2 top-2 gap-1"
                >
                  <X className="h-3 w-3" />
                  Avbryt
                </Button>
              </div>

              <Button
                type="button"
                variant="default"
                onClick={handleUrlImport}
                className="w-full gap-2"
              >
                <Upload className="h-4 w-4" />
                Använd denna bild
              </Button>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id="image-upload"
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

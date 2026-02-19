'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, X, ImageIcon, Link } from '@/lib/icons'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getPreviewUrl } from '@/lib/hooks/use-image-upload'

interface ImageUploadProps {
  /** Current value: filename (for saved images) or URL (for imported) */
  value?: string | null
  /** Called when value changes (filename or URL) */
  onChange: (value: string | null) => void
  /** Pending file selected by user (not yet uploaded) */
  pendingFile?: File | null
  /** Preview URL for the pending file (from useImageUpload hook) */
  pendingFilePreview?: string | null
  /** Called when user selects a file */
  onFileSelect?: (file: File | null) => void
  label?: string
}

type UploadMode = 'file' | 'url'

export function ImageUpload({
  value,
  onChange,
  pendingFile,
  pendingFilePreview,
  onFileSelect,
  label = 'Bild'
}: ImageUploadProps) {
  const [mode, setMode] = useState<UploadMode>('file')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(() => getPreviewUrl(value))
  const [localFilePreview, setLocalFilePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Update preview when value changes (e.g., from import)
  useEffect(() => {
    setPreview(getPreviewUrl(value))
  }, [value])

  // Generate local preview for pending file only if not provided by parent
  useEffect(() => {
    // If parent provides preview, skip local generation
    if (pendingFilePreview !== undefined) {
      setLocalFilePreview(null)
      return
    }

    if (!pendingFile) {
      setLocalFilePreview(null)
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setLocalFilePreview(reader.result as string)
    }
    reader.readAsDataURL(pendingFile)

    return () => reader.abort()
  }, [pendingFile, pendingFilePreview])

  // Use parent-provided preview if available, otherwise use local
  const filePreview = pendingFilePreview ?? localFilePreview

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
    setLocalFilePreview(null)
    setShowOverlay(false)
    onChange(null)
    onFileSelect?.(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function handleUrlImport() {
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

    // Don't download/upload - just pass the URL to parent
    // It will be downloaded when the recipe is saved
    onChange(imageUrl)
    setImageUrl('')
  }

  function handleModeChange(newMode: UploadMode) {
    setMode(newMode)
    setError(null)
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
        <div
          className="group relative h-64 w-full max-w-md overflow-hidden rounded-xl bg-muted/40"
          onClick={() => setShowOverlay((v) => !v)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayPreview}
            alt="Recipe preview"
            className="h-full w-full object-cover"
          />

          {/* Overlay with actions — hover on desktop, tap to toggle on mobile */}
          <div className={cn(
            "absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-black/40 transition-opacity",
            showOverlay ? "opacity-100" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
          )}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Byt bild
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleRemove() }}
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
        <div className="flex w-full max-w-md gap-1 rounded-full bg-muted/50 p-1">
          <button
            type="button"
            onClick={() => handleModeChange('file')}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              mode === 'file'
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            Ladda upp fil
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('url')}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              mode === 'url'
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Link className="h-3.5 w-3.5" />
            Importera från URL
          </button>
        </div>
      )}

      {/* Drop zone for file upload */}
      {!hasPreview && mode === 'file' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'flex w-full max-w-md cursor-pointer flex-col items-center justify-center rounded-xl p-8 transition-all',
            isDragging
              ? 'bg-primary/10 ring-2 ring-primary/30'
              : 'bg-muted/40 hover:bg-muted/60'
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="mb-3 rounded-full bg-primary/10 p-3">
            <ImageIcon className="h-6 w-6 text-primary/70" />
          </div>
          <p className="mb-0.5 text-sm font-medium text-foreground">
            {isDragging ? 'Släpp bilden här' : 'Dra och släpp en bild här'}
          </p>
          <p className="text-xs text-muted-foreground/70">
            eller klicka för att välja — max 20 MB
          </p>
        </div>
      )}

      {/* URL import mode */}
      {!hasPreview && mode === 'url' && (
        <div
          className="flex w-full max-w-md flex-col items-center justify-center rounded-xl bg-muted/40 p-8 transition-all"
        >
          <div className="mb-3 rounded-full bg-primary/10 p-3">
            <Link className="h-6 w-6 text-primary/70" />
          </div>
          <p className="mb-0.5 text-sm font-medium text-foreground">
            Importera bild från URL
          </p>
          <p className="mb-4 text-center text-xs text-muted-foreground/70">
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
                  handleUrlImport()
                }
              }}
            />
            <Button
              type="button"
              variant="default"
              onClick={handleUrlImport}
              disabled={!imageUrl.trim()}
            >
              Hämta
            </Button>
          </div>
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

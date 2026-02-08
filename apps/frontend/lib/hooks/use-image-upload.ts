import { useState, useCallback, useEffect } from 'react'
import { downloadAndSaveImage } from '@/lib/actions'

const DEFAULT_MAX_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Get preview URL for an image value (filename or URL)
 * Exported for use by components that need preview URLs without the full hook
 */
export function getPreviewUrl(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }
  // Use medium size for preview, strip .webp if present
  const imageId = value.replace(/\.webp$/, '')
  return `/api/images/${imageId}/medium`
}

export interface UseImageUploadOptions {
  /** Maximum file size in bytes (default: 20MB) */
  maxSize?: number
  /** Initial image value (filename or URL) */
  initialValue?: string | null
  /** Initial pending file */
  initialFile?: File | null
}

export interface UseImageUploadReturn {
  /** Current pending file selected by user (not yet uploaded) */
  pendingFile: File | null
  /** File preview URL (data URL for pending file) */
  filePreview: string | null
  /** Current error message */
  error: string | null
  /** Select a file for upload */
  selectFile: (file: File | null) => void
  /** Clear the pending file and error */
  clear: () => void
  /** Upload the pending file to the server */
  uploadFile: (file: File) => Promise<string | null>
  /** Download and upload an image from a URL */
  downloadAndUploadImageFromUrl: (imageUrl: string) => Promise<string | null>
  /** Check if a value is an image URL */
  isImageUrl: (value: string | null | undefined) => boolean
  /** Get preview URL for a value (filename or URL) */
  getPreviewUrl: (value: string | null | undefined) => string | null
}

/**
 * Hook for managing image upload logic
 *
 * Handles:
 * - File selection and validation (MIME type, size)
 * - Preview generation using FileReader
 * - Upload to /api/upload endpoint
 * - Download and upload from URL
 * - URL detection and preview URL generation
 */
export function useImageUpload(options: UseImageUploadOptions = {}): UseImageUploadReturn {
  const { maxSize = DEFAULT_MAX_SIZE, initialFile = null } = options

  const [pendingFile, setPendingFile] = useState<File | null>(initialFile)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Generate preview for pending file
  useEffect(() => {
    if (!pendingFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const isImageUrl = useCallback((value: string | null | undefined): boolean => {
    if (!value) return false
    return value.startsWith('http://') || value.startsWith('https://')
  }, [])


  const selectFile = useCallback((file: File | null) => {
    if (!file) {
      setPendingFile(null)
      setError(null)
      return
    }

    // Validate MIME type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Vänligen välj en bildfil (JPEG, PNG, WebP, GIF)')
      setPendingFile(null)
      return
    }

    // Validate size
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024))
      setError(`Bilden får vara max ${maxSizeMB} MB`)
      setPendingFile(null)
      return
    }

    setError(null)
    setPendingFile(file)
  }, [maxSize])

  const clear = useCallback(() => {
    setPendingFile(null)
    setError(null)
  }, [])

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) return null

      const data = await response.json()
      return data.filename
    } catch {
      return null
    }
  }, [])

  const downloadAndUploadImageFromUrl = useCallback(async (imageUrl: string): Promise<string | null> => {
    const result = await downloadAndSaveImage(imageUrl)
    if ('error' in result) {
      console.error('Failed to download image:', result.error)
      return null
    }
    return result.filename
  }, [])

  return {
    pendingFile,
    filePreview,
    error,
    selectFile,
    clear,
    uploadFile,
    downloadAndUploadImageFromUrl,
    isImageUrl,
    getPreviewUrl,
  }
}

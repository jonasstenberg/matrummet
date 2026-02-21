import { join } from 'path'
import { randomUUID } from 'crypto'
import { getDataFilesDir } from '@/lib/paths'
import { generateImageVariants } from '@/lib/image-processing'

const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20MB

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]

export interface DownloadResult {
  success: boolean
  filename?: string
  error?: string
}

/**
 * Download an image from a URL, optimize it, and save locally as multiple size variants.
 * Returns the image ID (directory name) on success.
 */
export async function downloadImage(imageUrl: string): Promise<DownloadResult> {
  try {
    // Validate URL
    const url = new URL(imageUrl)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { success: false, error: 'Invalid URL protocol' }
    }

    // Fetch the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecipeImporter/1.0)',
        Accept: 'image/*',
      },
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch image: ${response.status}`,
      }
    }

    // Check content type
    const contentType = response.headers.get('content-type')?.split(';')[0]
    if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return {
        success: false,
        error: `Invalid content type: ${contentType}`,
      }
    }

    // Check content length if available
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
      return {
        success: false,
        error: 'Image too large (max 20MB)',
      }
    }

    // Read the image data
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Check actual size
    if (buffer.length > MAX_IMAGE_SIZE) {
      return {
        success: false,
        error: 'Image too large (max 20MB)',
      }
    }

    // Generate unique image ID (no extension - it's a directory)
    const imageId = randomUUID()
    const imageDir = join(getDataFilesDir(), imageId)

    // Generate all image size variants
    await generateImageVariants(buffer, imageDir)

    return { success: true, filename: imageId }
  } catch (error) {
    console.error('Image download error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download failed',
    }
  }
}

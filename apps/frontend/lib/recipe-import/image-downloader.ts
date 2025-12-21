import { writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getDataFilesDir } from '@/lib/paths'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
}

export interface DownloadResult {
  success: boolean
  filename?: string
  error?: string
}

/**
 * Download an image from a URL and save it locally.
 * Returns the local filename on success.
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
        error: 'Image too large (max 5MB)',
      }
    }

    // Read the image data
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Check actual size
    if (buffer.length > MAX_IMAGE_SIZE) {
      return {
        success: false,
        error: 'Image too large (max 5MB)',
      }
    }

    // Generate filename with appropriate extension
    const ext = CONTENT_TYPE_TO_EXT[contentType] || 'jpg'
    const filename = `${randomUUID()}.${ext}`

    // Save to data directory
    const filepath = join(getDataFilesDir(), filename)
    await writeFile(filepath, buffer)

    return { success: true, filename }
  } catch (error) {
    console.error('Image download error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download failed',
    }
  }
}

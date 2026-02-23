import { uploadImageBuffer } from '@/lib/image-service-client'
import { logger as rootLogger } from '@/lib/logger'
import type { Logger } from 'pino'

const moduleLogger = rootLogger.child({ module: 'recipe-import' })

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
 * Download an image from a URL and upload it to the image service.
 * Returns the image ID (filename) on success.
 */
export async function downloadImage(imageUrl: string, requestLogger?: Logger): Promise<DownloadResult> {
  const logger = (requestLogger ?? moduleLogger).child({ module: 'recipe-import' })
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

    // Upload to image service — forward email for audit logging
    const email = (requestLogger?.bindings?.() as { email?: string } | undefined)?.email
    const filename = await uploadImageBuffer(buffer, contentType, email)

    return { success: true, filename }
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : String(error), imageUrl }, 'Image download error')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download failed',
    }
  }
}

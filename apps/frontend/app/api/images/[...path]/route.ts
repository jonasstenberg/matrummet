import { NextRequest, NextResponse } from 'next/server'
import { createReadStream, statSync, existsSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { Readable } from 'stream'
import { getDataFilesDir } from '@/lib/paths'

const VALID_SIZES = ['thumb', 'small', 'medium', 'large', 'full'] as const
type ImageSize = (typeof VALID_SIZES)[number]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params

    if (!path || path.length === 0 || path.length > 2) {
      return new NextResponse('Invalid path', { status: 400 })
    }

    // Extract imageId and size from path
    let imageId = path[0]
    let size: ImageSize = 'full'

    // Remove .webp extension from imageId if present
    if (imageId.endsWith('.webp')) {
      imageId = imageId.slice(0, -5)
    }

    // Validate imageId to prevent directory traversal
    if (!imageId || imageId.includes('..') || imageId.includes('/') || imageId.includes('\\')) {
      return new NextResponse('Invalid image ID', { status: 400 })
    }

    // Handle size parameter if present
    if (path.length === 2) {
      let sizeParam = path[1]

      // Remove .webp extension from size if present
      if (sizeParam.endsWith('.webp')) {
        sizeParam = sizeParam.slice(0, -5)
      }

      // Validate size
      if (!VALID_SIZES.includes(sizeParam as ImageSize)) {
        return new NextResponse(
          `Invalid size. Must be one of: ${VALID_SIZES.join(', ')}`,
          { status: 400 }
        )
      }
      size = sizeParam as ImageSize
    }

    const uploadsDir = getDataFilesDir()

    // Try new format first: {uploadsDir}/{imageId}/{size}.webp
    let imagePath = join(uploadsDir, imageId, `${size}.webp`)
    let stats

    if (existsSync(imagePath)) {
      try {
        stats = statSync(imagePath)
      } catch {
        // Fall through to legacy format
      }
    }

    // Fall back to legacy format: {uploadsDir}/{imageId}.webp
    if (!stats) {
      imagePath = join(uploadsDir, `${imageId}.webp`)
      try {
        stats = statSync(imagePath)
      } catch {
        return new NextResponse('Image not found', { status: 404 })
      }
    }

    // Generate ETag based on file stats
    const etag = createHash('md5')
      .update(`${stats.mtime.getTime()}-${stats.size}`)
      .digest('hex')

    // Check If-None-Match header for 304 response
    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 })
    }

    // Create a Node.js readable stream
    const nodeStream = createReadStream(imagePath)

    // Convert Node.js stream to Web ReadableStream for true streaming
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag,
        'Content-Length': stats.size.toString(),
      },
    })
  } catch (error) {
    console.error('Error serving image:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

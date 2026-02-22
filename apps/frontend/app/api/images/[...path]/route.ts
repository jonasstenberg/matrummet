import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, statSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
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
    const imageId = path[0]
    let size: ImageSize = 'full'

    // Validate imageId to prevent directory traversal
    if (!imageId || imageId.includes('..') || imageId.includes('/') || imageId.includes('\\')) {
      return new NextResponse('Invalid image ID', { status: 400 })
    }

    // Handle size parameter if present
    if (path.length === 2) {
      const sizeParam = path[1]

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

    // Image path format: {uploadsDir}/{imageId}/{size}.webp
    const imagePath = join(uploadsDir, imageId, `${size}.webp`)
    let stats

    try {
      stats = statSync(imagePath)
    } catch {
      return new NextResponse('Image not found', { status: 404 })
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

    const buffer = readFileSync(imagePath)

    return new NextResponse(buffer, {
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

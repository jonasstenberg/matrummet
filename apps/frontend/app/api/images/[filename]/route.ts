import { NextRequest, NextResponse } from 'next/server'
import { createReadStream, statSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { getDataFilesDir } from '@/lib/paths'

const SUPPORTED_FORMATS = ['.webp', '.jpg', '.jpeg', '.png', '.avif'] as const
const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.avif': 'image/avif',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return new NextResponse('Invalid filename', { status: 400 })
    }

    // Check if file extension is supported
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
    if (!SUPPORTED_FORMATS.includes(ext as typeof SUPPORTED_FORMATS[number])) {
      return new NextResponse('Unsupported image format', { status: 400 })
    }

    // Path to images in the uploads directory
    const imagePath = join(getDataFilesDir(), filename)

    // Check if file exists and get stats for ETag
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

    // Create read stream for efficient large file handling
    const stream = createReadStream(imagePath)
    const chunks: Buffer[] = []

    for await (const chunk of stream) {
      chunks.push(chunk as Buffer)
    }

    const imageBuffer = Buffer.concat(chunks)

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
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

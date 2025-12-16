import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    // Validate filename (prevent path traversal)
    if (filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Ogiltig filnamn' }, { status: 400 })
    }

    // Get the data directory path
    const dataDir = join(process.cwd(), '..', '..', 'data', 'files')
    const filepath = join(dataDir, filename)

    // Read file
    const fileBuffer = await readFile(filepath)

    // Determine content type based on extension
    const ext = filename.split('.').pop()?.toLowerCase()
    const contentType =
      ext === 'webp'
        ? 'image/webp'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'png'
            ? 'image/png'
            : 'application/octet-stream'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('File read error:', error)
    return NextResponse.json({ error: 'Fil hittades inte' }, { status: 404 })
  }
}

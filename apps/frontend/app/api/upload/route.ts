import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getAuthFromRequest } from '@/lib/auth'
import { getDataFilesDir } from '@/lib/paths'
import { generateImageVariants } from '@/lib/image-processing'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getAuthFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil uppladdad' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Endast bildfiler är tillåtna' },
        { status: 400 }
      )
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Bilden får vara max 20 MB' },
        { status: 400 }
      )
    }

    // Generate unique image ID (no extension - it's a directory)
    const imageId = randomUUID()
    const imageDir = join(getDataFilesDir(), imageId)

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const inputBuffer = Buffer.from(bytes)

    // Generate all image size variants
    await generateImageVariants(inputBuffer, imageDir)

    return NextResponse.json({ filename: imageId })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Uppladdning misslyckades' },
      { status: 500 }
    )
  }
}

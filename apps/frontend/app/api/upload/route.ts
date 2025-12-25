import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { getSession } from '@/lib/auth'
import { getDataFilesDir } from '@/lib/paths'

const MAX_DIMENSION = 1920
const WEBP_QUALITY = 85

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession()
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

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Bilden får vara max 5 MB' },
        { status: 400 }
      )
    }

    // Generate unique filename (always save as webp for optimization)
    const filename = `${randomUUID()}.webp`
    const filepath = join(getDataFilesDir(), filename)

    // Convert file to buffer and optimize with sharp
    const bytes = await file.arrayBuffer()
    const inputBuffer = Buffer.from(bytes)

    // Resize if larger than max dimension, convert to webp
    const optimizedBuffer = await sharp(inputBuffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()

    await writeFile(filepath, optimizedBuffer)

    return NextResponse.json({ filename })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Uppladdning misslyckades' },
      { status: 500 }
    )
  }
}

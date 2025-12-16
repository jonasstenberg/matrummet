import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getSession } from '@/lib/auth'

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

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'webp'
    const filename = `${randomUUID()}.${ext}`

    // Get the data directory path (relative to project root)
    const dataDir = join(process.cwd(), '..', '..', 'data', 'files')
    const filepath = join(dataDir, filename)

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    return NextResponse.json({ filename })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Uppladdning misslyckades' },
      { status: 500 }
    )
  }
}

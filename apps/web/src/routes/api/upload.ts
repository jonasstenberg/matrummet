import { createFileRoute } from '@tanstack/react-router'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { apiAuthMiddleware } from '@/lib/middleware'
import { getDataFilesDir } from '@/lib/paths'
import { generateImageVariants } from '@/lib/image-processing'

export const Route = createFileRoute('/api/upload')({
  server: {
    middleware: [apiAuthMiddleware],
    handlers: {
      POST: async ({ request }) => {
        try {
          const formData = await request.formData()
          const file = formData.get('file') as File | null

          if (!file) {
            return Response.json({ error: 'Ingen fil uppladdad' }, { status: 400 })
          }

          // Validate file type
          if (!file.type.startsWith('image/')) {
            return Response.json(
              { error: 'Endast bildfiler är tillåtna' },
              { status: 400 },
            )
          }

          // Validate file size (20MB max)
          if (file.size > 20 * 1024 * 1024) {
            return Response.json(
              { error: 'Bilden får vara max 20 MB' },
              { status: 400 },
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

          return Response.json({ filename: imageId })
        } catch (error) {
          console.error('Upload error:', error)
          return Response.json(
            { error: 'Uppladdning misslyckades' },
            { status: 500 },
          )
        }
      },
    },
  },
})

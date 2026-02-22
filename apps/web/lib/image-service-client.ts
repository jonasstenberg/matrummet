import { SignJWT } from 'jose'
import { env } from './env'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'image-service' })

function getImageServiceUrl(): string {
  return env.IMAGE_SERVICE_URL ?? 'http://localhost:4006'
}

async function getServiceToken(): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET)
  return new SignJWT({ role: 'service', service: 'web' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(secret)
}

export async function uploadImageBuffer(
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const token = await getServiceToken()
  const formData = new FormData()
  formData.append('file', new Blob([buffer], { type: contentType }), 'image.jpg')

  const response = await fetch(`${getImageServiceUrl()}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(error.error || 'Image upload failed')
  }

  const data = await response.json()
  return data.filename
}

// Note: Image cleanup is now handled automatically by a database trigger when
// recipes are deleted or when their image is replaced. This function is kept as
// a belt-and-suspenders fallback but should rarely be needed in practice.
export async function deleteImageFromService(
  imageId: string
): Promise<void> {
  try {
    const token = await getServiceToken()
    const response = await fetch(`${getImageServiceUrl()}/images/${imageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      logger.warn({ imageId, status: response.status, body }, 'Image delete failed')
    }
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error : String(error), imageId }, 'Image delete request failed')
  }
}

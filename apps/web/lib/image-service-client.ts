import { SignJWT } from 'jose'
import { env } from './env'

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
      console.warn(`Image delete failed for ${imageId}: ${response.status}`, body)
    }
  } catch (error) {
    console.warn(`Image delete request failed for ${imageId}:`, error)
  }
}

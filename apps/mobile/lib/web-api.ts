import { Platform } from 'react-native'
import { mobileTokenStorage } from './token-storage'

function fixLocalhost(url: string): string {
  if (Platform.OS === 'android') {
    return url.replace('localhost', '10.0.2.2')
  }
  return url
}

const WEB_APP_URL = fixLocalhost(
  String(process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3000')
)

async function getAuthToken(): Promise<string | null> {
  return mobileTokenStorage.getAppToken()
}

export interface AIGenerateResult {
  recipe: {
    recipe_name: string
    description: string
    author?: string | null
    recipe_yield?: string | null
    recipe_yield_name?: string | null
    prep_time?: number | null
    cook_time?: number | null
    cuisine?: string | null
    image?: string | null
    categories?: string[]
    ingredient_groups?: Array<{
      group_name: string
      ingredients: Array<{ name: string; measurement: string; quantity: string }>
    }>
    instruction_groups?: Array<{
      group_name: string
      instructions: Array<{ step: string }>
    }>
  }
  remainingCredits: number
}

interface ErrorBody {
  error: string
}

function isErrorBody(value: unknown): value is ErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ErrorBody).error === 'string'
  )
}

export async function generateRecipeWithAI(options: {
  text?: string
  imageUri?: string
}): Promise<AIGenerateResult> {
  const token = await getAuthToken()
  if (!token) throw new Error('Du måste vara inloggad.')

  const formData = new FormData()

  if (options.text) {
    formData.append('text', options.text)
  }

  if (options.imageUri) {
    const filename = options.imageUri.split('/').pop() ?? 'photo.jpg'
    const match = /\.(\w+)$/.exec(filename)
    const ext = match ? match[1].toLowerCase() : 'jpg'
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

    formData.append('image', { uri: options.imageUri, name: filename, type: mimeType })
  }

  const res = await fetch(`${WEB_APP_URL}/api/ai/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null)
    if (res.status === 402) {
      throw new Error('Du har inga AI-poäng kvar. Köp fler i profilen.')
    }
    throw new Error(
      isErrorBody(body) ? body.error : 'AI-importen misslyckades.'
    )
  }

  return res.json() as Promise<AIGenerateResult>
}

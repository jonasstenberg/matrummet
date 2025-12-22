import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { env } from '@/lib/env'
import type { OllamaModelsResponse } from '@/lib/recipe-parser/types'

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ollamaUrl = env.OLLAMA_API_URL
    const ollamaToken = env.OLLAMA_API_TOKEN

    if (!ollamaUrl || !ollamaToken) {
      return NextResponse.json(
        { error: 'Ollama API not configured' },
        { status: 503 }
      )
    }

    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ollamaToken}`,
      },
    })

    if (!response.ok) {
      console.error('Ollama API error:', response.status, await response.text())
      return NextResponse.json(
        { error: 'Failed to fetch models from Ollama' },
        { status: 502 }
      )
    }

    const data: OllamaModelsResponse = await response.json()

    return NextResponse.json({ models: data.models })
  } catch (error) {
    console.error('Get Ollama models error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { env } from '@/lib/env'
import {
  buildRecipeParsingPrompt,
  validateParsedRecipe,
} from '@/lib/recipe-parser/prompt'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { text, model, stream = false } = body

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { error: 'Text is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!model || typeof model !== 'string') {
      return NextResponse.json(
        { error: 'Model is required and must be a string' },
        { status: 400 }
      )
    }

    const ollamaUrl = env.OLLAMA_API_URL
    const ollamaToken = env.OLLAMA_API_TOKEN

    if (!ollamaUrl || !ollamaToken) {
      return NextResponse.json(
        { error: 'Ollama API not configured' },
        { status: 503 }
      )
    }

    const prompt = buildRecipeParsingPrompt(text)

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ollamaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: stream,
        format: 'json',
      }),
    })

    if (!response.ok) {
      console.error('Ollama API error:', response.status, await response.text())
      return NextResponse.json(
        { error: 'Failed to generate recipe from Ollama' },
        { status: 502 }
      )
    }

    // Streaming response
    if (stream && response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''

      const readableStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()

          try {
            while (true) {
              const { done, value } = await reader.read()

              if (done) {
                // Stream complete - validate and send final result
                try {
                  const parsedJson = JSON.parse(fullResponse)
                  const recipe = validateParsedRecipe(parsedJson)

                  // Send the final validated recipe
                  const finalChunk = JSON.stringify({
                    type: 'complete',
                    recipe
                  }) + '\n'
                  controller.enqueue(encoder.encode(finalChunk))
                } catch (error) {
                  const errorChunk = JSON.stringify({
                    type: 'error',
                    error: error instanceof Error ? error.message : 'Failed to parse recipe'
                  }) + '\n'
                  controller.enqueue(encoder.encode(errorChunk))
                }

                controller.close()
                break
              }

              // Parse each chunk from Ollama (newline-delimited JSON)
              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split('\n').filter(line => line.trim())

              for (const line of lines) {
                try {
                  const data = JSON.parse(line)

                  if (data.response) {
                    fullResponse += data.response

                    // Forward the partial response to the client
                    const progressChunk = JSON.stringify({
                      type: 'progress',
                      text: data.response,
                      fullText: fullResponse
                    }) + '\n'
                    controller.enqueue(encoder.encode(progressChunk))
                  }
                } catch {
                  // Skip malformed JSON lines
                }
              }
            }
          } catch (error) {
            const errorChunk = JSON.stringify({
              type: 'error',
              error: 'Stream interrupted'
            }) + '\n'
            controller.enqueue(encoder.encode(errorChunk))
            controller.close()
          }
        }
      })

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
        },
      })
    }

    // Non-streaming response (original behavior)
    const data = await response.json()

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(data.response)
    } catch (error) {
      console.error('JSON parse error:', error, 'Response:', data.response)
      return NextResponse.json(
        {
          error: 'LLM returned invalid JSON',
          details: data.response.substring(0, 200),
        },
        { status: 422 }
      )
    }

    try {
      const recipe = validateParsedRecipe(parsedJson)
      return NextResponse.json({ recipe })
    } catch (error) {
      console.error('Recipe validation error:', error)
      return NextResponse.json(
        {
          error: 'LLM response failed validation',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 422 }
      )
    }
  } catch (error) {
    console.error('Parse recipe error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

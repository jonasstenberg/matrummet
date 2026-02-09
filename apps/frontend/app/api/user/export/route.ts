import { NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { getRecipes } from '@/lib/api'
import { recipesToMarkdown } from '@/lib/export-markdown'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Ej autentiserad' },
        { status: 401 }
      )
    }

    const token = await signPostgrestToken(session.email, session.role)
    const recipes = await getRecipes({ owner: session.email, token, limit: 10000 })
    const markdown = recipesToMarkdown(recipes)

    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="mina-recept.md"',
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid export' },
      { status: 500 }
    )
  }
}

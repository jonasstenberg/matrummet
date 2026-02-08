import { NextResponse } from 'next/server'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:4444'

export async function GET() {
  try {
    const response = await fetch(
      `${POSTGREST_URL}/categories?select=name,category_groups(name,sort_order)&order=name`
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      )
    }

    const data: Array<{
      name: string
      category_groups: { name: string; sort_order: number } | null
    }> = await response.json()

    // Group categories by their group
    const groupMap = new Map<string, { sort_order: number; categories: string[] }>()

    for (const cat of data) {
      const groupName = cat.category_groups?.name ?? 'Övrigt'
      const sortOrder = cat.category_groups?.sort_order ?? 99

      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, { sort_order: sortOrder, categories: [] })
      }
      groupMap.get(groupName)!.categories.push(cat.name)
    }

    // Return grouped structure sorted by sort_order
    const grouped = Array.from(groupMap.entries())
      .sort((a, b) => a[1].sort_order - b[1].sort_order)
      .map(([name, { sort_order, categories }]) => ({
        name,
        sort_order,
        categories: categories.sort((a, b) => a.localeCompare(b, 'sv')),
      }))

    return NextResponse.json(grouped)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

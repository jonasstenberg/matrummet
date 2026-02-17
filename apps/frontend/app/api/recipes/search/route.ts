import { getSession, signPostgrestToken } from "@/lib/auth"
import { env } from "@/lib/env"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json([], { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const query = searchParams.get("q") || ""
  const limit = searchParams.get("limit") || "20"
  const homeId = searchParams.get("home_id") || undefined

  const postgrestToken = await signPostgrestToken(session.email)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${postgrestToken}`,
    Accept: "application/json",
  }
  if (homeId) {
    headers["X-Active-Home-Id"] = homeId
  }

  let url: string
  if (query.trim()) {
    // Use search_recipes RPC
    url = `${env.POSTGREST_URL}/rpc/search_recipes`
    const response = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_query: query.trim(),
        p_limit: parseInt(limit),
        p_offset: 0,
      }),
    })

    if (!response.ok) {
      return NextResponse.json([])
    }

    const recipes = await response.json()
    return NextResponse.json(
      recipes.map((r: Record<string, unknown>) => ({
        id: r.id,
        name: r.name,
        image: r.image,
        categories: r.categories || [],
        prep_time: r.prep_time,
        cook_time: r.cook_time,
      })),
    )
  } else {
    // Recent recipes
    url = `${env.POSTGREST_URL}/user_recipes?select=id,name,image,categories,prep_time,cook_time&order=date_modified.desc&limit=${limit}`
    const response = await fetch(url, { headers, cache: "no-store" })

    if (!response.ok) {
      return NextResponse.json([])
    }

    return NextResponse.json(await response.json())
  }
}

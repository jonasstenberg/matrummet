import { NextRequest, NextResponse } from "next/server";
import { signPostgrestToken } from "@/lib/auth";

const POSTGREST_URL = process.env.POSTGREST_URL || "http://localhost:4444";

interface ClearCheckedResult {
  deleted_count: number;
}

async function validateApiKey(apiKey: string): Promise<string | null> {
  const res = await fetch(`${POSTGREST_URL}/rpc/validate_api_key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_api_key: apiKey }),
  });

  if (!res.ok) return null;
  const email = await res.json();
  return email;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 401 });
    }

    const userEmail = await validateApiKey(apiKey);
    if (!userEmail) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const token = await signPostgrestToken(userEmail);

    // Optionally accept a shopping_list_id in the body
    let shoppingListId: string | null = null;
    try {
      const body = await request.json();
      shoppingListId = body.shopping_list_id || null;
    } catch {
      // No body provided, use default list
    }

    const res = await fetch(`${POSTGREST_URL}/rpc/clear_checked_items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_shopping_list_id: shoppingListId,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Failed to clear checked items:", errorText);
      return NextResponse.json(
        { error: "Failed to clear checked items" },
        { status: 500 }
      );
    }

    const result: ClearCheckedResult = await res.json();

    return NextResponse.json({
      success: true,
      cleared: result.deleted_count,
    });
  } catch (error) {
    console.error("Shopping list clear error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

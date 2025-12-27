import { NextRequest, NextResponse } from "next/server";
import { signPostgrestToken } from "@/lib/auth";

const POSTGREST_URL = process.env.POSTGREST_URL || "http://localhost:4444";

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

    const body = await request.json();
    const { item_id, checked } = body;

    if (!item_id || typeof checked !== "boolean") {
      return NextResponse.json(
        { error: "item_id and checked required" },
        { status: 400 }
      );
    }

    const token = await signPostgrestToken(userEmail);

    const res = await fetch(
      `${POSTGREST_URL}/shopping_list_items?id=eq.${item_id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          is_checked: checked,
          checked_at: checked ? new Date().toISOString() : null,
        }),
      }
    );

    if (!res.ok) {
      console.error("Failed to update item:", await res.text());
      return NextResponse.json(
        { error: "Failed to update item" },
        { status: 500 }
      );
    }

    const updated = await res.json();

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, checked });
  } catch (error) {
    console.error("Shopping list check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

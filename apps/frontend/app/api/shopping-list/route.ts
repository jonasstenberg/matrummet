import { NextRequest, NextResponse } from "next/server";
import { signPostgrestToken } from "@/lib/auth";

const POSTGREST_URL = process.env.POSTGREST_URL || "http://localhost:4444";

interface ShoppingListViewItem {
  id: string;
  shopping_list_id: string;
  food_id: string | null;
  unit_id: string | null;
  display_name: string;
  display_unit: string;
  quantity: number;
  is_checked: boolean;
  checked_at: string | null;
  sort_order: number;
  user_email: string;
  date_published: string;
  item_name: string;
  unit_name: string;
  list_name: string;
  source_recipes: string[] | null;
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

export async function GET(request: NextRequest) {
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

    const res = await fetch(
      `${POSTGREST_URL}/shopping_list_view?order=is_checked.asc,sort_order.asc`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      console.error("Failed to fetch shopping list:", await res.text());
      return NextResponse.json(
        { error: "Failed to fetch shopping list" },
        { status: 500 }
      );
    }

    const items: ShoppingListViewItem[] = await res.json();

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        name: item.item_name,
        quantity: item.quantity,
        unit: item.unit_name,
        is_checked: item.is_checked,
        sources: item.source_recipes || [],
      })),
      checked_count: items.filter((i) => i.is_checked).length,
      unchecked_count: items.filter((i) => !i.is_checked).length,
    });
  } catch (error) {
    console.error("Shopping list GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

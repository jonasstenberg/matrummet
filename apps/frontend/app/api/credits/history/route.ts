import { getSession, signPostgrestToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const token = await signPostgrestToken(session.email);

  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_credit_history`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_limit: limit, p_offset: offset }),
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }

  const transactions = await response.json();
  return NextResponse.json({ transactions });
}

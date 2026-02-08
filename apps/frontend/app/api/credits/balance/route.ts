import { getSession, signPostgrestToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await signPostgrestToken(session.email);

  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_user_credits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 }
    );
  }

  const balance = await response.json();
  return NextResponse.json({ balance });
}

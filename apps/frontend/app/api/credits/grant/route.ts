import { getSession, signPostgrestToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { email, amount } = body as { email: string; amount: number };

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  if (!amount || typeof amount !== "number" || amount < 1 || amount > 1000) {
    return NextResponse.json(
      { error: "Amount must be between 1 and 1000" },
      { status: 400 }
    );
  }

  const token = await signPostgrestToken(session.email);

  const response = await fetch(`${env.POSTGREST_URL}/rpc/add_credits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_user_email: email,
      p_amount: amount,
      p_transaction_type: "admin_grant",
      p_description: `Beviljat av admin (${session.email})`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `Failed to grant credits: ${errorText}` },
      { status: 500 }
    );
  }

  const newBalance = await response.json();
  return NextResponse.json({ balance: newBalance });
}

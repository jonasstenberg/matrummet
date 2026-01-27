import { getSession, signPostgrestToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { getStripe, getCreditPack } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const packId = body.packId as string;

  const pack = getCreditPack(packId);
  if (!pack) {
    return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
  }

  const stripe = getStripe();
  const postgrestToken = await signPostgrestToken(session.email);

  // Look up or create Stripe customer
  let stripeCustomerId: string | null = null;

  const customerResponse = await fetch(
    `${env.POSTGREST_URL}/stripe_customers?user_email=eq.${encodeURIComponent(session.email)}&select=stripe_customer_id`,
    {
      headers: {
        Authorization: `Bearer ${postgrestToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (customerResponse.ok) {
    const customers = await customerResponse.json();
    if (customers.length > 0) {
      stripeCustomerId = customers[0].stripe_customer_id;
    }
  }

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.email,
      metadata: { user_email: session.email },
    });
    stripeCustomerId = customer.id;

    // Store mapping (server-side via SECURITY DEFINER would be ideal,
    // but we insert directly since this table has RLS)
    await fetch(`${env.POSTGREST_URL}/stripe_customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${postgrestToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_email: session.email,
        stripe_customer_id: stripeCustomerId,
      }),
    });
  }

  const appUrl = env.APP_URL || "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "payment",
    locale: "sv",
    payment_method_types: ["card", "klarna"],
    line_items: [
      {
        price_data: {
          currency: pack.currency,
          product_data: {
            name: `${pack.credits} AI-genereringar`,
            description: `Köp ${pack.credits} AI-genereringar för receptskapande`,
          },
          unit_amount: pack.price,
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_email: session.email,
      pack_id: pack.id,
      credits: String(pack.credits),
    },
    success_url: `${appUrl}/krediter?status=success`,
    cancel_url: `${appUrl}/krediter?status=cancelled`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}

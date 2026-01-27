import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

async function addCreditsViaPostgrest(
  userEmail: string,
  credits: number,
  paymentIntentId: string,
  description: string
): Promise<boolean> {
  // Use the POSTGREST_JWT_SECRET to sign a service token for server-side RPC
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(env.POSTGREST_JWT_SECRET);
  const serviceToken = await new SignJWT({
    email: userEmail,
    role: "authenticated",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1m")
    .sign(secret);

  const response = await fetch(`${env.POSTGREST_URL}/rpc/add_credits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      p_user_email: userEmail,
      p_amount: credits,
      p_transaction_type: "purchase",
      p_description: description,
      p_stripe_payment_intent_id: paymentIntentId,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      "PostgREST add_credits failed:",
      response.status,
      errorBody
    );
  }

  return response.ok;
}

export async function POST(request: NextRequest) {
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error(
      "Webhook signature verification failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("Stripe webhook received:", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata;
    console.log("Checkout session metadata:", metadata);
    console.log("Payment intent:", session.payment_intent);

    if (!metadata?.user_email || !metadata?.credits) {
      console.error("Missing metadata in checkout session:", session.id);
      return NextResponse.json(
        { error: "Missing metadata" },
        { status: 400 }
      );
    }

    const userEmail = metadata.user_email;
    const credits = parseInt(metadata.credits, 10);
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || session.id;

    const description = `Köp av ${credits} AI-genereringar`;

    const success = await addCreditsViaPostgrest(
      userEmail,
      credits,
      paymentIntentId,
      description
    );

    if (!success) {
      console.error(
        "Failed to add credits for:",
        userEmail,
        "session:",
        session.id
      );
      // Return 500 so Stripe retries
      return NextResponse.json(
        { error: "Failed to add credits" },
        { status: 500 }
      );
    }

    console.log("Credits added successfully for:", userEmail, "amount:", credits);
  }

  return NextResponse.json({ received: true });
}

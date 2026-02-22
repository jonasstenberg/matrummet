import { createFileRoute } from '@tanstack/react-router'
import { signSystemPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { getStripe } from '@/lib/stripe'
import Stripe from 'stripe'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:webhooks:stripe' })

async function addCreditsViaPostgrest(
  userEmail: string,
  credits: number,
  paymentIntentId: string,
  description: string,
): Promise<boolean> {
  const serviceToken = await signSystemPostgrestToken()

  const response = await fetch(`${env.POSTGREST_URL}/rpc/add_credits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      p_user_email: userEmail,
      p_amount: credits,
      p_transaction_type: 'purchase',
      p_description: description,
      p_stripe_payment_intent_id: paymentIntentId,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    logger.error({ responseBody: errorBody, status: response.status, userEmail }, 'PostgREST add_credits failed')
  }

  return response.ok
}

export const Route = createFileRoute('/api/webhooks/stripe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = env.STRIPE_WEBHOOK_SECRET
        if (!webhookSecret) {
          logger.error('STRIPE_WEBHOOK_SECRET not configured')
          return Response.json(
            { error: 'Webhook not configured' },
            { status: 500 },
          )
        }

        const body = await request.text()
        const signature = request.headers.get('stripe-signature')

        if (!signature) {
          return Response.json({ error: 'No signature' }, { status: 400 })
        }

        let event: Stripe.Event
        try {
          const stripe = getStripe()
          event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
        } catch (err) {
          logger.error({ err: err instanceof Error ? err : String(err) }, 'Webhook signature verification failed')
          return Response.json({ error: 'Invalid signature' }, { status: 400 })
        }

        logger.info({ eventType: event.type }, 'Stripe webhook received')

        if (event.type === 'checkout.session.completed') {
          const session = event.data.object as Stripe.Checkout.Session
          const metadata = session.metadata
          logger.info({ metadata, paymentIntent: session.payment_intent }, 'Checkout session received')

          if (!metadata?.user_email || !metadata?.credits) {
            logger.error({ sessionId: session.id }, 'Missing metadata in checkout session')
            return Response.json(
              { error: 'Missing metadata' },
              { status: 400 },
            )
          }

          const userEmail = metadata.user_email
          const credits = parseInt(metadata.credits, 10)
          const paymentIntentId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id || session.id

          const description = `Köp av ${credits} AI-genereringar`

          const success = await addCreditsViaPostgrest(
            userEmail,
            credits,
            paymentIntentId,
            description,
          )

          if (!success) {
            logger.error({ email: userEmail, sessionId: session.id }, 'Failed to add credits')
            // Return 500 so Stripe retries
            return Response.json(
              { error: 'Failed to add credits' },
              { status: 500 },
            )
          }

          logger.info({ email: userEmail, credits }, 'Credits added successfully')
        }

        return Response.json({ received: true })
      },
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'
import { apiAuthMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'
import { getStripe, getCreditPack } from '@/lib/stripe'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:credits:checkout' })

export const Route = createFileRoute('/api/credits/checkout')({
  server: {
    middleware: [apiAuthMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const { session, postgrestToken } = context

        const body = await request.json()
        const packId = body.packId as string

        const pack = getCreditPack(packId)
        if (!pack) {
          return Response.json({ error: 'Ogiltigt paket' }, { status: 400 })
        }

        const stripe = getStripe()

        // Look up or create Stripe customer
        let stripeCustomerId: string | null = null

        const customerResponse = await fetch(
          `${env.POSTGREST_URL}/stripe_customers?user_email=eq.${encodeURIComponent(session.email)}&select=stripe_customer_id`,
          {
            headers: {
              Authorization: `Bearer ${postgrestToken}`,
              Accept: 'application/json',
            },
            cache: 'no-store',
          },
        )

        if (customerResponse.ok) {
          const customers = await customerResponse.json()
          if (customers.length > 0) {
            stripeCustomerId = customers[0].stripe_customer_id
          }
        }

        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email: session.email,
            metadata: { user_email: session.email },
          })
          stripeCustomerId = customer.id

          // Store mapping (server-side via SECURITY DEFINER would be ideal,
          // but we insert directly since this table has RLS)
          await fetch(`${env.POSTGREST_URL}/stripe_customers`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${postgrestToken}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              user_email: session.email,
              stripe_customer_id: stripeCustomerId,
            }),
          })
        }

        const appUrl = env.APP_URL || 'http://localhost:3000'

        const checkoutSession = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          mode: 'payment',
          locale: 'sv',
          payment_method_types: ['card', 'klarna'],
          line_items: [
            {
              price_data: {
                currency: pack.currency,
                product_data: {
                  name: `${pack.credits} AI-poäng`,
                  description: `Köp ${pack.credits} AI-poäng för import och matplanering`,
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
          success_url: `${appUrl}/ai-poang?status=success`,
          cancel_url: `${appUrl}/ai-poang?status=cancelled`,
        })

        logger.info({ email: session.email, packId: pack.id, credits: pack.credits }, 'Checkout session created')
        return Response.json({ url: checkoutSession.url })
      },
    },
  },
})

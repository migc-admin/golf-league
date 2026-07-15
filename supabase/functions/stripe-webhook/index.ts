/**
 * Stripe Webhook — stripe-webhook
 *
 * Listens for Stripe checkout and subscription events and updates
 * the organization's tier in the database accordingly.
 *
 * Events handled:
 *   checkout.session.completed       → set tier to pro or club
 *   customer.subscription.deleted    → downgrade tier to starter (free)
 *   customer.subscription.updated    → handle plan changes
 *
 * The org_id is passed as client_reference_id on the Stripe payment link.
 * The price_id is mapped to a tier using PRICE_TO_TIER below.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

// ── Price ID → tier mapping ───────────────────────────────────────────────────
// Fill these in after creating live products in Stripe dashboard
// Test price IDs are prefixed price_test_, live ones are price_
const PRICE_TO_TIER: Record<string, 'pro' | 'club'> = {
  'price_1TrshtBBkSA7QqV5d9MLS1uA': 'pro',   // Pro Monthly
  'price_1TrshuBBkSA7QqV5K3SAQKFh': 'pro',   // Pro Yearly
  'price_1TrshtBBkSA7QqV5NUr1D8S1': 'club',  // Club Monthly
  'price_1TrshuBBkSA7QqV5bS4N5PtT': 'club',  // Club Yearly
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(`Webhook error: ${err.message}`, { status: 400 })
  }

  console.log(`Received Stripe event: ${event.type}`)

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId   = session.client_reference_id

        if (!orgId) {
          console.error('No client_reference_id on checkout session — cannot identify org')
          break
        }

        // Determine tier from the line items' price IDs
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 })
        let tier: 'pro' | 'club' | null = null

        for (const item of lineItems.data) {
          const priceId = item.price?.id ?? ''
          if (PRICE_TO_TIER[priceId]) {
            tier = PRICE_TO_TIER[priceId]
            break
          }
        }

        if (!tier) {
          console.error('Could not map price to tier. Price IDs:', lineItems.data.map(i => i.price?.id))
          break
        }

        // Store Stripe customer ID for future subscription management
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id

        const { error } = await supabase
          .from('organizations')
          .update({
            tier,
            stripe_customer_id: customerId ?? null,
          })
          .eq('id', orgId)

        if (error) {
          console.error('Failed to update org tier:', error.message)
        } else {
          console.log(`Org ${orgId} upgraded to ${tier}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        // Subscription cancelled — downgrade to starter
        const subscription = event.data.object as Stripe.Subscription
        const customerId   = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id

        const { error } = await supabase
          .from('organizations')
          .update({ tier: 'starter' })
          .eq('stripe_customer_id', customerId)

        if (error) {
          console.error('Failed to downgrade org:', error.message)
        } else {
          console.log(`Org with customer ${customerId} downgraded to starter`)
        }
        break
      }

      case 'customer.subscription.updated': {
        // Handle plan changes (e.g. pro → club or monthly → yearly)
        const subscription = event.data.object as Stripe.Subscription
        const customerId   = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id

        const priceId = subscription.items.data[0]?.price?.id ?? ''
        const tier    = PRICE_TO_TIER[priceId]

        if (!tier) {
          console.log(`Subscription updated but price ${priceId} not in PRICE_TO_TIER map — no action taken`)
          break
        }

        const { error } = await supabase
          .from('organizations')
          .update({ tier })
          .eq('stripe_customer_id', customerId)

        if (error) {
          console.error('Failed to update org tier on subscription change:', error.message)
        } else {
          console.log(`Org with customer ${customerId} updated to ${tier}`)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error('Error processing webhook:', err.message)
    return new Response('Internal error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})

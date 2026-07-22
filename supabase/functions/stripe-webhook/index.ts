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
  'price_1TvqhFBBkSA7QqV5Fb6A8mng': 'pro',   // Pro Yearly
  'price_1TrshtBBkSA7QqV5NUr1D8S1': 'club',  // Club Monthly
  'price_1TvqgVBBkSA7QqV5td14eh64': 'club',  // Club Yearly
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

      case 'charge.dispute.created': {
        const dispute   = event.data.object as Stripe.Dispute
        const chargeId  = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id
        const customerId = typeof dispute.payment_intent === 'string' ? null : null // resolved below

        // Look up org by stripe_customer_id from the charge
        let orgName  = 'Unknown'
        let orgId    = 'Unknown'
        let orgEmail = 'Unknown'

        try {
          const charge = await stripe.charges.retrieve(chargeId ?? '')
          const cid    = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id ?? ''
          if (cid) {
            const { data: orgs } = await supabase
              .from('organizations')
              .select('id, name')
              .eq('stripe_customer_id', cid)
              .limit(1)
            if (orgs?.[0]) {
              orgName = orgs[0].name
              orgId   = orgs[0].id
            }
            // Get admin email for this org
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id')
              .eq('org_id', orgId)
              .eq('role', 'admin')
              .limit(1)
            if (profiles?.[0]) {
              const { data: { user } } = await supabase.auth.admin.getUserById(profiles[0].id)
              if (user?.email) orgEmail = user.email
            }
          }
        } catch (lookupErr) {
          console.error('Dispute org lookup failed:', lookupErr.message)
        }

        const amount   = (dispute.amount / 100).toLocaleString('en-US', { style: 'currency', currency: dispute.currency?.toUpperCase() ?? 'USD' })
        const reason   = dispute.reason ?? 'unspecified'
        const deadline = dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
          : 'Check Stripe dashboard'
        const alertTime = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
        const html = `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background: #7f1d1d; padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #fca5a5; margin: 0; font-size: 20px;">⚠️ Chargeback Filed</h1>
              <p style="color: rgba(255,255,255,0.75); margin: 6px 0 0; font-size: 13px;">Alert generated: ${alertTime}</p>
            </div>
            <div style="background: #fff7f7; border: 1px solid #fecaca; border-top: none; padding: 20px; border-radius: 0 0 12px 12px;">
              <p style="color: #991b1b; font-size: 14px; font-weight: 600; margin: 0 0 16px;">
                A payment dispute has been filed. You have until <strong>${deadline}</strong> to submit evidence to Stripe.
              </p>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr style="border-bottom: 1px solid #fee2e2;"><td style="padding: 8px 0; color: #6b7280; width: 140px;">Dispute ID</td><td style="padding: 8px 0; font-weight: 600; font-family: monospace;">${dispute.id}</td></tr>
                <tr style="border-bottom: 1px solid #fee2e2;"><td style="padding: 8px 0; color: #6b7280;">Charge ID</td><td style="padding: 8px 0; font-family: monospace;">${chargeId ?? '—'}</td></tr>
                <tr style="border-bottom: 1px solid #fee2e2;"><td style="padding: 8px 0; color: #6b7280;">Amount</td><td style="padding: 8px 0; font-weight: 700; color: #991b1b;">${amount}</td></tr>
                <tr style="border-bottom: 1px solid #fee2e2;"><td style="padding: 8px 0; color: #6b7280;">Reason</td><td style="padding: 8px 0; text-transform: capitalize;">${reason.replace(/_/g, ' ')}</td></tr>
                <tr style="border-bottom: 1px solid #fee2e2;"><td style="padding: 8px 0; color: #6b7280;">Status</td><td style="padding: 8px 0;">${dispute.status}</td></tr>
                <tr style="border-bottom: 1px solid #fee2e2;"><td style="padding: 8px 0; color: #6b7280;">Organization</td><td style="padding: 8px 0;">${orgName}</td></tr>
                <tr style="border-bottom: 1px solid #fee2e2;"><td style="padding: 8px 0; color: #6b7280;">Org ID</td><td style="padding: 8px 0; font-family: monospace; font-size: 11px;">${orgId}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Admin Email</td><td style="padding: 8px 0;">${orgEmail}</td></tr>
              </table>
              <div style="margin-top: 20px; padding: 14px; background: #fff; border: 1px solid #fca5a5; border-radius: 8px;">
                <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #7f1d1d;">⏱ Next Steps</p>
                <ol style="margin: 0; padding-left: 18px; font-size: 13px; color: #374151; line-height: 1.8;">
                  <li>Open <a href="https://dashboard.stripe.com/disputes/${dispute.id}" style="color: #1B4332;">Stripe Dispute Dashboard</a></li>
                  <li>Open <a href="https://www.scorifygolf.com/admin/dispute-template" style="color: #1B4332;">Dispute Response Template</a> in Scorify Golf admin</li>
                  <li>Pull security logs and transaction records for org: ${orgId}</li>
                  <li>Submit evidence before: <strong>${deadline}</strong></li>
                </ol>
              </div>
            </div>
            <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">Scorify Golf · admin@scorifygolf.com</p>
          </div>
        `

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'notifications@scorifygolf.com',
            to:   'admin@scorifygolf.com',
            subject: `⚠️ Chargeback Filed — ${amount} · Due ${deadline}`,
            html,
          }),
        })

        await supabase.rpc('log_security_event', {
          p_event: 'chargeback_filed', p_severity: 'error',
          p_org_id: orgId !== 'Unknown' ? orgId : null,
          p_endpoint: 'stripe-webhook',
          p_message: `Dispute ${dispute.id} filed for ${amount} — reason: ${reason}`,
          p_metadata: { dispute_id: dispute.id, charge_id: chargeId, amount: dispute.amount, reason, deadline, status: dispute.status },
        })

        console.log(`[stripe-webhook] chargeback alert sent — dispute=${dispute.id} amount=${amount} deadline=${deadline}`)
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

/**
 * stripe-portal — creates a Stripe Customer Portal session for the caller's org.
 * Returns { url } to redirect the user to for subscription management.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get caller's user ID from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    // Get org's stripe_customer_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile?.org_id) {
      return new Response(JSON.stringify({ error: 'No org found' }), { status: 400, headers: corsHeaders })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id, name')
      .eq('id', profile.org_id)
      .single()

    if (!org?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: 'No Stripe customer found. Upgrade first.' }), {
        status: 400, headers: corsHeaders
      })
    }

    const { return_url } = await req.json().catch(() => ({}))

    const FALLBACK_URL    = 'https://www.scorifygolf.com/admin/settings'
    const ALLOWED_ORIGINS = ['scorifygolf.com', 'www.scorifygolf.com', 'app.scorifygolf.com']

    let safeReturnUrl = FALLBACK_URL
    if (return_url) {
      try {
        const parsed = new URL(return_url)
        if (ALLOWED_ORIGINS.includes(parsed.hostname)) {
          safeReturnUrl = return_url
        }
      } catch {
        // invalid URL — fall through to default
      }
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: safeReturnUrl,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('stripe-portal error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders
    })
  }
})

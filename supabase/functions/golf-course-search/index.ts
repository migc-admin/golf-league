/**
 * golf-course-search — proxies the RapidAPI golf course search
 * so the API key never reaches the browser.
 *
 * GET ?name=<query>
 * Auth: caller must be authenticated (admin).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')             ?? ''
const SUPABASE_ANON_KEY        = Deno.env.get('SUPABASE_ANON_KEY')        ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const GOLF_API_KEY             = Deno.env.get('GOLF_COURSE_API_KEY')      ?? ''
const GOLF_API_HOST            = 'golf-course-api.p.rapidapi.com'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verify the caller is authenticated
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Rate limit: 10 searches per user per minute
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: allowed } = await serviceClient.rpc('check_rate_limit', {
    p_key:            `golf-search:${user.id}`,
    p_max_count:      10,
    p_window_seconds: 60,
  })
  if (!allowed) {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    console.warn(`[golf-course-search] rate_limited user=${user.id} ip=${ip}`)
    await serviceClient.rpc('log_security_event', {
      p_event: 'rate_limited', p_severity: 'warn',
      p_user_id: user.id, p_ip: ip, p_endpoint: 'golf-course-search',
      p_message: 'Search rate limit exceeded',
    })
    return new Response(JSON.stringify({ error: 'Too many searches. Please wait a moment.' }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url   = new URL(req.url)
  const query = url.searchParams.get('name')?.trim()

  if (!query || query.length < 3) {
    return new Response(JSON.stringify({ error: 'name query param must be at least 3 characters' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!GOLF_API_KEY) {
    return new Response(JSON.stringify({ error: 'Golf API not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const apiRes = await fetch(
    `https://${GOLF_API_HOST}/search?name=${encodeURIComponent(query)}`,
    {
      headers: {
        'Content-Type':    'application/json',
        'x-rapidapi-host': GOLF_API_HOST,
        'x-rapidapi-key':  GOLF_API_KEY,
      },
    }
  )

  if (!apiRes.ok) {
    console.error(`[golf-course-search] api_error status=${apiRes.status} user=${user.id} query="${query}"`)
    await serviceClient.rpc('log_security_event', {
      p_event: 'api_error', p_severity: 'error',
      p_user_id: user.id, p_endpoint: 'golf-course-search',
      p_message: `RapidAPI returned ${apiRes.status}`,
      p_metadata: { query, status: apiRes.status },
    })
    return new Response(JSON.stringify({ error: 'Course search failed' }), {
      status: apiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const data = await apiRes.json()
  console.log(`[golf-course-search] ok user=${user.id} query="${query}" results=${Array.isArray(data) ? data.length : '?'}`)
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

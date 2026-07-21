/**
 * create-player-login — creates a Supabase auth account for a player
 * using the service-role Admin API so the calling admin's session is
 * never interrupted.
 *
 * POST body: { email, password, fullName, role, orgId }
 * Auth: caller must be an authenticated admin of the org.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')             ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SUPABASE_ANON_KEY        = Deno.env.get('SUPABASE_ANON_KEY')        ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the caller is an authenticated admin
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

    // Confirm caller is an admin of their org
    const { data: callerProfile } = await userClient
      .from('profiles')
      .select('org_id, role, is_owner, is_platform_admin')
      .eq('id', user.id)
      .single()

    const isPrivileged = callerProfile?.role === 'admin'
      || callerProfile?.is_owner
      || callerProfile?.is_platform_admin

    if (!isPrivileged || !callerProfile?.org_id) {
      return new Response(JSON.stringify({ error: 'Only org admins can create logins' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, password, fullName, role, orgId } = await req.json()

    if (!email || !password || !orgId) {
      return new Response(JSON.stringify({ error: 'email, password, and orgId are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (orgId !== callerProfile.org_id) {
      return new Response(JSON.stringify({ error: 'Cannot create logins for a different organization' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Rate limit: 20 account creations per org per hour
    const { data: allowed } = await serviceClient.rpc('check_rate_limit', {
      p_key:            `create-login:${callerProfile.org_id}`,
      p_max_count:      20,
      p_window_seconds: 3600,
    })
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Too many accounts created recently. Please wait before creating more.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create the auth user — email_confirm: true skips the confirmation email
    // since the admin is setting a temporary password they share directly
    const { data, error: createError } = await serviceClient.auth.admin.createUser({
      email:          email.trim(),
      password,
      email_confirm:  true,
      user_metadata:  { full_name: (fullName ?? '').trim() },
    })

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = data.user?.id
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User created but ID missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Upsert profile with role and org
    await serviceClient.from('profiles').upsert({
      id:        userId,
      full_name: (fullName ?? email).trim(),
      role:      role ?? 'none',
      org_id:    orgId,
    }, { onConflict: 'id' })

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

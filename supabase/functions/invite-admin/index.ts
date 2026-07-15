/**
 * invite-admin — sends a Supabase magic-link invite to a new admin
 * and pre-links them to the calling org.
 *
 * POST body: { email: string, orgId: string, fullName?: string }
 * Auth: caller must be an authenticated admin of the org.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')            ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SUPABASE_ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')       ?? ''

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

    // Fetch the caller's org and confirm they are an admin
    const { data: callerProfile } = await userClient
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single()

    if (!callerProfile?.org_id || callerProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only org admins can invite users' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, orgId, fullName } = await req.json()

    if (!email || !orgId) {
      return new Response(JSON.stringify({ error: 'email and orgId are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Confirm the orgId matches the caller's org (prevent cross-org invites)
    if (orgId !== callerProfile.org_id) {
      return new Response(JSON.stringify({ error: 'Cannot invite to a different organization' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check current admin count (Club plan: max 3)
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { count } = await serviceClient
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('role', 'admin')

    if ((count ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: 'Club plan allows up to 3 admins. Remove an existing admin to invite a new one.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send the invite — org_id is embedded in metadata so the trigger links them
    const { data, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: {
        org_id:    orgId,
        role:      'admin',
        full_name: fullName ?? '',
      },
      redirectTo: `${req.headers.get('origin') ?? 'https://scorifygolf.com'}/admin`,
    })

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, userId: data.user?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/**
 * notify-new-user
 * Called via a database webhook on INSERT to public.profiles.
 * Sends an email to admin@scorifygolf.com when a new user signs up.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL     = 'notifications@scorifygolf.com'
const ADMIN_EMAIL    = 'admin@scorifygolf.com'

serve(async (req) => {
  try {
    const payload = await req.json()
    const profile = payload.record

    if (!profile) return new Response('No record', { status: 400 })

    // Get email from auth.users
    const { data: { user } } = await supabase.auth.admin.getUserById(profile.id)
    if (!user?.email) return new Response('No user email', { status: 200 })

    // Get org name if they have one
    let orgName = 'None yet'
    if (profile.org_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name, tier')
        .eq('id', profile.org_id)
        .single()
      if (org) orgName = `${org.name} (${org.tier})`
    }

    const signupDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <div style="background: #1B4332; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #D4AF37; margin: 0; font-size: 20px;">New User Signup</h1>
          <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 14px;">${signupDate}</p>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 100px;">Email</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${user.email}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Name</td><td style="padding: 8px 0; font-size: 14px;">${profile.full_name ?? '—'}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Org</td><td style="padding: 8px 0; font-size: 14px;">${orgName}</td></tr>
          </table>
          <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #f3f4f6;">
            <a href="https://www.scorifygolf.com/admin" style="background: #1B4332; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600;">Open Scorify Golf →</a>
          </div>
        </div>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">Scorify Golf Platform · admin@scorifygolf.com</p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `New signup: ${user.email}`,
        html,
      }),
    })

    const resBody = await res.json()
    console.log('Resend response:', resBody)

    return new Response(JSON.stringify({ sent: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('notify-new-user error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})

/**
 * notify-registration
 * Triggered by a Supabase Database Webhook on INSERT to registrations table.
 * Sends an instant email to the org admin notifying of a new registration.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL     = 'notifications@scorifygolf.com'

/** Escape user-supplied strings before embedding in HTML email templates. */
function esc(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

serve(async (req) => {
  try {
    const payload = await req.json()
    const registration = payload.record

    if (!registration) {
      return new Response('No record in payload', { status: 400 })
    }

    // Fetch event + league + org + admin email
    const { data: event } = await supabase
      .from('events')
      .select('id, name, event_number, event_date, league:leagues(name, org_id)')
      .eq('id', registration.event_id)
      .single()

    if (!event) {
      return new Response('Event not found', { status: 404 })
    }

    const orgId = event.league?.org_id
    if (!orgId) return new Response('No org found', { status: 404 })

    // Get admin email(s) for this org
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', orgId)
      .eq('role', 'admin')

    if (!adminProfiles?.length) {
      return new Response('No admins found', { status: 200 })
    }

    const adminIds = adminProfiles.map(p => p.id)
    const { data: adminUsers } = await supabase.auth.admin.listUsers()
    const adminEmails = adminUsers?.users
      ?.filter(u => adminIds.includes(u.id) && u.email)
      ?.map(u => u.email) ?? []

    if (!adminEmails.length) {
      return new Response('No admin emails found', { status: 200 })
    }

    const eventLabel = esc(event.name ?? `Event #${event.event_number}`)
    const eventDate  = event.event_date
      ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : ''
    const playerName = esc(`${registration.first_name} ${registration.last_name}`.trim())

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <div style="background: #1B4332; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #D4AF37; margin: 0; font-size: 20px;">New Registration</h1>
          <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 14px;">${eventLabel}${eventDate ? ` · ${esc(eventDate)}` : ''}</p>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 120px;">Name</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${playerName}</td></tr>
            ${registration.email ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Email</td><td style="padding: 8px 0; font-size: 14px;">${esc(registration.email)}</td></tr>` : ''}
            ${registration.notes ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Notes</td><td style="padding: 8px 0; font-size: 14px;">${esc(registration.notes)}</td></tr>` : ''}
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Status</td><td style="padding: 8px 0; font-size: 14px;"><span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600;">Pending</span></td></tr>
          </table>
          <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #f3f4f6;">
            <a href="https://www.scorifygolf.com/admin" style="background: #1B4332; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600;">View in Scorify Golf →</a>
          </div>
        </div>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">Scorify Golf · You're receiving this because you're an admin of this league.</p>
      </div>
    `

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: adminEmails,
        subject: `New registration: ${`${registration.first_name} ${registration.last_name}`.trim()} — ${event.name ?? `Event #${event.event_number}`}`,
        html,
      }),
    })

    return new Response(JSON.stringify({ sent: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('notify-registration error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})

/**
 * digest-registrations
 * Called nightly by Supabase Cron (pg_cron).
 * Sends each org admin a summary of all registrations from the past 24 hours.
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

serve(async (_req) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Fetch all registrations in the last 24h with event + league + org info
    const { data: registrations } = await supabase
      .from('registrations')
      .select('id, first_name, last_name, email, notes, status, created_at, event:events(id, name, event_number, event_date, league:leagues(name, org_id))')
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (!registrations?.length) {
      console.log('No registrations in last 24h — skipping digest')
      return new Response(JSON.stringify({ sent: false, reason: 'no registrations' }), { status: 200 })
    }

    // Group by org_id
    const byOrg: Record<string, typeof registrations> = {}
    for (const reg of registrations) {
      const orgId = reg.event?.league?.org_id
      if (!orgId) continue
      if (!byOrg[orgId]) byOrg[orgId] = []
      byOrg[orgId].push(reg)
    }

    const { data: adminUsers } = await supabase.auth.admin.listUsers()

    for (const [orgId, regs] of Object.entries(byOrg)) {
      // Get admin profile IDs for this org
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('org_id', orgId)
        .eq('role', 'admin')

      if (!adminProfiles?.length) continue

      const adminIds = adminProfiles.map(p => p.id)
      const adminEmails = adminUsers?.users
        ?.filter(u => adminIds.includes(u.id) && u.email)
        ?.map(u => u.email) ?? []

      if (!adminEmails.length) continue

      const rows = regs.map(r => {
        const name       = esc(`${r.first_name} ${r.last_name}`.trim())
        const eventLabel = esc(r.event?.name ?? `Event #${r.event?.event_number}`)
        const date       = r.event?.event_date
          ? new Date(r.event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : ''
        const status     = r.status === 'confirmed' ? 'confirmed' : 'pending' // whitelist
        const statusColor = status === 'confirmed' ? '#d1fae5' : '#fef3c7'
        const statusText  = status === 'confirmed' ? '#065f46' : '#92400e'
        return `
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 8px; font-size: 13px; font-weight: 600;">${name}</td>
            <td style="padding: 10px 8px; font-size: 13px; color: #4b5563;">${eventLabel}${date ? ` · ${esc(date)}` : ''}</td>
            <td style="padding: 10px 8px; font-size: 13px; color: #4b5563;">${r.email ? esc(r.email) : '—'}</td>
            <td style="padding: 10px 8px;"><span style="background:${statusColor};color:${statusText};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">${status}</span></td>
          </tr>`
      }).join('')

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1B4332; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #D4AF37; margin: 0; font-size: 20px;">Daily Registration Digest</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 14px;">${regs.length} new registration${regs.length !== 1 ? 's' : ''} in the last 24 hours</p>
          </div>
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f9fafb;">
                  <th style="padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Name</th>
                  <th style="padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Event</th>
                  <th style="padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Email</th>
                  <th style="padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Status</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div style="padding: 20px; border-top: 1px solid #f3f4f6;">
              <a href="https://www.scorifygolf.com/admin" style="background: #1B4332; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600;">Manage Registrations →</a>
            </div>
          </div>
          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">Scorify Golf · Daily digest sent every night at 8 PM.</p>
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
          subject: `Registration digest — ${regs.length} new registration${regs.length !== 1 ? 's' : ''} today`,
          html,
        }),
      })

      console.log(`Digest sent to ${adminEmails.join(', ')} for org ${orgId}`)
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('digest-registrations error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})

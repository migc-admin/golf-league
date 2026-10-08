/**
 * PlayerLink — permanent per-player URL, meant to be encoded onto a QR
 * code and/or a physical NFC tag that lives on the player's bag.
 *
 * Tapping/scanning it resolves straight to whatever event the player is
 * actively playing in today (no access code prompt) by looking up their
 * group's existing code and writing the same guest session Scorecard.jsx
 * already trusts. Possession of the link is the credential — no PIN.
 *
 * No login required. Carries over forever — same link works for every
 * future tournament the player plays in.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const GUEST_KEY = 'golf_guest_session'

export default function PlayerLink() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | invalid | no-event | no-code | redirecting
  const [playerName, setPlayerName] = useState('')

  useEffect(() => {
    let mounted = true

    async function resolve() {
      try {
        const { data: player } = await supabase
          .from('players')
          .select('id, first_name, last_name')
          .eq('player_link_token', token)
          .maybeSingle()

        if (!mounted) return
        if (!player) { setStatus('invalid'); return }
        setPlayerName(`${player.first_name ?? ''} ${player.last_name ?? ''}`.trim())

        // `events!inner(...)` forces Postgres to actually exclude event_players
        // rows whose event doesn't match the status filter, instead of just
        // nulling out the embedded `event` object and keeping the row (which
        // made `.limit(1)` grab a non-active event when a player belonged to
        // more than one, crashing on `ep.event.group_codes` below).
        const { data: ep } = await supabase
          .from('event_players')
          .select('event_id, group_number, event:events!inner(id, status, slug, group_codes, league:leagues(slug, org:organizations(slug)))')
          .eq('player_id', player.id)
          .not('group_number', 'is', null)
          .in('event.status', ['active'])
          .order('event_id', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!mounted) return
        if (!ep || !ep.event) { setStatus('no-event'); return }

        const groupCodes = ep.event.group_codes ?? {}
        const code = groupCodes[String(ep.group_number)]
        if (!code) { setStatus('no-code'); return }

        localStorage.setItem(GUEST_KEY, JSON.stringify({
          eventId: ep.event.id,
          groupNum: ep.group_number,
          accessCode: code,
          selectedName: `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim(),
          _expires: Date.now() + 12 * 60 * 60 * 1000,
        }))

        const orgSlug    = ep.event.league?.org?.slug ?? ep.event.league?.slug ?? 'org'
        const leagueSlug = ep.event.league?.slug ?? 'league'
        const eventSlug  = ep.event.slug ?? ep.event.id

        setStatus('redirecting')
        navigate(`/${orgSlug}/${leagueSlug}/${eventSlug}/scorecard?eid=${ep.event.id}`, { replace: true })
      } catch {
        if (mounted) setStatus('invalid')
      }
    }

    resolve()
    return () => { mounted = false }
  }, [token, navigate])

  const bg = { background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 45%,#1f5c3e 100%)' }

  if (status === 'loading' || status === 'redirecting') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bg}>
        <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  const messages = {
    invalid: { title: 'Link not recognized.', body: 'Contact your admin to get a new tag.' },
    'no-event': {
      title: playerName ? `No event today, ${playerName}.` : 'No event today.',
      body: 'Check back once your next tournament is live.',
    },
    'no-code': { title: 'Scoring isn\u2019t open yet.', body: 'Ask your admin to set up today\u2019s access codes.' },
  }
  const msg = messages[status] ?? messages.invalid

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={bg}>
      <p className="text-white text-xl font-bold" style={{ fontFamily: "'Manrope', sans-serif" }}>{msg.title}</p>
      <p className="text-white/60 text-sm mt-2 max-w-xs">{msg.body}</p>
    </div>
  )
}

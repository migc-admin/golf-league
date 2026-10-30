/**
 * WagerTicket.jsx — a bettor's receipt, reopened from its link.
 * Route: /wager/:eventId/ticket/:ticketId   (public, like the bet form)
 *
 * No ticket is stored: tickets are rebuilt from the event's active wagers (lib/wagerTicket.js).
 * Settled results use the same computeWagerSettlement / wagerOutcomes as the results page.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { computeWagerSettlement, wagerOutcomes } from '../lib/wagerSettlement'
import { groupTickets, buildTicketView } from '../lib/wagerTicket'
import { useEmbeddedLogo } from '../lib/useEmbeddedLogo'
import WagerTicket from '../components/wager/WagerTicket'
import TicketActions from '../components/wager/TicketActions'
import Button from '../components/ui/Button'

const MIGC_ORG = import.meta.env.VITE_MIGC_ORG_ID

async function fetchActiveWagers(eventId) {
  const { data } = await supabase.from('wagers').select('*').eq('event_id', eventId).is('deleted_at', null).order('created_at')
  return data ?? []
}
async function fetchScores(eventId) {
  const { data } = await supabase.from('scores').select('player_id, hole_number, gross_score, putts').eq('event_id', eventId)
  return data ?? []
}

function Notice({ children, tone = 'text-ink-muted' }) {
  return <div className={`flex min-h-screen items-center justify-center bg-surface-dim px-4 text-center font-sans ${tone}`}>{children}</div>
}

export default function WagerTicketPage() {
  const { eventId, ticketId } = useParams()
  const captureRef = useRef(null)

  const [event,    setEvent]    = useState(null)
  const [players,  setPlayers]  = useState([])
  const [wagers,   setWagers]   = useState([])
  const [scores,   setScores]   = useState([])
  const [pairings, setPairings] = useState([])
  const [extra,    setExtra]    = useState({})
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: ev } = await supabase
        .from('events')
        .select('*, course:courses(*), league:leagues(name, logo_url, org_id)')
        .eq('id', eventId).single()
      if (cancelled) return
      if (!ev || ev.league?.org_id !== MIGC_ORG) { setError('This ticket is not available.'); setLoading(false); return }
      setEvent(ev)

      const [{ data: eps }, ws, sc, { data: mp }] = await Promise.all([
        supabase.from('event_players').select('*, player:players(first_name, last_name)').eq('event_id', eventId),
        fetchActiveWagers(eventId),
        fetchScores(eventId),
        supabase.from('match_pairings').select('*').eq('event_id', eventId).order('match_number'),
      ])
      if (cancelled) return
      setPlayers(eps ?? [])
      setWagers(ws)
      setScores(sc)
      setPairings(mp ?? [])

      // A pick can point at a player who has left the event; look their name up so it still shows.
      const inField = new Set((eps ?? []).map(e => e.player_id))
      const missing = new Set()
      for (const w of ws) for (const id of [w.pick_1st, w.pick_2nd, w.pick_match]) if (id && !inField.has(id)) missing.add(id)
      for (const m of mp ?? []) for (const id of [m.player_a_id, m.player_b_id]) if (id && !inField.has(id)) missing.add(id)
      if (missing.size > 0) {
        const { data: gone } = await supabase.from('players').select('id, first_name, last_name').in('id', [...missing])
        if (!cancelled) setExtra(Object.fromEntries((gone ?? []).map(p => [p.id, { first: p.first_name, last: p.last_name }])))
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [eventId])

  // Until the event is complete, keep the ticket's results fresh.
  useEffect(() => {
    if (!event || event.status === 'complete') return undefined
    const id = setInterval(async () => {
      const [ws, sc] = await Promise.all([fetchActiveWagers(eventId), fetchScores(eventId)])
      setWagers(ws)
      setScores(sc)
    }, 15000)
    return () => clearInterval(id)
  }, [event, eventId])

  const person = useMemo(() => pid => {
    const ep = players.find(p => p.player_id === pid)
    if (ep) return { first: ep.player.first_name, last: ep.player.last_name }
    return extra[pid] ?? null
  }, [players, extra])
  const nameOf = useMemo(() => pid => {
    const p = person(pid)
    return p ? `${p.first} ${p.last}` : '—'
  }, [person])
  const lastNameOf = useMemo(() => pid => person(pid)?.last ?? '—', [person])

  const leagueName = event?.league?.name
  const view = useMemo(() => {
    if (!event) return null
    const ticket = groupTickets(wagers, { eventId, leagueName }).find(t => t.id.toUpperCase() === String(ticketId).toUpperCase())
    if (!ticket) return null
    const final = event.status === 'complete'
    let settlement, outcomes
    if (final) {
      settlement = computeWagerSettlement({ active: wagers, players, scores, pairings, course: event.course, matchRules: event.match_rules })
      outcomes = wagerOutcomes(settlement, wagers, event.status)
    }
    return buildTicketView({ ticket, pairings, nameOf, lastNameOf, settlement, outcomes, final })
  }, [event, wagers, players, scores, pairings, nameOf, lastNameOf, eventId, leagueName, ticketId])

  const { logo, ready } = useEmbeddedLogo(event?.league?.logo_url)

  if (loading) return <Notice>Loading…</Notice>
  if (error)   return <Notice tone="text-red-600">{error}</Notice>
  if (!view) {
    return (
      <Notice tone="text-ink">
        <div>
          <div className="text-lg font-bold">Ticket not found</div>
          <p className="mt-1 text-sm text-ink-muted">This ticket may have been removed, or the link is incomplete.</p>
          <Button as={Link} to={`/wager/${eventId}`} variant="secondary" className="mt-4">Go to the wager board</Button>
        </div>
      </Notice>
    )
  }

  return (
    <div className="min-h-screen bg-surface-dim px-4 py-6 font-sans text-ink">
      <div ref={captureRef} className="mx-auto max-w-[420px]">
        <WagerTicket view={view} leagueName={leagueName} logoUrl={logo} eventName={event.name ?? `Event #${event.event_number}`} />
      </div>
      <TicketActions
        captureRef={captureRef}
        ticketId={view.id}
        ticketUrl={window.location.href}
        ready={ready}
        eventId={eventId}
        placeMore={{ to: `/wager/${eventId}` }}
      />
    </div>
  )
}

/**
 * WagerResults.jsx — read-only, winners-only results for an event's wagers.
 * Route: /wager/:eventId/results   (admin login required, same as the wager board)
 *
 * Same numbers as the board, the Excel export and the PNG: everything comes from
 * computeWagerSettlement, shaped for display by lib/wagerResultsView.js. Nothing here
 * calculates a pool, payout or winner.
 */

import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { computeWagerSettlement } from '../lib/wagerSettlement'
import { buildResultsModel, filterResults } from '../lib/wagerResultsView'
import WagerResultsHeader from '../components/wager-results/WagerResultsHeader'
import PoolSummaryCard from '../components/wager-results/PoolSummaryCard'
import WagerResultsCard from '../components/wager-results/WagerResultsCard'
import MatchWagersCard from '../components/wager-results/MatchWagersCard'

const MIGC_ORG = import.meta.env.VITE_MIGC_ORG_ID

async function fetchActiveWagers(eventId) {
  const { data } = await supabase.from('wagers').select('*').eq('event_id', eventId).is('deleted_at', null).order('created_at')
  return data ?? []
}

async function fetchScores(eventId) {
  const { data } = await supabase.from('scores').select('player_id, hole_number, gross_score, putts').eq('event_id', eventId)
  return data ?? []
}

function Notice({ children, tone = 'text-[#5F5F5A]' }) {
  return <div className={`flex min-h-screen items-center justify-center bg-[#F5F4F0] px-4 text-center ${tone}`}>{children}</div>
}

export default function WagerResults() {
  const { eventId } = useParams()
  const { isAdmin, loading: authLoading } = useAuth()

  const [event,    setEvent]    = useState(null)
  const [players,  setPlayers]  = useState([])
  const [members,  setMembers]  = useState([])
  const [wagers,   setWagers]   = useState([])
  const [scores,   setScores]   = useState([])
  const [pairings, setPairings] = useState([])
  const [extra,    setExtra]    = useState({}) // id -> name for picks no longer in the event
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [query,    setQuery]    = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: ev } = await supabase
        .from('events')
        .select('*, course:courses(*), league:leagues(name, logo_url, org_id)')
        .eq('id', eventId).single()
      if (cancelled) return
      if (!ev || ev.league?.org_id !== MIGC_ORG) { setError('This wager page is not available.'); setLoading(false); return }
      setEvent(ev)

      const [{ data: eps }, ws, sc, { data: mp }, { data: orgPlayers }] = await Promise.all([
        supabase.from('event_players').select('*, player:players(first_name, last_name)').eq('event_id', eventId),
        fetchActiveWagers(eventId),
        fetchScores(eventId),
        supabase.from('match_pairings').select('*').eq('event_id', eventId).order('match_number'),
        supabase.from('players').select('first_name, last_name').eq('org_id', ev.league.org_id),
      ])
      if (cancelled) return
      setPlayers(eps ?? [])
      setWagers(ws)
      setScores(sc)
      setPairings(mp ?? [])
      setMembers((orgPlayers ?? []).map(p => `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()).filter(Boolean))

      // A pick can point at a player who has left the event; look their name up so it still shows.
      const inField = new Set((eps ?? []).map(e => e.player_id))
      const missing = new Set()
      for (const w of ws) for (const id of [w.pick_1st, w.pick_2nd, w.pick_match]) if (id && !inField.has(id)) missing.add(id)
      for (const m of mp ?? []) for (const id of [m.player_a_id, m.player_b_id]) if (id && !inField.has(id)) missing.add(id)
      if (missing.size > 0) {
        const { data: gone } = await supabase.from('players').select('id, first_name, last_name').in('id', [...missing])
        if (!cancelled) setExtra(Object.fromEntries((gone ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`])))
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [eventId])

  // While the event is still being played, keep wagers and scores fresh.
  useEffect(() => {
    if (!event || event.status === 'complete') return undefined
    const id = setInterval(async () => {
      const [ws, sc] = await Promise.all([fetchActiveWagers(eventId), fetchScores(eventId)])
      setWagers(ws)
      setScores(sc)
    }, 15000)
    return () => clearInterval(id)
  }, [event, eventId])

  const nameOf = useMemo(() => pid => {
    if (!pid) return '—'
    const ep = players.find(p => p.player_id === pid)
    if (ep) return `${ep.player.first_name} ${ep.player.last_name}`
    return extra[pid] ? `${extra[pid]} (not in event)` : '—'
  }, [players, extra])

  const model = useMemo(() => {
    if (!event) return null
    const settlement = computeWagerSettlement({
      active: wagers, players, scores, pairings, course: event.course, matchRules: event.match_rules,
    })
    return buildResultsModel({ event, settlement, active: wagers, nameOf, memberNames: members })
  }, [event, wagers, players, scores, pairings, nameOf, members])

  if (authLoading || loading) return <Notice>Loading…</Notice>
  if (!isAdmin) return <Notice tone="text-[#1A1A1A]"><div><div className="text-lg font-bold text-red-600">Access Denied</div><div className="mt-1 text-sm text-[#5F5F5A]">Admin login required.</div><a href="/login" className="mt-3 inline-block text-sm font-semibold text-fairway-700">Sign in →</a></div></Notice>
  if (error) return <Notice tone="text-red-600">{error}</Notice>

  const shown = filterResults(model, query)
  const searching = query.trim().length > 0
  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div className="min-h-screen bg-[#F5F4F0] font-sans text-[#1A1A1A]">
      <div className="mx-auto max-w-[1120px] space-y-6 px-4 py-8">
        <div className="flex justify-end">
          <Link to={`/wager/${eventId}/board`} className="text-sm font-semibold text-fairway-700 hover:underline">← Wager board</Link>
        </div>

        <WagerResultsHeader
          clubName={event.league?.name}
          title={`${event.name ?? `Event #${event.event_number}`} · Wagers`}
          meta={[event.course?.name, eventDate].filter(Boolean).join(' · ')}
          statusLabel={model.statusLabel}
          final={model.final}
          logoUrl={event.league?.logo_url ?? '/logo.png'}
          query={query}
          onQuery={setQuery}
        />

        <PoolSummaryCard pools={model.pools} betsLabel={model.betsLabel} />

        {(shown.panels.length > 0 || !searching) && (
          <WagerResultsCard panels={shown.panels} final={model.final} emptyMessage="No results yet. They appear once scores are entered." />
        )}

        {(shown.matches.length > 0 || !searching) && (
          <MatchWagersCard matches={shown.matches} />
        )}

        {searching && shown.panels.length === 0 && shown.matches.length === 0 && (
          <p className="py-6 text-center text-sm text-[#5F5F5A]">No winning bets match “{query.trim()}”.</p>
        )}

        <p className="text-center text-[10px] text-[#9ca3af]">
          Full pool paid to winner(s). If no one picks the winner, funds roll to the club. Halved matches refund stakes.
        </p>
      </div>
    </div>
  )
}

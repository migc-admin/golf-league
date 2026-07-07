/**
 * Season Standings
 * Computed live from scores + payout engine across all completed events.
 * No dependency on season_earnings table.
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Card from '../components/ui/Card'
import { computeLeaderboards } from '../lib/engines/scoring'
import { computeAllSkins } from '../lib/engines/skins'
import { computePayouts } from '../lib/engines/payouts'
import { computeTGLEventResults, computeTGLSeasonStandings } from '../lib/engines/tgl'

export default function Standings() {
  const { orgSlug, leagueSlug } = useParams()
  const [league,       setLeague]       = useState(null)
  const [events,       setEvents]       = useState([])
  const [standings,    setStandings]    = useState([])   // earnings: [{ player, totalEarnings, eventsPlayed, byEvent }]
  const [tglStandings, setTglStandings] = useState([])   // tgl: [{ team, seasonPoints, rank }]
  const [tglEventRows, setTglEventRows] = useState([])   // per-event TGL detail [{ event, teamResults }]
  const [loading,      setLoading]      = useState(true)
  const [view,         setView]         = useState('earnings')

  useEffect(() => {
    async function load() {
      const { data: lg } = await supabase.from('leagues').select('*').eq('slug', leagueSlug).single()
      if (!lg) { setLoading(false); return }
      setLeague(lg)

      // Load all completed events with course data
      const { data: evs } = await supabase
        .from('events')
        .select('*, course:courses(*)')
        .eq('league_id', lg.id)
        .eq('status', 'complete')
        .order('event_number')

      setEvents(evs ?? [])
      if (!evs?.length) { setLoading(false); return }

      const eventIds = evs.map(e => e.id)

      // Bulk load all data for completed events
      const [
        { data: allEPs },
        { data: allScores },
        { data: allSideGames },
        { data: tglT },
        { data: tglSels },
        { data: tglLocks },
      ] = await Promise.all([
        supabase.from('event_players').select('*, player:players(*)').in('event_id', eventIds),
        supabase.from('scores').select('*').in('event_id', eventIds),
        supabase.from('side_games').select('*, winner:players(first_name,last_name)').in('event_id', eventIds),
        supabase.from('tgl_teams').select('*').eq('league_id', lg.id).order('name'),
        supabase.from('tgl_event_selections').select('*').in('event_id', eventIds),
        supabase.from('tgl_event_locks').select('event_id').in('event_id', eventIds),
      ])

      const lockedEventIds = new Set((tglLocks ?? []).map(l => l.event_id))

      // DEBUG — remove after diagnosing
      console.log('[TGL debug]', {
        completedEvents: evs?.length,
        eventIds,
        tglTeams: tglT?.length,
        tglSels: tglSels?.length,
        tglLocks: tglLocks?.length,
        lockedEventIds: [...(new Set((tglLocks ?? []).map(l => l.event_id)))],
        sampleEvent: evs?.[0] ? { id: evs[0].id, courseKeys: Object.keys(evs[0].course ?? {}) } : null,
      })

      // Load TGL team members
      let tglMembers = []
      if (tglT?.length) {
        const { data: m } = await supabase
          .from('tgl_team_members')
          .select('*, player:players(first_name,last_name)')
          .in('team_id', tglT.map(t => t.id))
        tglMembers = m ?? []
      }

      // ── Earnings standings ──────────────────────────────────────────
      const playerEarnings = {}  // playerId → { player, totalEarnings, eventsPlayed, byEvent: {} }

      for (const ev of evs) {
        const course = ev.course
        if (!course) continue
        const eps       = (allEPs      ?? []).filter(ep => ep.event_id === ev.id)
        const scores    = (allScores   ?? []).filter(s  => s.event_id  === ev.id)
        const sideGames = (allSideGames ?? []).filter(sg => sg.event_id === ev.id)
        if (!eps.length) continue

        const nonGuest     = eps.filter(ep => !ep.is_guest)
        const flightCounts = {
          A: nonGuest.filter(ep => ep.flight === 'A').length,
          B: nonGuest.filter(ep => ep.flight === 'B').length,
        }

        try {
          const leaderboards = computeLeaderboards(nonGuest, scores, course)
          const skinsResults = computeAllSkins(nonGuest, scores, course.stroke_index)
          const { byPlayer } = computePayouts(ev, nonGuest.length, leaderboards, sideGames, skinsResults, flightCounts)

          for (const { playerId, total } of byPlayer) {
            const ep = eps.find(e => e.player_id === playerId)
            if (!playerEarnings[playerId]) {
              playerEarnings[playerId] = {
                player: ep?.player ?? null,
                totalEarnings: 0,
                eventsPlayed: 0,
                byEvent: {},
              }
            }
            playerEarnings[playerId].totalEarnings += total
            playerEarnings[playerId].eventsPlayed  += 1
            playerEarnings[playerId].byEvent[ev.id] = total
          }
        } catch { /* skip event if engine errors */ }
      }

      const sorted = Object.values(playerEarnings).sort((a, b) => b.totalEarnings - a.totalEarnings)
      setStandings(sorted)

      // ── TGL standings ───────────────────────────────────────────────
      if (tglT?.length) {
        const teams = tglT
        const eventResultsByEventId = {}
        const eventRows = []

        for (const ev of evs) {
          if (!lockedEventIds.has(ev.id)) { console.log('[TGL] skipped - not locked', ev.id); continue }
          const course = ev.course
          if (!course?.stroke_index || !course?.par_per_hole) { console.log('[TGL] skipped - missing course arrays', { stroke_index: !!course?.stroke_index, par_per_hole: !!course?.par_per_hole }); continue }
          const eps   = (allEPs    ?? []).filter(ep => ep.event_id === ev.id)
          const scs   = (allScores ?? []).filter(s  => s.event_id  === ev.id)
          const sels  = (tglSels  ?? []).filter(s  => s.event_id  === ev.id)
          console.log('[TGL] event data', { eps: eps.length, scs: scs.length, sels: sels.length, tglMembers: tglMembers.length })
          if (!eps.length || !scs.length || !sels.length) { console.log('[TGL] skipped - missing data'); continue }
          try {
            const lb     = computeLeaderboards(eps, scs, course)
            const ranked = lb.net?.ranked ?? lb.gross?.ranked ?? []
            console.log('[TGL] ranked', ranked.length, 'lb keys', Object.keys(lb))
            if (!ranked.length) { console.log('[TGL] skipped - no ranked players'); continue }
            const epMap = Object.fromEntries(eps.map(ep => [ep.player_id, ep]))
            const rankedWithPlayer = ranked.map(r => ({ ...r, player: epMap[r.player_id]?.player ?? null }))
            const result = computeTGLEventResults(rankedWithPlayer, sels, teams, tglMembers)
            eventResultsByEventId[ev.id] = result
            eventRows.push({ event: ev, teamResults: result.teamResults })
          } catch (err) { console.error('[TGL] compute error', err) }
        }

        setTglStandings(computeTGLSeasonStandings(eventResultsByEventId, teams))
        setTglEventRows(eventRows)
      }

      setLoading(false)
    }
    load()
  }, [leagueSlug])

  const views = ['earnings', ...(tglStandings.length > 0 ? ['tgl'] : [])]

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <svg className="animate-spin h-8 w-8 text-fairway-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-fairway-700 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/admin" className="text-fairway-300 text-xs hover:text-white">← Home</Link>
          <h1 className="text-xl font-bold mt-1">Season Standings</h1>
          <p className="text-fairway-200 text-sm">
            {league?.name} · {league?.season_year} · {events.length} event{events.length !== 1 ? 's' : ''} complete
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {/* View toggle */}
        {views.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {views.map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  view === v ? 'bg-fairway-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {v === 'earnings' ? 'Earnings' : 'TGL Teams'}
              </button>
            ))}
          </div>
        )}

        {view === 'tgl' ? (
          <TGLStandingsTable standings={tglStandings} eventRows={tglEventRows} events={events} />
        ) : standings.length === 0 ? (
          <Card className="text-center py-12">
            <div className="text-4xl mb-3">🏆</div>
            <p className="text-gray-500 font-medium">No earnings data yet</p>
            <p className="text-sm text-gray-400 mt-1">Earnings are calculated from completed events with payout configurations.</p>
          </Card>
        ) : (
          <EarningsTable standings={standings} events={events} />
        )}
      </div>
    </div>
  )
}

function EarningsTable({ standings, events }) {
  const medals = ['🥇', '🥈', '🥉']
  const [showBreakdown, setShowBreakdown] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowBreakdown(v => !v)}
          className="text-xs text-fairway-700 hover:underline font-medium"
        >
          {showBreakdown ? 'Hide event breakdown' : 'Show event breakdown'}
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 border-b">
                <th className="px-5 py-3 sticky left-0 bg-gray-50 z-10">Rank</th>
                <th className="px-4 py-3 sticky left-12 bg-gray-50 z-10">Player</th>
                <th className="px-4 py-3 text-center">Events</th>
                {showBreakdown && events.map(ev => (
                  <th key={ev.id} className="px-3 py-3 text-right whitespace-nowrap">
                    #{ev.event_number}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {standings.map((s, i) => (
                <tr key={s.player?.id ?? i} className={i < 3 ? 'bg-yellow-50/50' : ''}>
                  <td className="px-5 py-3 text-base sticky left-0 bg-inherit z-10">{medals[i] ?? i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 sticky left-12 bg-inherit z-10 whitespace-nowrap">
                    {s.player?.last_name}, {s.player?.first_name}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{s.eventsPlayed}</td>
                  {showBreakdown && events.map(ev => (
                    <td key={ev.id} className="px-3 py-3 text-right text-gray-600">
                      {s.byEvent[ev.id] ? `$${s.byEvent[ev.id].toFixed(2)}` : '—'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold text-fairway-700">
                    ${s.totalEarnings.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function TGLStandingsTable({ standings, eventRows, events }) {
  const medals = ['🥇', '🥈', '🥉']
  const [expandedEvent, setExpandedEvent] = useState(null)

  return (
    <div className="space-y-4">
      {/* Season totals */}
      <Card className="overflow-hidden p-0">
        <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Season Totals</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-gray-500 border-b border-gray-100">
              <th className="px-5 py-2">Rank</th>
              <th className="px-4 py-2">Team</th>
              <th className="px-4 py-2 text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {standings.map((s, i) => (
              <tr key={s.team.id} className={i < 3 ? 'bg-yellow-50/50' : ''}>
                <td className="px-5 py-3 text-base">{medals[i] ?? i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.team.color }} />
                    <span className="font-semibold text-gray-900">{s.team.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-bold text-fairway-700">
                  {s.seasonPoints % 1 === 0 ? s.seasonPoints : s.seasonPoints.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Per-event breakdown */}
      {eventRows.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-1">Event Results</h3>
          {eventRows.map(({ event: ev, teamResults }) => (
            <Card key={ev.id} className="overflow-hidden p-0">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                onClick={() => setExpandedEvent(expandedEvent === ev.id ? null : ev.id)}
              >
                <span className="font-medium text-gray-800 text-sm">
                  Event #{ev.event_number}{ev.name ? ` — ${ev.name}` : ''} · {ev.course?.name}
                </span>
                <span className="text-gray-400 text-xs">{expandedEvent === ev.id ? '▲' : '▼'}</span>
              </button>

              {expandedEvent === ev.id && (
                <table className="w-full text-sm border-t border-gray-100">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-2">Team</th>
                      <th className="px-4 py-2">Players</th>
                      <th className="px-4 py-2 text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {teamResults.map(tr => (
                      <tr key={tr.team.id}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tr.team.color }} />
                            <span className="font-medium text-gray-800">{tr.team.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {tr.selectedPlayers.map(p =>
                            `${p.name} (#${p.rank ?? '?'}, ${p.points % 1 === 0 ? p.points : p.points.toFixed(1)}pts)`
                          ).join(' · ') || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-900">
                          {tr.teamPoints % 1 === 0 ? tr.teamPoints : tr.teamPoints.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Points: field size − finishing position + 1 · ties split combined places equally
      </p>
    </div>
  )
}

/**
 * Live Leaderboard
 * Auto-updates via Supabase Realtime on scores changes.
 * Tabs: 18-Hole | Front 9 | Back 9 | Low Putts | Skins
 */

import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { computeLeaderboards, computeStableford } from '../lib/engines/scoring'
import { computeAllSkins } from '../lib/engines/skins'
import { computeMatchPoints } from '../lib/engines/matchPoints'
import { computePayouts, CATEGORY_LABELS, ctpLabel } from '../lib/engines/payouts'
import { FlightBadge, StatusBadge } from '../components/ui/Badge'

const ALL_TABS = ['18-Hole', 'Front 9', 'Back 9', 'Stableford', 'Match Points', 'Low Putts', 'Skins', 'Payouts']

function visibleTabs(event) {
  if (!event) return ALL_TABS
  const formats  = event.formats ?? (event.format ? [event.format] : ['net_stroke'])
  const sideOpts = event.side_game_options ?? []
  return ALL_TABS.filter(tab => {
    if (tab === 'Payouts')       return true
    if (tab === '18-Hole')       return formats.includes('net_stroke')
    if (tab === 'Front 9')       return formats.includes('net_stroke_front9')
    if (tab === 'Back 9')        return formats.includes('net_stroke_back9')
    if (tab === 'Stableford')    return formats.includes('stableford')
    if (tab === 'Match Points')  return formats.includes('match_points') || formats.includes('ryder_cup')
    if (tab === 'Low Putts')     return sideOpts.includes('low_putts')
    if (tab === 'Skins')         return sideOpts.some(s => s.startsWith('skins_'))
    return false
  })
}

const FORMAT_LABELS = {
  net_stroke:   'Net Stroke Play',
  stableford:   'Stableford',
  match_points: 'Match Play Points',
  ryder_cup:    'Ryder Cup',
}

export default function Leaderboard() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAdmin } = useAuth()
  const homeLink = isAdmin ? '/admin' : user ? '/home' : null
  const fromScorecard = location.state?.from === 'scorecard'
  const scorecardEventId = location.state?.scorecardEventId ?? eventId
  const [event,        setEvent]        = useState(null)
  const [eventPlayers, setEventPlayers] = useState([])
  const [allScores,    setAllScores]    = useState([])
  const [sideGames,    setSideGames]    = useState([])
  const [course,       setCourse]       = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState('18-Hole')
  const [activeFlight, setActiveFlight] = useState('A')

  const subRef = useRef(null)
  const tabs   = event ? visibleTabs(event) : ALL_TABS

  async function loadScores(evId) {
    const { data } = await supabase.from('scores').select('*').eq('event_id', evId)
    setAllScores(data ?? [])
  }

  useEffect(() => {
    async function init() {
      const { data: ev } = await supabase
        .from('events')
        .select('*, course:courses(*), league:leagues(name)')
        .eq('id', eventId)
        .single()
      if (!ev) { setLoading(false); return }

      const [{ data: eps }, { data: sg }] = await Promise.all([
        supabase.from('event_players').select('*, player:players(*)').eq('event_id', eventId),
        supabase.from('side_games').select('*, winner:players(first_name,last_name)').eq('event_id', eventId),
      ])

      setEvent(ev)
      setCourse(ev.course)
      setEventPlayers(eps ?? [])
      setSideGames(sg ?? [])
      await loadScores(eventId)
      setLoading(false)

      // Auto-switch to Payouts tab if event is complete, else first visible tab
      const tvs = visibleTabs(ev)
      setActiveTab(ev.status === 'complete' ? 'Payouts' : (tvs[0] ?? 'Payouts'))

      // Subscribe to realtime score changes
      subRef.current = supabase
        .channel(`scores:${eventId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'scores',
          filter: `event_id=eq.${eventId}`,
        }, () => loadScores(eventId))
        .subscribe()
    }
    init()

    return () => {
      if (subRef.current) supabase.removeChannel(subRef.current)
    }
  }, [eventId])

  if (loading) return <LeaderboardSkeleton />
  if (!event)  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Event not found.</p>
    </div>
  )

  const leaderboards    = course ? computeLeaderboards(eventPlayers, allScores, course)              : null
  const skinsResults    = course ? computeAllSkins(eventPlayers, allScores, course.stroke_index)     : null
  const stablefordData  = course ? computeStableford(eventPlayers, allScores, course)                : null
  const matchData       = course ? computeMatchPoints(eventPlayers, allScores, course)               : null

  const playerMap  = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep.player]))
  const hasFlights = eventPlayers.some(ep => !ep.is_guest && (ep.flight === 'A' || ep.flight === 'B'))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back nav */}
      <div className="bg-fairway-900 text-white px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-fairway-300 hover:text-white text-sm transition-colors"
        >
          ← {fromScorecard ? 'Back to Scoring' : 'Back'}
        </button>
        {homeLink && (
          <Link to={homeLink} className="text-fairway-300 hover:text-white text-sm transition-colors flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            Home
          </Link>
        )}
      </div>

      {/* Header */}
      <div className="bg-fairway-700 text-white shadow-lg sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-bold text-base">{event.course?.name}</div>
            <div className="text-xs text-fairway-200 mt-0.5">
              {event.league?.name} · Event #{event.event_number} · {formatDate(event.event_date)}
            </div>
            {event.format && event.format !== 'net_stroke' && (
              <div className="text-xs text-fairway-300 mt-0.5">{FORMAT_LABELS[event.format] ?? event.format}</div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={event.status} />
            <Link to={`/schedule/${event.id}`} className="text-xs text-fairway-300 hover:text-white">
              Pairings ↗
            </Link>
          </div>
        </div>

        {/* Tabs — pill style */}
        <div className="max-w-2xl mx-auto border-t border-fairway-600/50">
          <div className="flex overflow-x-auto px-3 py-2 gap-1">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-label={`View ${tab} leaderboard`}
                aria-pressed={activeTab === tab}
                className={`flex-none px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer rounded-full ${
                  activeTab === tab
                    ? 'bg-white text-fairway-900'
                    : 'text-fairway-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Flight toggle — only shown when flights are in use */}
      {hasFlights && !['Low Putts', 'Skins', 'Match Points', 'Payouts'].includes(activeTab) && (
        <div className="max-w-2xl mx-auto px-4 pt-4 flex gap-2">
          {['A', 'B'].map(f => (
            <button
              key={f}
              onClick={() => setActiveFlight(f)}
              aria-label={`View Flight ${f}`}
              aria-pressed={activeFlight === f}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                activeFlight === f
                  ? f === 'A'
                    ? 'bg-blue-600 text-white'
                    : 'bg-purple-600 text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
              }`}
            >
              Flight {f}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {leaderboards && (
          <>
            {activeTab === '18-Hole' && (
              <NetLeaderboard
                complete={leaderboards.full[activeFlight]}
                inProgress={leaderboards.full[`${activeFlight}InProgress`]}
                flight={activeFlight}
                vsParKey="netVsPar"
                grossKey="gross18"
                netKey="net18"
                handicapKey="course_handicap"
                progressHolesKey="holesCompleted"
                maxHoles={18}
                allScores={allScores}
                course={course}
              />
            )}
            {activeTab === 'Front 9' && (
              <NetLeaderboard
                complete={leaderboards.front9[activeFlight]}
                inProgress={leaderboards.front9[`${activeFlight}InProgress`]}
                flight={activeFlight}
                vsParKey="f9VsPar"
                grossKey="grossF9"
                netKey="netF9"
                handicapKey="f9Handicap"
                progressHolesKey="f9Holes"
                maxHoles={9}
                allScores={allScores}
                course={course}
              />
            )}
            {activeTab === 'Back 9' && (
              <NetLeaderboard
                complete={leaderboards.back9[activeFlight]}
                inProgress={leaderboards.back9[`${activeFlight}InProgress`]}
                flight={activeFlight}
                vsParKey="b9VsPar"
                grossKey="grossB9"
                netKey="netB9"
                handicapKey="b9Handicap"
                progressHolesKey="b9Holes"
                maxHoles={9}
                allScores={allScores}
                course={course}
              />
            )}
            {activeTab === 'Low Putts' && (
              <PuttLeaderboard data={leaderboards.putts} playerMap={playerMap} allScores={allScores} course={course} />
            )}
          </>
        )}
        {activeTab === 'Stableford' && stablefordData && (
          <StablefordLeaderboard data={stablefordData} activeFlight={activeFlight} />
        )}
        {activeTab === 'Match Points' && matchData && (
          <MatchPointsBoard matchData={matchData} />
        )}
        {activeTab === 'Skins' && skinsResults && (
          <SkinsBoard skinsResults={skinsResults} playerMap={playerMap} />
        )}
        {activeTab === 'Payouts' && (
          <PayoutsBoard
            event={event}
            eventPlayers={eventPlayers}
            leaderboards={leaderboards}
            sideGames={sideGames}
            skinsResults={skinsResults}
            playerMap={playerMap}
          />
        )}
      </div>
    </div>
  )
}

// ─── Net Leaderboard ──────────────────────────────────────────────
function NetLeaderboard({ complete, inProgress, flight, vsParKey = 'netVsPar', grossKey = 'gross18', netKey = 'net18', handicapKey = 'course_handicap', progressHolesKey = 'holesCompleted', maxHoles = 18, allScores = [], course = null }) {
  const [scorecardPlayer, setScorecardPlayer] = useState(null)
  if (!complete?.length && !inProgress?.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <svg className="mx-auto mb-3 w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
        <p className="font-medium">No scores yet for Flight {flight}</p>
      </div>
    )
  }

  const allComplete = complete ?? []

  function rankLabel(p) {
    const tied = allComplete.filter(x => x.rank === p.rank).length > 1
    return tied ? `T${p.rank}` : `${p.rank}`
  }

  function scoreDisplay(p) {
    const vs = p[vsParKey]
    return vs == null ? '—' : vs === 0 ? 'E' : `${vs > 0 ? '+' : ''}${vs}`
  }

  function scoreColor(p) {
    const vs = p[vsParKey]
    return vs < 0 ? 'text-[#BA1A1A] font-bold' : vs === 0 ? 'text-gray-700' : 'text-gray-500'
  }

  // Merge all players and sort by score — lowest net score wins regardless of holes played
  const allPlayers = [
    ...(allComplete ?? []).map(p => ({ ...p, finished: true })),
    ...(inProgress  ?? []).map(p => ({ ...p, finished: false })),
  ].sort((a, b) => {
    const aVs = a[vsParKey] ?? 999
    const bVs = b[vsParKey] ?? 999
    return aVs - bVs
  })

  // Assign display ranks across merged list (ties share rank)
  const withRanks = allPlayers.map((p, _, arr) => {
    const vs = p[vsParKey]
    const rank = arr.filter(x => (x[vsParKey] ?? 999) < (vs ?? 999)).length + 1
    const tied = arr.filter(x => x[vsParKey] === vs).length > 1
    return { ...p, mergedRank: rank, mergedRankLabel: tied ? `T${rank}` : `${rank}` }
  })

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-[0_4px_20px_rgba(27,67,50,0.08)]">
      {/* Table header */}
      <div className="grid grid-cols-[2.5rem_1fr_3.5rem_3rem] bg-[#012d1d] text-white/80 text-[10px] font-bold uppercase tracking-widest px-4 py-2.5">
        <span>Pos</span>
        <span>Player</span>
        <span className="text-right">Score</span>
        <span className="text-right">Thru</span>
      </div>

      {withRanks.map((p, i) => {
        const holesThru = p.finished
          ? (p.holesCompleted ?? p.f9Holes ?? p.b9Holes ?? 18)
          : (p[progressHolesKey] ?? 0)
        const isFirst = p.mergedRank === 1
        return (
          <div
            key={p.player_id}
            onClick={() => course && setScorecardPlayer(p)}
            className={`grid grid-cols-[2.5rem_1fr_3.5rem_3rem] items-center px-4 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-fairway-50 transition-colors ${i % 2 === 1 ? 'bg-[rgba(27,67,50,0.025)]' : 'bg-white'} ${isFirst ? 'border-l-2 border-l-[#cba72f]' : ''}`}
          >
            <span className="text-sm font-semibold text-gray-500 tabular-nums">{p.mergedRankLabel}</span>
            <div>
              <div className="font-semibold text-sm text-gray-900 leading-tight">
                {p.player?.last_name}, {p.player?.first_name}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                CH {p[handicapKey] ?? p.course_handicap} · Gross {p[grossKey] ?? '—'}
              </div>
            </div>
            <span className={`text-sm tabular-nums text-right ${scoreColor(p)}`}>
              {scoreDisplay(p)}
            </span>
            <span className="text-xs text-gray-400 text-right tabular-nums">
              {p.finished && holesThru === maxHoles ? 'F' : holesThru || '—'}
            </span>
          </div>
        )
      })}
      {scorecardPlayer && course && (
        <PlayerScorecardModal
          player={scorecardPlayer}
          allScores={allScores}
          course={course}
          onClose={() => setScorecardPlayer(null)}
        />
      )}
    </div>
  )
}

// ─── Putt Leaderboard ─────────────────────────────────────────────
function PuttLeaderboard({ data, playerMap, allScores = [], course = null }) {
  const [scorecardPlayer, setScorecardPlayer] = useState(null)
  if (!data?.length) return (
    <div className="text-center py-12 text-gray-400">
      <p>No complete rounds yet.</p>
    </div>
  )

  // Assign ranks with tie detection (lowest putts = best)
  const ranked = data.map((p, i, arr) => {
    const tiedWith = arr.filter(x => x.totalPutts === p.totalPutts)
    const rank = arr.filter(x => x.totalPutts < p.totalPutts).length + 1
    const rankLabel = tiedWith.length > 1 ? `T${rank}` : `${rank}`
    return { ...p, rank, rankLabel }
  })

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-[0_4px_20px_rgba(27,67,50,0.08)]">
      <div className="grid grid-cols-[2.5rem_1fr_3.5rem] bg-[#012d1d] text-white/80 text-[10px] font-bold uppercase tracking-widest px-4 py-2.5">
        <span>Pos</span>
        <span>Player</span>
        <span className="text-right">Putts</span>
      </div>
      {ranked.map((p, i) => (
        <div key={p.player_id}
          onClick={() => course && setScorecardPlayer(p)}
          className={`grid grid-cols-[2.5rem_1fr_3.5rem] items-center px-4 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-fairway-50 transition-colors ${i % 2 === 1 ? 'bg-[rgba(27,67,50,0.025)]' : 'bg-white'} ${p.rank === 1 ? 'border-l-2 border-l-[#cba72f]' : ''}`}
        >
          <span className="text-sm font-semibold text-gray-500 tabular-nums">{p.rankLabel}</span>
          <div className="font-medium text-sm text-gray-900">
            {p.player?.last_name}, {p.player?.first_name}
          </div>
          <span className="text-sm font-black tabular-nums text-fairway-700 text-right">{p.totalPutts}</span>
        </div>
      ))}
      {scorecardPlayer && course && (
        <PlayerScorecardModal
          player={scorecardPlayer}
          allScores={allScores}
          course={course}
          onClose={() => setScorecardPlayer(null)}
        />
      )}
    </div>
  )
}

// ─── Skins Board ──────────────────────────────────────────────────
function SkinsBoard({ skinsResults, playerMap }) {
  const [flight, setFlight] = useState('A')
  const result = skinsResults[flight]

  const totalSkins = Object.values(result.playerSkins).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['A', 'B'].map(f => (
          <button
            key={f}
            onClick={() => setFlight(f)}
            aria-label={`View Flight ${f} skins`}
            aria-pressed={flight === f}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
              flight === f
                ? f === 'A' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            Flight {f}
          </button>
        ))}
      </div>

      {result.carryoverToNext && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-800">
          {result.carryoverAmount} skin{result.carryoverAmount !== 1 ? 's' : ''} carry to next event (no winner this round)
        </div>
      )}

      {/* Player skin totals */}
      {totalSkins > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-sm text-gray-800">Skins Won — Flight {flight}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {Object.entries(result.playerSkins)
              .filter(([, c]) => c > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([pid, count]) => {
                const p = playerMap[pid]
                return (
                  <div key={pid} className="flex items-center justify-between px-4 py-3">
                    <span className="font-medium text-sm text-gray-900">
                      {p ? `${p.last_name}, ${p.first_name}` : pid}
                    </span>
                    <span className="font-black text-fairway-700 text-lg">{count} skin{count !== 1 ? 's' : ''}</span>
                  </div>
                )
              })
            }
          </div>
        </div>
      )}

      {/* Hole-by-hole */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-sm text-gray-800">Hole-by-Hole Skins</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {result.holes.map(h => {
            if (h.incomplete) return null
            const winner = h.winner ? playerMap[h.winner] : null
            return (
              <div key={h.hole} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-8 text-sm font-semibold text-gray-500">#{h.hole}</span>
                {h.tied && !h.winner && (
                  <span className="text-xs text-orange-500 font-medium">
                    Tied — {h.carryoverIn + 1} skin{h.carryoverIn + 1 !== 1 ? 's' : ''} carried
                  </span>
                )}
                {h.winner && (
                  <>
                    <span className="text-xs text-fairway-700 font-semibold">
                      {winner ? `${winner.last_name}, ${winner.first_name}` : h.winner}
                    </span>
                    <span className="ml-auto text-xs font-bold text-gray-600">
                      {h.skinsWon} skin{h.skinsWon !== 1 ? 's' : ''}
                      {h.carryoverIn > 0 && <span className="text-orange-500"> (+{h.carryoverIn} carry)</span>}
                      {h.wraparound > 0 && <span className="text-purple-500"> (+{h.wraparound} wraparound)</span>}
                    </span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Stableford Leaderboard ───────────────────────────────────────
function StablefordLeaderboard({ data, activeFlight }) {
  const list = data[activeFlight] ?? []

  if (!list.length) return (
    <div className="text-center py-12 text-gray-400">
      <svg className="mx-auto mb-3 w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>
      <p className="font-medium">No scores yet for Flight {activeFlight}</p>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-[0_4px_20px_rgba(27,67,50,0.08)]">
        <div className="grid grid-cols-[2.5rem_1fr_3.5rem] bg-[#012d1d] text-white/80 text-[10px] font-bold uppercase tracking-widest px-4 py-2.5">
          <span>Pos</span>
          <span>Player</span>
          <span className="text-right">Pts</span>
        </div>
        {list.map((p, i) => (
          <div key={p.player_id}
            className={`grid grid-cols-[2.5rem_1fr_3.5rem] items-center px-4 py-3 border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-[rgba(27,67,50,0.025)]' : 'bg-white'} ${i === 0 ? 'border-l-2 border-l-[#cba72f]' : ''}`}
          >
            <span className="text-sm font-semibold text-gray-500 tabular-nums">{i + 1}</span>
            <div>
              <div className="font-semibold text-sm text-gray-900 leading-tight">
                {p.player?.last_name}, {p.player?.first_name}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                CH {p.course_handicap} · {p.holesPlayed} holes
              </div>
            </div>
            <span className="text-sm font-black tabular-nums text-fairway-700 text-right">{p.totalPoints}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-gray-400">Eagle=4 · Birdie=3 · Par=2 · Bogey=1 · DBL+=0 (net)</p>
    </div>
  )
}

// ─── Match Points Board ───────────────────────────────────────────
function MatchPointsBoard({ matchData }) {
  const { pairings, teamPoints, ranked } = matchData

  if (!pairings.length) return (
    <div className="text-center py-12 text-gray-400">
      <svg className="mx-auto mb-3 w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>
      <p className="font-medium">Pairings not yet set up</p>
      <p className="text-sm mt-1">Groups need A and B flight players to generate match play pairings.</p>
    </div>
  )

  const totalHolesA = teamPoints.A + teamPoints.B > 0
  const teamLeader = teamPoints.A > teamPoints.B ? 'Flight A' : teamPoints.B > teamPoints.A ? 'Flight B' : 'All Square'

  return (
    <div className="space-y-4">
      {/* Team score banner (Ryder Cup style) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Team Score</h3>
        </div>
        <div className="flex">
          <div className="flex-1 text-center py-4 bg-blue-50">
            <div className="text-xs font-bold text-blue-600 mb-1">Flight A</div>
            <div className="text-4xl font-black text-blue-700">{teamPoints.A}</div>
          </div>
          <div className="w-px bg-gray-200" />
          <div className="flex-1 text-center py-4 bg-purple-50">
            <div className="text-xs font-bold text-purple-600 mb-1">Flight B</div>
            <div className="text-4xl font-black text-purple-700">{teamPoints.B}</div>
          </div>
        </div>
        <div className="text-center py-2 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-600">{teamLeader}</span>
        </div>
      </div>

      {/* Individual pairings */}
      {pairings.map((pair, idx) => (
        <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">Group {pair.groupNumber} — Match {idx + 1}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              pair.winner === 'A' ? 'bg-blue-100 text-blue-700' :
              pair.winner === 'B' ? 'bg-purple-100 text-purple-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {pair.holesPlayed < 18 ? pair.matchStatus : pair.winner === 'halve' ? 'Halved' : pair.winner === 'A' ? 'A Wins' : 'B Wins'}
            </span>
          </div>

          {/* Players */}
          <div className="flex divide-x divide-gray-100">
            <div className="flex-1 px-4 py-3">
              <div className="text-xs font-bold text-blue-600 mb-1">Flight A</div>
              <div className="font-semibold text-sm text-gray-900">
                {pair.playerA.player?.last_name}, {pair.playerA.player?.first_name}
              </div>
              <div className="text-xs text-gray-400">CH: {pair.playerA.course_handicap}</div>
              <div className="text-2xl font-black text-blue-700 mt-1">{pair.pointsA}</div>
            </div>
            <div className="flex-1 px-4 py-3">
              <div className="text-xs font-bold text-purple-600 mb-1">Flight B</div>
              <div className="font-semibold text-sm text-gray-900">
                {pair.playerB.player?.last_name}, {pair.playerB.player?.first_name}
              </div>
              <div className="text-xs text-gray-400">CH: {pair.playerB.course_handicap}</div>
              <div className="text-2xl font-black text-purple-700 mt-1">{pair.pointsB}</div>
            </div>
          </div>

          {/* Hole dots */}
          {pair.holesPlayed > 0 && (
            <div className="px-4 pb-3 overflow-x-auto"><div className="flex gap-1 min-w-0">
              {pair.holes.map(h => {
                if (h.status === 'pending') return (
                  <div key={h.hole} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                    {h.hole}
                  </div>
                )
                const bg = h.result === 'A' ? 'bg-blue-500' : h.result === 'B' ? 'bg-purple-500' : 'bg-gray-300'
                return (
                  <div key={h.hole} title={`Hole ${h.hole}: A net ${h.netA}, B net ${h.netB}`}
                    className={`w-6 h-6 rounded-full ${bg} flex items-center justify-center text-xs text-white font-bold`}
                  >
                    {h.hole}
                  </div>
                )
              })}
            </div></div>
          )}
        </div>
      ))}

      {/* Individual rankings */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-sm text-gray-800">Individual Points</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {ranked.overall.map((p, i) => (
            <div key={p.player_id} className="flex items-center px-4 py-2.5">
              <span className="w-6 text-sm text-gray-400">{i + 1}.</span>
              <div className={`w-5 h-5 rounded-full mr-3 text-xs font-bold flex items-center justify-center ${
                p.flight === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
              }`}>{p.flight}</div>
              <div className="flex-1 text-sm font-medium text-gray-900">
                {p.player?.last_name}, {p.player?.first_name}
              </div>
              <span className="font-bold text-gray-800">{p.points} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Payouts Board ────────────────────────────────────────────────
function PayoutsBoard({ event, eventPlayers, leaderboards, sideGames, skinsResults, playerMap }) {
  if (!event?.payout_config || eventPlayers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-4xl mb-3">💰</div>
        <p>No payout configuration set for this event.</p>
      </div>
    )
  }

  const flightCounts = {
    A: eventPlayers.filter(ep => ep.flight === 'A').length,
    B: eventPlayers.filter(ep => ep.flight === 'B').length,
  }

  const { totalPot, byCategory, byPlayer, totalAllocated } = computePayouts(
    event, eventPlayers.length, leaderboards, sideGames ?? [], skinsResults, flightCounts
  )

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="bg-fairway-700 rounded-xl p-4 text-white flex items-center justify-between">
        <div>
          <div className="text-xs text-fairway-300 font-medium">Total Pot</div>
          <div className="text-3xl font-black">${totalPot.toFixed(2)}</div>
          <div className="text-xs text-fairway-300 mt-0.5">{eventPlayers.length} players × ${event.entry_fee}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-fairway-300 font-medium">Allocated</div>
          <div className="text-2xl font-bold">${totalAllocated.toFixed(2)}</div>
        </div>
      </div>

      {/* By player */}
      {byPlayer.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-sm text-gray-800">Payouts by Player</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {byPlayer.map(({ playerId, total, items }) => {
              const p = playerMap[playerId]
              return (
                <div key={playerId} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">
                      {p ? `${p.last_name}, ${p.first_name}` : '—'}
                    </span>
                    <span className="font-black text-fairway-700 text-lg">${total.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-500">
                        <span>{item.category}</span>
                        <span>${item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* By category */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-sm text-gray-800">By Category</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {byCategory.map(cat => {
            const winners = (cat.playerIds ?? (cat.playerId ? [cat.playerId] : []))
              .map(pid => playerMap[pid])
              .filter(Boolean)
            return (
              <div key={cat.key} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <div className="text-sm text-gray-700">{cat.label}</div>
                  <div className="text-xs text-gray-400">
                    {winners.length > 0
                      ? winners.map(p => `${p.last_name}, ${p.first_name}`).join(' · ')
                      : '— Unresolved'}
                  </div>
                </div>
                <span className="font-bold text-gray-900">${cat.amount.toFixed(2)}</span>
              </div>
            )
          })}
          {byCategory.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-400">No payouts resolved yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}


// ─── Player Scorecard Modal ───────────────────────────────────────
function PlayerScorecardModal({ player, allScores, course, onClose }) {
  const { par_per_hole: pars, stroke_index: sis } = course
  const ch = player.course_handicap ?? 0
  const playerScores = allScores.filter(s => s.player_id === player.player_id)
  const scoreMap = Object.fromEntries(playerScores.map(s => [s.hole_number, s.gross_score]))

  const holes = Array.from({ length: 18 }, (_, i) => {
    const h = i + 1
    const g = scoreMap[h] ?? null
    const si = sis[i]
    const strokes = g != null ? Math.floor(ch / 18) + (si <= (ch % 18) ? 1 : 0) : 0
    const net = g != null ? g - strokes : null
    const netVsPar = net != null ? net - pars[i] : null
    return { h, g, net, netVsPar, par: pars[i] }
  })

  const frontHoles = holes.slice(0, 9)
  const backHoles  = holes.slice(9)

  function cellStyle(netVsPar) {
    if (netVsPar == null)  return 'text-gray-200'
    if (netVsPar <= -2)    return 'bg-yellow-400 text-yellow-900 font-black rounded'
    if (netVsPar === -1)   return 'bg-green-100 text-green-800 font-bold rounded'
    if (netVsPar === 0)    return 'text-gray-700'
    if (netVsPar === 1)    return 'text-red-500'
    return 'text-red-700 font-bold'
  }

  const totalGross = playerScores.reduce((s, r) => s + r.gross_score, 0)
  const totalNet   = holes.reduce((s, h) => h.net != null ? s + h.net : s, 0)
  const totalVsPar = holes.reduce((s, h) => h.netVsPar != null ? s + h.netVsPar : s, 0)
  const name = `${player.player?.first_name ?? ''} ${player.player?.last_name ?? ''}`.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#012d1d] text-white px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <div className="font-bold text-base">{name}</div>
            <div className="text-xs text-white/60 mt-0.5">CH {ch} · {course.name}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Scorecard table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 text-gray-500 font-semibold">Hole</th>
                {frontHoles.map(({ h }) => <th key={h} className="px-2 py-2 text-gray-500 font-semibold w-8">{h}</th>)}
                <th className="px-2 py-2 text-gray-500 font-semibold bg-gray-100">OUT</th>
                {backHoles.map(({ h }) => <th key={h} className="px-2 py-2 text-gray-500 font-semibold w-8">{h}</th>)}
                <th className="px-2 py-2 text-gray-500 font-semibold bg-gray-100">IN</th>
                <th className="px-2 py-2 text-gray-600 font-bold bg-gray-100">TOT</th>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="text-left px-3 py-1.5 text-gray-400 font-medium">Par</td>
                {frontHoles.map(({ h, par }) => <td key={h} className="px-2 py-1.5 text-gray-400">{par}</td>)}
                <td className="px-2 py-1.5 text-gray-500 font-semibold bg-gray-50">{pars.slice(0,9).reduce((a,b)=>a+b,0)}</td>
                {backHoles.map(({ h, par }) => <td key={h} className="px-2 py-1.5 text-gray-400">{par}</td>)}
                <td className="px-2 py-1.5 text-gray-500 font-semibold bg-gray-50">{pars.slice(9).reduce((a,b)=>a+b,0)}</td>
                <td className="px-2 py-1.5 text-gray-600 font-bold bg-gray-50">{pars.reduce((a,b)=>a+b,0)}</td>
              </tr>
            </thead>
            <tbody>
              {/* Gross row */}
              <tr className="border-b border-gray-100">
                <td className="text-left px-3 py-2 text-gray-500 font-medium">Gross</td>
                {frontHoles.map(({ h, g }) => (
                  <td key={h} className="px-1 py-2">
                    {g != null ? <span className="font-semibold text-gray-800">{g}</span> : <span className="text-gray-200">—</span>}
                  </td>
                ))}
                <td className="px-2 py-2 font-bold text-gray-700 bg-gray-50">
                  {frontHoles.reduce((s,h) => h.g != null ? s + h.g : s, 0) || '—'}
                </td>
                {backHoles.map(({ h, g }) => (
                  <td key={h} className="px-1 py-2">
                    {g != null ? <span className="font-semibold text-gray-800">{g}</span> : <span className="text-gray-200">—</span>}
                  </td>
                ))}
                <td className="px-2 py-2 font-bold text-gray-700 bg-gray-50">
                  {backHoles.reduce((s,h) => h.g != null ? s + h.g : s, 0) || '—'}
                </td>
                <td className="px-2 py-2 font-bold text-gray-800 bg-gray-50">{totalGross || '—'}</td>
              </tr>
              {/* Net row */}
              <tr>
                <td className="text-left px-3 py-2 text-gray-500 font-medium">Net</td>
                {frontHoles.map(({ h, net, netVsPar }) => (
                  <td key={h} className="px-1 py-2">
                    <span className={`inline-flex items-center justify-center w-7 h-7 text-xs ${cellStyle(netVsPar)}`}>
                      {net ?? '—'}
                    </span>
                  </td>
                ))}
                <td className="px-2 py-2 font-bold text-gray-700 bg-gray-50">
                  {frontHoles.reduce((s,h) => h.net != null ? s + h.net : s, 0) || '—'}
                </td>
                {backHoles.map(({ h, net, netVsPar }) => (
                  <td key={h} className="px-1 py-2">
                    <span className={`inline-flex items-center justify-center w-7 h-7 text-xs ${cellStyle(netVsPar)}`}>
                      {net ?? '—'}
                    </span>
                  </td>
                ))}
                <td className="px-2 py-2 font-bold text-gray-700 bg-gray-50">
                  {backHoles.reduce((s,h) => h.net != null ? s + h.net : s, 0) || '—'}
                </td>
                <td className="px-2 py-2 font-bold text-gray-800 bg-gray-50">{totalNet || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 rounded-b-2xl">
          <div className="text-sm text-gray-500">Net vs Par</div>
          <div className={`text-2xl font-black tabular-nums ${totalVsPar < 0 ? 'text-[#BA1A1A]' : totalVsPar === 0 ? 'text-gray-700' : 'text-gray-500'}`}>
            {playerScores.length === 0 ? '—' : totalVsPar === 0 ? 'E' : `${totalVsPar > 0 ? '+' : ''}${totalVsPar}`}
          </div>
        </div>
      </div>
    </div>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-24 bg-fairway-700 animate-pulse" />
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {[0,1,2,3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />)}
      </div>
    </div>
  )
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

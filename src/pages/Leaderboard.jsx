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

  const playerMap = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep.player]))

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
          <Link to={homeLink} className="text-fairway-300 hover:text-white text-sm transition-colors">
            ⛳ Home
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

        {/* Tabs */}
        <div className="max-w-2xl mx-auto">
          <div className="flex overflow-x-auto border-t border-fairway-600">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-none px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-white/20 text-white border-b-2 border-white'
                    : 'text-fairway-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Flight toggle */}
      {!['Low Putts', 'Skins', 'Match Points', 'Payouts'].includes(activeTab) && (
        <div className="max-w-2xl mx-auto px-4 pt-4 flex gap-2">
          {['A', 'B'].map(f => (
            <button
              key={f}
              onClick={() => setActiveFlight(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
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
                maxPlaces={3}
              />
            )}
            {activeTab === 'Front 9' && (
              <NetLeaderboard
                complete={leaderboards.front9[activeFlight]}
                inProgress={[]}
                flight={activeFlight}
                maxPlaces={2}
                label="Front 9 Net"
              />
            )}
            {activeTab === 'Back 9' && (
              <NetLeaderboard
                complete={leaderboards.back9[activeFlight]}
                inProgress={[]}
                flight={activeFlight}
                maxPlaces={2}
                label="Back 9 Net"
              />
            )}
            {activeTab === 'Low Putts' && (
              <PuttLeaderboard data={leaderboards.putts} playerMap={playerMap} />
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
function NetLeaderboard({ complete, inProgress, flight, maxPlaces, label }) {
  const medals = ['🥇', '🥈', '🥉']

  if (!complete?.length && !inProgress?.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-4xl mb-3">🏌️</div>
        <p className="font-medium">No scores yet for Flight {flight}</p>
      </div>
    )
  }

  // Include all players whose rank falls within maxPlaces (handles ties at cut line)
  const topFinishers = complete?.filter(p => p.rank <= maxPlaces) ?? []
  const restFinishers = complete?.filter(p => p.rank > maxPlaces) ?? []

  function rankLabel(p) {
    // Check if anyone else shares this rank
    const tied = complete.filter(x => x.rank === p.rank).length > 1
    return tied ? `T${p.rank}` : `${p.rank}`
  }

  function scoreDisplay(p) {
    const vs = p.netVsPar ?? p.f9VsPar ?? p.b9VsPar
    return vs === 0 ? 'E' : `${vs > 0 ? '+' : ''}${vs}`
  }

  function scoreColor(p) {
    const vs = p.netVsPar ?? p.f9VsPar ?? p.b9VsPar
    return vs < 0 ? 'text-red-600' : vs === 0 ? 'text-gray-700' : 'text-blue-600'
  }

  return (
    <div className="space-y-2">
      {/* Top finishers — all players within maxPlaces including ties */}
      {topFinishers.map(p => {
        const rl = rankLabel(p)
        const isTied = rl.startsWith('T')
        const isFirst = p.rank === 1
        return (
          <div key={p.player_id} className={`bg-white rounded-xl border overflow-hidden ${isFirst && !isTied ? 'border-yellow-300 shadow-md shadow-yellow-100' : isTied && p.rank === 1 ? 'border-yellow-300 shadow-md shadow-yellow-100' : 'border-gray-200'}`}>
            <div className="flex items-center px-4 py-3.5">
              <div className="w-10 text-xl">
                {isTied
                  ? <span className="text-sm font-bold text-gray-500">{rl}</span>
                  : (medals[p.rank - 1] ?? `${p.rank}.`)
                }
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">
                  {p.player?.last_name}, {p.player?.first_name}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  CH: {p.course_handicap} · Gross: {p.gross18 ?? p.grossF9 ?? p.grossB9}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-black ${scoreColor(p)}`}>
                  {scoreDisplay(p)}
                </div>
                <div className="text-xs text-gray-400">
                  Net {p.net18 ?? p.netF9 ?? p.netB9}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* In progress */}
      {inProgress?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-2">In Progress</p>
          {inProgress.map(p => (
            <div key={p.player_id} className="bg-white rounded-xl border border-gray-200 flex items-center px-4 py-3 mb-2">
              <div className="flex-1">
                <div className="font-medium text-gray-800 text-sm">
                  {p.player?.last_name}, {p.player?.first_name}
                </div>
                <div className="text-xs text-gray-400">thru {p.holesCompleted}</div>
              </div>
              <div className={`font-bold text-sm ${scoreColor(p)}`}>
                {scoreDisplay(p)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rest of finishers */}
      {restFinishers.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-2">Full Results</p>
          {restFinishers.map(p => (
            <div key={p.player_id} className="bg-white rounded-xl border border-gray-200 flex items-center px-4 py-2.5 mb-2">
              <span className="w-8 text-sm text-gray-400 font-medium">{rankLabel(p)}</span>
              <div className="flex-1 text-sm text-gray-800">
                {p.player?.last_name}, {p.player?.first_name}
              </div>
              <span className={`font-semibold text-sm ${scoreColor(p)}`}>
                {scoreDisplay(p)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Putt Leaderboard ─────────────────────────────────────────────
function PuttLeaderboard({ data, playerMap }) {
  const medals = ['🥇', '🥈', '🥉']
  if (!data?.length) return (
    <div className="text-center py-12 text-gray-400">
      <p>No complete rounds yet.</p>
    </div>
  )
  return (
    <div className="space-y-2">
      {data.map((p, i) => (
        <div key={p.player_id} className={`bg-white rounded-xl border flex items-center px-4 py-3.5 ${i === 0 ? 'border-yellow-300 shadow-md shadow-yellow-100' : 'border-gray-200'}`}>
          <span className="w-10 text-xl">{medals[i] ?? `${i+1}.`}</span>
          <div className="flex-1 font-medium text-gray-900">
            {p.player?.last_name}, {p.player?.first_name}
          </div>
          <span className="text-2xl font-black text-fairway-700">{p.totalPutts}</span>
        </div>
      ))}
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
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
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
  const medals = ['🥇', '🥈', '🥉']
  const list   = data[activeFlight] ?? []

  if (!list.length) return (
    <div className="text-center py-12 text-gray-400">
      <div className="text-4xl mb-3">🎯</div>
      <p className="font-medium">No scores yet for Flight {activeFlight}</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {list.map((p, i) => (
        <div
          key={p.player_id}
          className={`bg-white rounded-xl border overflow-hidden ${i === 0 ? 'border-yellow-300 shadow-md shadow-yellow-100' : 'border-gray-200'}`}
        >
          <div className="flex items-center px-4 py-3.5">
            <div className="w-10 text-xl">{medals[i] ?? `${i + 1}.`}</div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">
                {p.player?.last_name}, {p.player?.first_name}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                CH: {p.course_handicap} · {p.holesPlayed} hole{p.holesPlayed !== 1 ? 's' : ''} played
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-fairway-700">{p.totalPoints}</div>
              <div className="text-xs text-gray-400">pts</div>
            </div>
          </div>
        </div>
      ))}
      <p className="text-xs text-center text-gray-400 pt-2">
        Eagle=4 · Birdie=3 · Par=2 · Bogey=1 · DBL+=0 (net)
      </p>
    </div>
  )
}

// ─── Match Points Board ───────────────────────────────────────────
function MatchPointsBoard({ matchData }) {
  const { pairings, teamPoints, ranked } = matchData

  if (!pairings.length) return (
    <div className="text-center py-12 text-gray-400">
      <div className="text-4xl mb-3">⚔️</div>
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
            <div className="px-4 pb-3 flex gap-1 flex-wrap">
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
            </div>
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
            <h3 className="font-semibold text-sm text-gray-800">💵 Payouts by Player</h3>
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

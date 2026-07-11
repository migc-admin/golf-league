/**
 * Live Leaderboard
 * Auto-updates via Supabase Realtime on scores changes.
 * Tabs: 18-Hole | Front 9 | Back 9 | Low Putts | Skins
 */

import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { computeLeaderboards, computeStableford } from '../lib/engines/scoring'
import { computeAllSkins } from '../lib/engines/skins'
import { computeMatchPoints } from '../lib/engines/matchPoints'
import { computePayouts, CATEGORY_LABELS, ctpLabel } from '../lib/engines/payouts'
import { computeTGLEventResults } from '../lib/engines/tgl'
import { FlightBadge, StatusBadge } from '../components/ui/Badge'
import { useFeatures } from '../lib/OrgContext'

const ALL_TABS = ['18-Hole', 'Front 9', 'Back 9', 'Stableford', 'Match Points', 'Low Putts', 'Skins', 'Payouts', 'TGL']

function visibleTabs(event, hasTGL = false) {
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
    if (tab === 'TGL')           return hasTGL
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
  const { orgSlug, leagueSlug, eventSlug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const directEventId = searchParams.get('eid')
  const { user, isAdmin } = useAuth()
  const hasFeature = useFeatures()
  const homeLink = isAdmin ? '/admin' : user ? '/home' : null
  const fromScorecard = location.state?.from === 'scorecard'
  const scorecardEventId = location.state?.scorecardEventId ?? null
  const [event,        setEvent]        = useState(null)
  const [eventPlayers, setEventPlayers] = useState([])
  const [allScores,    setAllScores]    = useState([])
  const [sideGames,    setSideGames]    = useState([])
  const [course,       setCourse]       = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [activeTab,     setActiveTab]     = useState('18-Hole')
  const [activeFlight,  setActiveFlight]  = useState('A')
  const [matchPairings, setMatchPairings] = useState([])
  const [tglTeams,      setTglTeams]      = useState([])
  const [tglMembers,    setTglMembers]    = useState([])
  const [tglSelections, setTglSelections] = useState([])
  const [tglLocked,     setTglLocked]     = useState(false)

  const subRef = useRef(null)
  const tabs   = event ? visibleTabs(event, hasFeature('tgl') && tglTeams.length > 0 && tglSelections.length > 0) : ALL_TABS

  async function loadScores(evId) {
    const { data } = await supabase.from('scores').select('*').eq('event_id', evId)
    setAllScores(data ?? [])
  }

  useEffect(() => {
    async function init() {
      let ev = null

      if (directEventId) {
        const { data } = await supabase
          .from('events')
          .select('*, course:courses(*), league:leagues(name, slug)')
          .eq('id', directEventId)
          .single()
        ev = data
      } else {
        const { data: league } = await supabase.from('leagues').select('id, name, slug').eq('slug', leagueSlug).single()
        if (!league) { setLoading(false); return }
        const { data } = await supabase
          .from('events')
          .select('*, course:courses(*), league:leagues(name, slug)')
          .eq('league_id', league.id)
          .eq('slug', eventSlug)
          .single()
        ev = data
      }

      if (!ev) { setLoading(false); return }

      const eventId = ev.id

      const [{ data: eps }, { data: sg }, { data: mp }] = await Promise.all([
        supabase.from('event_players').select('*, player:players(*)').eq('event_id', eventId),
        supabase.from('side_games').select('*, winner:players(first_name,last_name)').eq('event_id', eventId),
        supabase.from('match_pairings').select('*').eq('event_id', eventId).order('match_number'),
      ])

      setEvent(ev)
      setCourse(ev.course)
      setEventPlayers(eps ?? [])
      setSideGames(sg ?? [])
      setMatchPairings(mp ?? [])
      await loadScores(eventId)
      setLoading(false)

      // Load TGL data non-blocking
      const leagueId = ev.league_id
      const { data: tglT } = await supabase.from('tgl_teams').select('*').eq('league_id', leagueId).order('name')
      if (tglT?.length) {
        const [{ data: tglM }, { data: tglS }, { data: tglLock }] = await Promise.all([
          supabase.from('tgl_team_members').select('*, player:players(first_name,last_name)').in('team_id', tglT.map(t => t.id)),
          supabase.from('tgl_event_selections').select('*, player:players(first_name,last_name)').eq('event_id', eventId),
          supabase.from('tgl_event_locks').select('id').eq('event_id', eventId).maybeSingle(),
        ])
        setTglTeams(tglT)
        setTglMembers(tglM ?? [])
        setTglSelections(tglS ?? [])
        setTglLocked(!!tglLock)
      }

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
  }, [leagueSlug, eventSlug])

  if (loading) return <LeaderboardSkeleton />
  if (!event)  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#fbfaf8' }}>
      <p className="text-ink-muted">Event not found.</p>
    </div>
  )

  const leaderboards    = course ? computeLeaderboards(eventPlayers, allScores, course)              : null
  const skinsResults    = course ? computeAllSkins(eventPlayers, allScores, course.stroke_index)     : null
  const stablefordData  = course ? computeStableford(eventPlayers, allScores, course)                : null
  const matchData       = course ? computeMatchPoints(eventPlayers, allScores, course, matchPairings) : null

  const tglData = (() => {
    if (!leaderboards || !tglTeams.length || !tglSelections.length) return null
    try {
      const ranked = leaderboards.net?.ranked ?? leaderboards.gross?.ranked ?? []
      if (!ranked.length) return null
      const epMap = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep]))
      const rankedWithPlayer = ranked.map(r => ({ ...r, player: epMap[r.player_id]?.player ?? null }))
      return computeTGLEventResults(rankedWithPlayer, tglSelections, tglTeams, tglMembers)
    } catch { return null }
  })()

  const playerMap  = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep.player]))
  const hasFlights = eventPlayers.some(ep => !ep.is_guest && (ep.flight === 'A' || ep.flight === 'B'))

  const pageTitle = event
    ? `${event.league?.name ?? ''} — ${event.name ?? `Event #${event.event_number}`} Leaderboard | Scorify Golf`
    : 'Live Leaderboard | Scorify Golf'

  return (
    <>
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={event ? `Live leaderboard for ${event.name ?? `Event #${event.event_number}`} — ${event.league?.name ?? ''} at ${event.course?.name ?? ''}. Powered by Scorify Golf.` : 'Live golf event leaderboard powered by Scorify Golf.'} />
      <meta property="og:title" content={pageTitle} />
      <meta name="robots" content="noindex" />
    </Helmet>
    <div className="min-h-screen" style={{ background: '#fbfaf8' }}>
      {/* Back nav */}
      <div className="px-4 py-2 flex items-center justify-between" style={{ background: '#fbfaf8' }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-ink-muted hover:text-ink text-sm transition-colors font-medium"
        >
          ← {fromScorecard ? 'Back to Scoring' : 'Back'}
        </button>
        {homeLink && (
          <Link to={homeLink} className="text-ink-muted hover:text-ink text-sm transition-colors flex items-center gap-1 font-medium">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            Home
          </Link>
        )}
      </div>

      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: '#ffffff', borderBottom: '1px solid #ebe9e4' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-bold text-base text-ink">{event.course?.name}</div>
            <div className="text-xs text-ink-muted mt-0.5">
              {event.league?.name} · Event #{event.event_number} · {formatDate(event.event_date)}
            </div>
            {event.format && event.format !== 'net_stroke' && (
              <div className="text-xs text-ink-muted mt-0.5">{FORMAT_LABELS[event.format] ?? event.format}</div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={event.status} />
            <Link to={`/${orgSlug}/${event.league?.slug}/${event.slug}/schedule`} className="text-xs text-ink-muted hover:text-ink">
              Pairings ↗
            </Link>
          </div>
        </div>

        {/* Tabs — pill style */}
        <div className="max-w-2xl mx-auto" style={{ borderTop: '1px solid #ebe9e4' }}>
          <div className="flex overflow-x-auto px-3 py-2 gap-1">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-label={`View ${tab} leaderboard`}
                aria-pressed={activeTab === tab}
                className={`flex-none px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer rounded-full ${
                  activeTab === tab
                    ? 'bg-status-active-bg text-status-active-text'
                    : 'text-ink-muted hover:text-ink hover:bg-surface-high'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {event.course?.photo_url && (
        <div className="w-full h-40 overflow-hidden">
          <img src={event.course.photo_url} alt={event.course.name} className="w-full h-full object-cover opacity-80" />
        </div>
      )}

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
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-purple-50 text-purple-700'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-high'
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
        {activeTab === 'TGL' && (
          <TGLBoard tglData={tglData} locked={tglLocked} />
        )}
      </div>
    </div>
    </>
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
    return vs < 0 ? 'text-status-active-text font-bold' : vs === 0 ? 'text-ink' : 'text-ink-muted'
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
    <div className="card overflow-hidden p-0">
      {/* Table header */}
      <div className="grid grid-cols-[2.5rem_1fr_3.5rem_3rem] text-[10px] font-bold uppercase tracking-widest px-4 py-2.5" style={{ background: '#f4f3f0', color: '#86868b' }}>
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
            className="grid grid-cols-[2.5rem_1fr_3.5rem_3rem] items-center px-4 py-3 cursor-pointer transition-colors"
            style={{
              background: i % 2 === 1 ? 'rgba(27,67,50,0.025)' : '#ffffff',
              borderBottom: '1px solid #ebe9e4',
              borderLeft: isFirst ? '3px solid #1B4332' : undefined,
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f4f3f0'}
            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 1 ? 'rgba(27,67,50,0.025)' : '#ffffff'}
          >
            <span className="text-sm font-semibold text-ink-muted tabular-nums">{p.mergedRankLabel}</span>
            <div>
              <div className="font-semibold text-sm text-ink leading-tight">
                {p.player?.last_name}, {p.player?.first_name}
              </div>
              <div className="text-[10px] text-ink-muted mt-0.5">
                CH {p[handicapKey] ?? p.course_handicap} · Gross {p[grossKey] ?? '—'}
              </div>
            </div>
            <span className={`text-sm tabular-nums text-right ${scoreColor(p)}`}>
              {scoreDisplay(p)}
            </span>
            <span className="text-xs text-ink-muted text-right tabular-nums">
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
    <div className="card overflow-hidden p-0">
      <div className="grid grid-cols-[2.5rem_1fr_3.5rem] text-[10px] font-bold uppercase tracking-widest px-4 py-2.5" style={{ background: '#f4f3f0', color: '#86868b' }}>
        <span>Pos</span>
        <span>Player</span>
        <span className="text-right">Putts</span>
      </div>
      {ranked.map((p, i) => (
        <div key={p.player_id}
          onClick={() => course && setScorecardPlayer(p)}
          className="grid grid-cols-[2.5rem_1fr_3.5rem] items-center px-4 py-3 cursor-pointer transition-colors"
          style={{
            background: i % 2 === 1 ? 'rgba(27,67,50,0.025)' : '#ffffff',
            borderBottom: '1px solid #ebe9e4',
            borderLeft: p.rank === 1 ? '3px solid #1B4332' : undefined,
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f4f3f0'}
          onMouseLeave={e => e.currentTarget.style.background = i % 2 === 1 ? 'rgba(27,67,50,0.025)' : '#ffffff'}
        >
          <span className="text-sm font-semibold text-ink-muted tabular-nums">{p.rankLabel}</span>
          <div className="font-medium text-sm text-ink">
            {p.player?.last_name}, {p.player?.first_name}
          </div>
          <span className="text-sm font-black tabular-nums text-status-active-text text-right">{p.totalPutts}</span>
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
        <div className="card overflow-hidden p-0">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #ebe9e4', background: '#f4f3f0' }}>
            <h3 className="font-semibold text-sm text-ink">Skins Won — Flight {flight}</h3>
          </div>
          <div>
            {Object.entries(result.playerSkins)
              .filter(([, c]) => c > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([pid, count]) => {
                const p = playerMap[pid]
                return (
                  <div key={pid} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #ebe9e4' }}>
                    <span className="font-medium text-sm text-ink">
                      {p ? `${p.last_name}, ${p.first_name}` : pid}
                    </span>
                    <span className="font-black text-status-active-text text-lg">{count} skin{count !== 1 ? 's' : ''}</span>
                  </div>
                )
              })
            }
          </div>
        </div>
      )}

      {/* Hole-by-hole */}
      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #ebe9e4', background: '#f4f3f0' }}>
          <h3 className="font-semibold text-sm text-ink">Hole-by-Hole Skins</h3>
        </div>
        <div>
          {result.holes.map(h => {
            if (h.incomplete) return null
            const winner = h.winner ? playerMap[h.winner] : null
            return (
              <div key={h.hole} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid #ebe9e4' }}>
                <span className="w-8 text-sm font-semibold text-ink-muted">#{h.hole}</span>
                {h.tied && !h.winner && (
                  <span className="text-xs text-orange-600 font-medium">
                    Tied — {h.carryoverIn + 1} skin{h.carryoverIn + 1 !== 1 ? 's' : ''} carried
                  </span>
                )}
                {h.winner && (
                  <>
                    <span className="text-xs text-status-active-text font-semibold">
                      {winner ? `${winner.last_name}, ${winner.first_name}` : h.winner}
                    </span>
                    <span className="ml-auto text-xs font-bold text-ink-muted">
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
      <div className="card overflow-hidden p-0">
        <div className="grid grid-cols-[2.5rem_1fr_3.5rem] text-[10px] font-bold uppercase tracking-widest px-4 py-2.5" style={{ background: '#f4f3f0', color: '#86868b' }}>
          <span>Pos</span>
          <span>Player</span>
          <span className="text-right">Pts</span>
        </div>
        {list.map((p, i) => (
          <div key={p.player_id}
            className="grid grid-cols-[2.5rem_1fr_3.5rem] items-center px-4 py-3"
            style={{
              background: i % 2 === 1 ? 'rgba(27,67,50,0.025)' : '#ffffff',
              borderBottom: '1px solid #ebe9e4',
              borderLeft: i === 0 ? '3px solid #1B4332' : undefined,
            }}
          >
            <span className="text-sm font-semibold text-ink-muted tabular-nums">{i + 1}</span>
            <div>
              <div className="font-semibold text-sm text-ink leading-tight">
                {p.player?.last_name}, {p.player?.first_name}
              </div>
              <div className="text-[10px] text-ink-muted mt-0.5">
                CH {p.course_handicap} · {p.holesPlayed} holes
              </div>
            </div>
            <span className="text-sm font-black tabular-nums text-status-active-text text-right">{p.totalPoints}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-ink-muted">Eagle=4 · Birdie=3 · Par=2 · Bogey=1 · DBL+=0 (net)</p>
    </div>
  )
}

// ─── Match Points Board ───────────────────────────────────────────
function MatchPointsBoard({ matchData }) {
  const { pairings, teamPoints, ranked } = matchData

  if (!pairings.length) return (
    <div className="text-center py-12 text-gray-400">
      <svg className="mx-auto mb-3 w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>
      <p className="font-medium">No match play pairings set up yet.</p>
      <p className="text-sm mt-1">An admin can assign pairings in the event settings.</p>
    </div>
  )

  const totalHolesA = teamPoints.A + teamPoints.B > 0
  const teamLeader = teamPoints.A > teamPoints.B ? 'Flight A' : teamPoints.B > teamPoints.A ? 'Flight B' : 'All Square'

  return (
    <div className="space-y-4">
      {/* Team banner — wins/halves/losses tally */}
      {teamPoints.A + teamPoints.B > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Team Score</h3>
          </div>
          <div className="flex">
            <div className="flex-1 text-center py-4 bg-blue-50">
              <div className="text-xs font-bold text-blue-600 mb-1">Flight A</div>
              <div className="text-4xl font-black text-blue-700">{teamPoints.A}</div>
              <div className="text-xs text-blue-400 mt-0.5">matches won</div>
            </div>
            <div className="w-px bg-gray-200" />
            <div className="flex-1 text-center py-4 bg-purple-50">
              <div className="text-xs font-bold text-purple-600 mb-1">Flight B</div>
              <div className="text-4xl font-black text-purple-700">{teamPoints.B}</div>
              <div className="text-xs text-purple-400 mt-0.5">matches won</div>
            </div>
          </div>
          <div className="text-center py-2 border-t border-gray-100">
            <span className="text-xs font-semibold text-gray-600">{teamLeader}</span>
          </div>
        </div>
      )}

      {/* Individual match cards */}
      {pairings.map((pair, idx) => {
        const leaderSide = pair.upBy > 0 ? 'A' : pair.upBy < 0 ? 'B' : null
        const isFinished = pair.winner != null
        const statusColor = isFinished
          ? (pair.winner === 'A' ? 'bg-blue-600 text-white' : pair.winner === 'B' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700')
          : (leaderSide === 'A' ? 'bg-blue-100 text-blue-700' : leaderSide === 'B' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600')

        return (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Match header */}
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600">Match {idx + 1}</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusColor}`}>
                {pair.holesPlayed === 0 ? 'Not started' : pair.matchStatus}
              </span>
            </div>

            {/* Players vs layout */}
            <div className="flex items-stretch divide-x divide-gray-100">
              {/* Player A */}
              <div className={`flex-1 px-4 py-3 ${leaderSide === 'A' || pair.winner === 'A' ? 'bg-blue-50/60' : ''}`}>
                <div className="text-xs font-bold text-blue-600 mb-0.5">
                  {pair.playerA.flight ? `Flight ${pair.playerA.flight}` : 'Player A'}
                </div>
                <div className="font-semibold text-sm text-gray-900 leading-tight">
                  {pair.playerA.player?.last_name}, {pair.playerA.player?.first_name}
                </div>
                <div className="text-xs text-gray-400">CH {pair.playerA.course_handicap ?? '—'}</div>
                {pair.holesPlayed > 0 && (
                  <div className={`text-lg font-black mt-1 ${pair.winner === 'A' ? 'text-blue-700' : pair.winner === 'B' ? 'text-gray-300' : leaderSide === 'A' ? 'text-blue-600' : 'text-gray-500'}`}>
                    {pair.winner === 'A' ? `W ${pair.matchStatus}` : pair.winner === 'B' ? 'Lost' : pair.winner === 'halve' ? '½' : leaderSide === 'A' ? `↑ ${pair.matchStatus}` : leaderSide === 'B' ? 'AS' : 'AS'}
                  </div>
                )}
              </div>

              {/* VS divider */}
              <div className="flex items-center justify-center w-8 bg-gray-50 text-xs text-gray-400 font-bold">vs</div>

              {/* Player B */}
              <div className={`flex-1 px-4 py-3 ${leaderSide === 'B' || pair.winner === 'B' ? 'bg-purple-50/60' : ''}`}>
                <div className="text-xs font-bold text-purple-600 mb-0.5">
                  {pair.playerB.flight ? `Flight ${pair.playerB.flight}` : 'Player B'}
                </div>
                <div className="font-semibold text-sm text-gray-900 leading-tight">
                  {pair.playerB.player?.last_name}, {pair.playerB.player?.first_name}
                </div>
                <div className="text-xs text-gray-400">CH {pair.playerB.course_handicap ?? '—'}</div>
                {pair.holesPlayed > 0 && (
                  <div className={`text-lg font-black mt-1 ${pair.winner === 'B' ? 'text-purple-700' : pair.winner === 'A' ? 'text-gray-300' : leaderSide === 'B' ? 'text-purple-600' : 'text-gray-500'}`}>
                    {pair.winner === 'B' ? `W ${pair.matchStatus}` : pair.winner === 'A' ? 'Lost' : pair.winner === 'halve' ? '½' : leaderSide === 'B' ? `↑ ${pair.matchStatus}` : leaderSide === 'A' ? 'AS' : 'AS'}
                  </div>
                )}
              </div>
            </div>

            {/* Hole-by-hole dots — colored by who won the hole, tooltip shows running state */}
            {pair.holesPlayed > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 overflow-x-auto">
                <div className="flex gap-1 min-w-0">
                  {pair.holes.map(h => {
                    if (h.status === 'pending' || h.status === 'conceded') return (
                      <div key={h.hole} className={`w-7 h-7 rounded-full flex flex-col items-center justify-center text-xs ${h.status === 'conceded' ? 'bg-gray-50 text-gray-200' : 'bg-gray-100 text-gray-400'}`}>
                        {h.hole}
                      </div>
                    )
                    const bg = h.result === 'A' ? 'bg-blue-500' : h.result === 'B' ? 'bg-purple-500' : 'bg-gray-200'
                    const textCol = h.result === 'halve' ? 'text-gray-500' : 'text-white'
                    const stateLabel = h.upByAfter === 0 ? 'AS' : `${Math.abs(h.upByAfter)} UP`
                    return (
                      <div key={h.hole} title={`Hole ${h.hole} — A net ${h.netA}, B net ${h.netB} — ${stateLabel}`}
                        className={`w-7 h-7 rounded-full ${bg} ${textCol} flex items-center justify-center text-xs font-bold`}
                      >
                        {h.hole}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-1.5 flex gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"/> A wins hole</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"/> B wins hole</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block"/> Halved</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
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

  const payingPlayers = eventPlayers.filter(ep => !ep.is_guest)

  const flightCounts = {
    A: payingPlayers.filter(ep => ep.flight === 'A').length,
    B: payingPlayers.filter(ep => ep.flight === 'B').length,
  }

  const { totalPot, byCategory, byPlayer, totalAllocated } = computePayouts(
    event, payingPlayers.length, leaderboards, sideGames ?? [], skinsResults, flightCounts
  )

  // Sort categories in the desired display order
  const categorySortKey = (key) => {
    if (key.startsWith('18_net_a_')) return 0
    if (key.startsWith('f9_a_'))    return 10
    if (key.startsWith('b9_a_'))    return 20
    if (key.startsWith('18_net_b_')) return 30
    if (key.startsWith('f9_b_'))    return 40
    if (key.startsWith('b9_b_'))    return 50
    // No-flight overall/9s
    if (key.startsWith('18_net_'))  return 0
    if (key.startsWith('f9_'))      return 10
    if (key.startsWith('b9_'))      return 20
    if (key === 'long_drive_a')     return 60
    if (key === 'long_drive_b')     return 70
    if (key === 'long_drive')       return 60
    if (key === 'low_putts')        return 80
    if (key.startsWith('ctp_'))     return 90 + (parseInt(key.replace('ctp_', ''), 10) || 0)
    if (key.startsWith('skins_a'))  return 100
    if (key.startsWith('skins_b'))  return 110
    if (key === 'skins')            return 100
    return 200
  }
  const sortedCategories = [...byCategory].sort((a, b) => categorySortKey(a.key) - categorySortKey(b.key))

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="card p-4 flex items-center justify-between" style={{ background: '#1d1d1f', border: 'none', color: '#ffffff' }}>
        <div>
          <div className="text-xs font-medium" style={{ color: '#86868b' }}>Total Pot</div>
          <div className="text-3xl font-black">${totalPot.toFixed(2)}</div>
          <div className="text-xs mt-0.5" style={{ color: '#86868b' }}>{eventPlayers.length} players × ${event.entry_fee}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium" style={{ color: '#86868b' }}>Allocated</div>
          <div className="text-2xl font-bold">${totalAllocated.toFixed(2)}</div>
        </div>
      </div>

      {/* By category (games played) */}
      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #ebe9e4', background: '#f4f3f0' }}>
          <h3 className="font-semibold text-sm text-ink">Games Played</h3>
        </div>
        <div>
          {sortedCategories.map(cat => {
            const winners = (cat.playerIds ?? (cat.playerId ? [cat.playerId] : []))
              .map(pid => playerMap[pid])
              .filter(Boolean)
            return (
              <div key={cat.key} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid #ebe9e4' }}>
                <div>
                  <div className="text-sm text-ink">{cat.label}</div>
                  <div className="text-xs text-ink-muted">
                    {winners.length > 0
                      ? winners.map(p => `${p.last_name}, ${p.first_name}`).join(' · ')
                      : '— Unresolved'}
                  </div>
                </div>
                <span className="font-bold text-ink">${cat.amount.toFixed(2)}</span>
              </div>
            )
          })}
          {sortedCategories.length === 0 && (
            <p className="px-4 py-4 text-sm text-ink-muted">No payouts resolved yet.</p>
          )}
        </div>
      </div>

      {/* By player */}
      {byPlayer.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #ebe9e4', background: '#f4f3f0' }}>
            <h3 className="font-semibold text-sm text-ink">Payouts by Player</h3>
          </div>
          <div>
            {byPlayer.map(({ playerId, total, items }) => {
              const p = playerMap[playerId]
              return (
                <div key={playerId} className="px-4 py-3" style={{ borderBottom: '1px solid #ebe9e4' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">
                      {p ? `${p.last_name}, ${p.first_name}` : '—'}
                    </span>
                    <span className="font-black text-status-active-text text-lg">${total.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-ink-muted">
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
    const strokes = Math.floor(ch / 18) + (si <= (ch % 18) ? 1 : 0)
    const net = g != null ? g - strokes : null
    const netVsPar = net != null ? net - pars[i] : null
    return { h, g, net, netVsPar, par: pars[i], strokes }
  })

  function netColor(netVsPar) {
    if (netVsPar == null) return 'text-ink-muted'
    if (netVsPar < 0)    return 'text-status-active-text font-bold'
    if (netVsPar === 0)  return 'text-ink'
    return 'text-ink-muted'
  }

  const frontHoles = holes.slice(0, 9)
  const backHoles  = holes.slice(9)
  const frontGross = frontHoles.reduce((s, h) => h.g != null ? s + h.g : s, 0)
  const backGross  = backHoles.reduce((s, h) => h.g != null ? s + h.g : s, 0)
  const frontNet   = frontHoles.reduce((s, h) => h.net != null ? s + h.net : s, 0)
  const backNet    = backHoles.reduce((s, h) => h.net != null ? s + h.net : s, 0)
  const totalVsPar = holes.reduce((s, h) => h.netVsPar != null ? s + h.netVsPar : s, 0)
  const holesPlayed = playerScores.length
  const name = `${player.player?.first_name ?? ''} ${player.player?.last_name ?? ''}`.trim()
  const vsParDisplay = holesPlayed === 0 ? '—' : totalVsPar === 0 ? 'E' : `${totalVsPar > 0 ? '+' : ''}${totalVsPar}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '92dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0" style={{ background: '#1d1d1f', color: '#ffffff' }}>
          <div>
            <div className="font-bold text-base leading-tight">{name}</div>
            <div className="text-xs mt-0.5" style={{ color: '#86868b' }}>CH {ch} · {course.name}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`text-2xl font-black tabular-nums ${totalVsPar < 0 ? 'text-status-active-text' : 'text-white'}`}>
              {vsParDisplay}
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full transition-colors" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Two-column 9-hole grids side by side */}
        <div className="flex divide-x divide-gray-100 flex-shrink-0">
          {[{ label: 'Front 9', holeList: frontHoles, grossTotal: frontGross, netTotal: frontNet },
            { label: 'Back 9',  holeList: backHoles,  grossTotal: backGross,  netTotal: backNet }
          ].map(({ label, holeList, grossTotal, netTotal }) => (
            <div key={label} className="flex-1">
              {/* Section label */}
              <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
              </div>
              {/* Column headers */}
              <div className="grid grid-cols-[1.5rem_1.5rem_2rem_2rem] gap-0 px-3 py-1.5 border-b border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Hole</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase text-center">Par</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase text-center">Grs</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase text-center">Net</span>
              </div>
              {/* Hole rows */}
              {holeList.map(({ h, g, net, netVsPar, par, strokes }, i) => (
                <div key={h} className={`grid grid-cols-[1.5rem_1.5rem_2rem_2rem] gap-0 px-3 py-1.5 ${i % 2 === 1 ? 'bg-[rgba(27,67,50,0.025)]' : ''}`}>
                  <span className="text-xs font-semibold text-gray-400 tabular-nums">{h}</span>
                  <span className="text-xs text-gray-400 text-center tabular-nums">{par}</span>
                  <span className="text-xs font-semibold text-gray-700 text-center tabular-nums">
                    {g ?? <span className="text-gray-200">—</span>}
                  </span>
                  <span className={`text-xs text-center tabular-nums ${netColor(netVsPar)}`}>
                    {net != null ? net : <span className="text-gray-200">—</span>}
                  </span>
                </div>
              ))}
              {/* Subtotal */}
              <div className="grid grid-cols-[1.5rem_1.5rem_2rem_2rem] gap-0 px-3 py-2 bg-[#012d1d]/5 border-t border-gray-200 mt-0.5">
                <span className="text-[10px] font-bold text-gray-500 uppercase col-span-2">Tot</span>
                <span className="text-xs font-black text-gray-800 text-center tabular-nums">{grossTotal || '—'}</span>
                <span className="text-xs font-black text-gray-800 text-center tabular-nums">{netTotal || '—'}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Overall totals footer */}
        <div className="flex items-center justify-between px-5 py-3 rounded-b-2xl flex-shrink-0" style={{ borderTop: '1px solid #ebe9e4', background: '#f4f3f0' }}>
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <div className="text-[10px] text-ink-muted uppercase tracking-wide font-bold">Gross</div>
              <div className="text-lg font-black text-ink tabular-nums">{frontGross + backGross || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-ink-muted uppercase tracking-wide font-bold">Net</div>
              <div className="text-lg font-black text-ink tabular-nums">{frontNet + backNet || '—'}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-ink-muted uppercase tracking-wide font-bold mb-0.5">Net vs Par</div>
            <div className={`text-3xl font-black tabular-nums ${totalVsPar < 0 ? 'text-status-active-text' : 'text-ink'}`}>
              {vsParDisplay}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TGL Board ────────────────────────────────────────────────────────────────
function TGLBoard({ tglData, locked }) {
  if (!tglData) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="font-medium">No TGL data yet</p>
        <p className="text-sm mt-1">Assign team selections in the admin TGL tab, then scores will appear here.</p>
      </div>
    )
  }

  const { teamResults, playerPoints } = tglData

  return (
    <div className="space-y-4">
      {!locked && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700 font-medium">
          ⚠ Selections not yet submitted — results may change until admin locks this event.
        </div>
      )}
      {/* Team scores */}
      <div className="space-y-2">
        {teamResults.map((tr, i) => (
          <div
            key={tr.team.id}
            className="rounded-xl overflow-hidden border border-gray-200"
            style={{ borderLeftWidth: 4, borderLeftColor: tr.team.color }}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-white">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-gray-400 w-6">#{tr.rank}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tr.team.color }} />
                    <span className="font-bold text-gray-900">{tr.team.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 pl-4">
                    {tr.selectedPlayers.length === 0
                      ? 'No players selected'
                      : tr.selectedPlayers.map(p => `${p.name} (#${p.rank ?? '?'})`).join(' · ')}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-status-active-text">
                  {tr.teamPoints % 1 === 0 ? tr.teamPoints : tr.teamPoints.toFixed(1)}
                </div>
                <div className="text-xs text-ink-muted">pts</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center pt-1">
        Points: field size − finishing position + 1 · ties split equally
      </p>
    </div>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: '#fbfaf8' }}>
      <div className="h-24 animate-pulse" style={{ background: '#eceae5' }} />
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {[0,1,2,3].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#eceae5' }} />)}
      </div>
    </div>
  )
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

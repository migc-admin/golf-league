import { useEffect, useState, useCallback, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { computePayouts, DEFAULT_PAYOUT_CONFIG, getCategoryLabel, ctpLabel, activePayoutKeys, defaultForKey } from '../../lib/engines/payouts'
import { computeLeaderboards, getStrokeIndexForTee } from '../../lib/engines/scoring'
import { computeAllSkins } from '../../lib/engines/skins'
import { computeTGLEventResults, assignTGLPoints } from '../../lib/engines/tgl'
import Card, { CardHeader } from '../../components/ui/Card'
import { ExportScorecardsButton, ExportSkinsGridButton, ExportResultsButton, ExportTeamPlayButton } from '../../components/ScorecardExport'
import { useOrg, useFeatures } from '../../lib/OrgContext'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import Badge, { FlightBadge, StatusBadge } from '../../components/ui/Badge'
import ImageUpload from '../../components/ui/ImageUpload'
import UpgradePrompt from '../../components/ui/UpgradePrompt'
import PrintAssets from '../../components/ui/PrintAssets'
import { atLimit, getLimit, nextTier, TIER_LABELS } from '../../lib/features'

// Collapsed from 7 → 4 tabs: Players = Registrations + Players & Flights; Payout = Config + Side Games + Summary
const ALL_ADMIN_TABS = ['Overview', 'Players', 'Groups', 'Side Games', 'Payout', 'Pre/Post Round', 'Team Play']

// ─── Side game helpers (shared between EditEventModal and elsewhere) ──────────
const PER_FLIGHT_GAMES = [
  { key: 'skins',       label: 'Skins' },
  { key: 'super_skins', label: 'Super Skins' },
  { key: 'long_drive',  label: 'Long Drive' },
  { key: 'low_putts',   label: 'Low Putts' },
  { key: 'ctp',         label: 'Closest to Pin (par 3s)' },
  { key: 'super_ctp',   label: 'Super CTP (par 3s)' },
]
const GROUP_GAMES = [
  { key: 'blind_partners', label: 'Blind Partners' },
]
const PER_FLIGHT_GAME_KEYS = new Set(PER_FLIGHT_GAMES.map(g => g.key))

function buildSideGameOptions(enabledGames, gameScope, numFlights) {
  const result = []
  const letters = Array.from({ length: numFlights }, (_, i) => String.fromCharCode(65 + i))
  for (const g of PER_FLIGHT_GAMES) {
    if (!enabledGames.has(g.key)) continue
    if (numFlights > 0 && (gameScope[g.key] ?? 'flight') === 'flight') {
      letters.forEach(l => result.push(`${g.key}_${l.toLowerCase()}`))
    } else {
      result.push(g.key)
    }
  }
  for (const g of GROUP_GAMES) {
    if (enabledGames.has(g.key)) result.push(g.key)
  }
  return result
}
function parseSideGameOptions(options) {
  const games = new Set()
  const scope = {}
  for (const opt of options ?? []) {
    // Match pattern: base_key_letter (e.g. skins_a, low_putts_a, ctp_b)
    const m = opt.match(/^(.+)_([a-z])$/)
    if (m && PER_FLIGHT_GAME_KEYS.has(m[1])) {
      games.add(m[1]); scope[m[1]] = 'flight'
    } else if (PER_FLIGHT_GAME_KEYS.has(opt)) {
      games.add(opt); scope[opt] = 'group'
    } else {
      games.add(opt)
    }
  }
  return { games, scope }
}
const PLACES_OPTIONS = [0,1,2,3,4,5,6,7,8,9,10]

// Shared alpha sort for event_player rows (ep.player.first_name, ep.player.last_name)
function epAlpha(a, b) {
  const fa = (a.player?.first_name ?? '').toLowerCase()
  const fb = (b.player?.first_name ?? '').toLowerCase()
  if (fa !== fb) return fa < fb ? -1 : 1
  const la = (a.player?.last_name ?? '').toLowerCase()
  const lb = (b.player?.last_name ?? '').toLowerCase()
  return la < lb ? -1 : 1
}

// Shared alpha sort for raw registration rows (first_name, last_name)
function regAlpha(a, b) {
  const fa = (a.first_name ?? '').toLowerCase()
  const fb = (b.first_name ?? '').toLowerCase()
  if (fa !== fb) return fa < fb ? -1 : 1
  const la = (a.last_name ?? '').toLowerCase()
  const lb = (b.last_name ?? '').toLowerCase()
  return la < lb ? -1 : 1
}


export default function EventDetail() {
  const { orgSlug, leagueSlug, eventSlug } = useParams()
  const org = useOrg()
  const hasFeature = useFeatures()
  const [event,        setEvent]        = useState(null)
  const [eventPlayers, setEventPlayers] = useState([])
  const [allScores,    setAllScores]    = useState([])
  const [sideGames,    setSideGames]    = useState([])
  const [course,       setCourse]       = useState(null)
  const [leagues,      setLeagues]      = useState([])
  const [allPlayers,   setAllPlayers]   = useState([])
  const [conflicts,      setConflicts]      = useState([])
  const [tglTeams,       setTglTeams]       = useState([])
  const [tglMembers,     setTglMembers]     = useState([])
  const [tglSelections,  setTglSelections]  = useState([])
  const [tglLocked,      setTglLocked]      = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [printAsset,     setPrintAsset]     = useState(null) // 'cards' | 'tee_sheet' | 'cart_signs'
  const [searchParams,   setSearchParams]   = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'Overview'
  const setActiveTab = (tab) => setSearchParams({ tab })

  const load = useCallback(async () => {
    const { data: league } = await supabase.from('leagues').select('id').eq('slug', leagueSlug).single()
    if (!league) { setLoading(false); return }

    const { data: evBase } = await supabase.from('events').select('id').eq('league_id', league.id).eq('slug', eventSlug).single()
    if (!evBase) { setLoading(false); return }

    const id = evBase.id

    const [
      { data: ev },
      { data: eps },
      { data: sc },
      { data: sg },
      { data: allP },
      { data: cf },
    ] = await Promise.all([
      supabase.from('events').select('*, league:leagues(*), course:courses(*)').eq('id', id).single(),
      supabase.from('event_players').select('*, player:players(*)').eq('event_id', id).order('flight').order('adjusted_handicap_index'),
      supabase.from('scores').select('*').eq('event_id', id),
      supabase.from('side_games').select('*, winner:players(first_name,last_name)').eq('event_id', id),
      supabase.from('players').select('*').order('first_name'),
      supabase.from('score_audit_log').select('*, player:players(first_name,last_name)').eq('event_id', id).eq('is_conflict', true).order('hole_number'),
    ])

    setEvent(ev)
    setEventPlayers(eps ?? [])
    setConflicts(cf ?? [])
    setAllScores(sc ?? [])
    setSideGames(sg ?? [])
    setCourse(ev?.course ?? null)
    setAllPlayers(allP ?? [])
    setLoading(false)

    // Load TGL data after main load so any error here doesn't block the page
    const leagueId = ev?.league_id
    if (leagueId) {
      const { data: tglT } = await supabase
        .from('tgl_teams').select('*').eq('league_id', leagueId).order('name')
      setTglTeams(tglT ?? [])

      if (tglT?.length) {
        const teamIds = tglT.map(t => t.id)
        const [{ data: members }, { data: sels }, { data: lock }] = await Promise.all([
          supabase.from('tgl_team_members')
            .select('*, player:players(first_name,last_name)')
            .in('team_id', teamIds),
          supabase.from('tgl_event_selections')
            .select('*, player:players(first_name,last_name)')
            .eq('event_id', id),
          supabase.from('tgl_event_locks')
            .select('id')
            .eq('event_id', id)
            .maybeSingle(),
        ])
        setTglMembers(members ?? [])
        setTglSelections(sels ?? [])
        setTglLocked(!!lock)
      }
    }
  }, [leagueSlug, eventSlug])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-10 w-64 bg-gray-200 rounded" /><div className="h-48 bg-gray-200 rounded-xl" /></div>
  if (!event)  return <p className="text-gray-500">Event not found.</p>

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 flex items-center gap-1.5">
        <Link to="/admin" className="hover:text-gray-700">Home</Link>
        <span>/</span>
        <Link to="/admin/leagues" className="hover:text-gray-700">Leagues</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{event.name ?? `Event #${event.event_number}`}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
              {event.league?.name} — {event.name ? event.name : `Event #${event.event_number}`}
            </h1>
            <StatusBadge status={event.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {event.course?.name} · {formatDate(event.event_date)} · Entry: ${event.entry_fee}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <a href={`/${orgSlug}/${event.league?.slug}/${event.slug}/event`} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm btn">
            Event Page ↗
          </a>
          <Link to={`/${orgSlug}/${event.league?.slug}/${event.slug}/schedule`} className="btn-secondary btn-sm btn">
            Pairings ↗
          </Link>
          <Link to={`/${orgSlug}/${event.league?.slug}/${event.slug}/leaderboard`} className="btn-secondary btn-sm btn">
            Leaderboard ↗
          </Link>
          {event.league?.org_id === import.meta.env.VITE_MIGC_ORG_ID && (
            <a href={`/wager/${event.id}/board`} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm btn">
              Wager Board ↗
            </a>
          )}
          <EventStatusControl event={event} onUpdated={load} />
        </div>
      </div>


      {/* Tabs — rendered in sidebar on desktop; shown here on mobile only */}
      <div className="border-b border-gray-200 md:hidden">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {ALL_ADMIN_TABS.filter(tab => {
            if (tab === 'Team Play') return hasFeature('tgl') && tglTeams.length > 0
            return true
          }).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab ? 'tab-active' : 'tab-inactive'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'Overview' && (
        <TabOverview event={event} eventPlayers={eventPlayers} allScores={allScores} sideGames={sideGames} course={course} conflicts={conflicts} onUpdated={load} leagues={leagues} orgName={org?.name} orgSlug={orgSlug} onPrintAsset={setPrintAsset} />
      )}

      {activeTab === 'Players' && (
        <div className="space-y-6">
          {hasFeature('registration') ? (
            <div id="registrations">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Registrations</h3>
              <TabRegistrations event={event} onUpdated={load} orgId={org?.id} />
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <svg width="16" height="16" fill="none" stroke="#1d4ed8" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <span style={{ color: '#1e40af' }}>
                <strong>Online Registration</strong> is a Club plan feature.{' '}
                <a href="/onboarding" className="underline font-semibold">Upgrade to Club →</a>
              </span>
            </div>
          )}
          <div id="roster" className="border-t border-gray-100 pt-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Players &amp; Flights</h3>
            <TabFlights event={event} eventPlayers={eventPlayers} course={course} allPlayers={allPlayers} onUpdated={load} />
          </div>
        </div>
      )}

      {activeTab === 'Groups' && (
        <div className="space-y-6">
          <TabGroups event={event} eventPlayers={eventPlayers} onUpdated={load} orgSlug={orgSlug} allScores={allScores} course={course} />
          {((event.formats ?? (event.format ? [event.format] : [])).includes('match_points') ||
            (event.formats ?? (event.format ? [event.format] : [])).includes('ryder_cup')) && (
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Match Play Pairings</h3>
              <MatchPairingsManager event={event} eventId={event.id} eventPlayers={eventPlayers} />
            </div>
          )}
          {(event.formats ?? (event.format ? [event.format] : [])).includes('team_match_play') && (
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Team Match Setup</h3>
              <TeamMatchSetup event={event} eventPlayers={eventPlayers} onUpdated={load} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'Side Games' && (
        <TabSideGamesMain
          event={event}
          eventPlayers={eventPlayers}
          course={course}
          sideGames={sideGames}
          onUpdated={load}
        />
      )}

      {activeTab === 'Payout' && (
        <div className="space-y-6">
          <div id="payout-config">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Payout Config</h3>
            <TabPayoutConfig event={event} eventPlayers={eventPlayers} course={course} onUpdated={load} />
          </div>
          <div id="payout-summary" className="border-t border-gray-100 pt-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Payout Summary</h3>
            <TabPayoutSummary event={event} eventPlayers={eventPlayers} allScores={allScores} sideGames={sideGames} course={course} />
          </div>
        </div>
      )}

      {activeTab === 'Pre/Post Round' && (
        <TabPostRound
          event={event}
          eventPlayers={eventPlayers}
          allScores={allScores}
          course={course}
          sideGames={sideGames}
          orgName={org?.name}
          orgLogoUrl={org?.logo_url ?? null}
          orgSlug={orgSlug}
          onPrintAsset={setPrintAsset}
          onUpdated={load}
          tglTeams={tglTeams}
          tglMembers={tglMembers}
          tglSelections={tglSelections}
          hasTgl={hasFeature('tgl') && tglTeams.length > 0}
        />
      )}

      {activeTab === 'Team Play' && (
        <TGLManager
          event={event}
          eventPlayers={eventPlayers}
          allScores={allScores}
          course={course}
          tglTeams={tglTeams}
          tglMembers={tglMembers}
          tglSelections={tglSelections}
          tglLocked={tglLocked}
          onUpdated={load}
        />
      )}

      {printAsset && <PrintAssets type={printAsset} event={event} eventPlayers={eventPlayers} tglSelections={tglSelections} onClose={() => setPrintAsset(null)} />}
    </div>
  )
}

// ─── Export Scores ────────────────────────────────────────────────
async function exportScoresCSV(event, eventPlayers, allScores, course, sideGames = []) {
  const XLSX = await import('xlsx')

  const scoreMap = {}
  for (const s of allScores) {
    if (!scoreMap[s.player_id]) scoreMap[s.player_id] = {}
    scoreMap[s.player_id][s.hole_number] = s
  }

  const sis  = course?.stroke_index ?? Array(18).fill(0)
  const pars = course?.par_per_hole  ?? Array(18).fill(0)

  const holeHeaders = Array.from({ length: 18 }, (_, i) => `H${i + 1}`)
  const sheetHeaders = ['Player', 'Flight', 'CH', ...holeHeaders, 'Total', 'Putts']

  const parRow  = ['PAR',  '', '', ...pars, pars.reduce((a, v) => a + v, 0), '']
  const siRow   = ['S.I.', '', '', ...sis,  '', '']

  // Build per-player hole data
  const playerData = eventPlayers.map(ep => {
    const pScores = scoreMap[ep.player_id] ?? {}
    const ch = parseInt(ep.course_handicap) || 0
    const playerSis = getStrokeIndexForTee(course, ep.tee)
    const holes = Array.from({ length: 18 }, (_, i) => {
      const gross  = parseInt(pScores[i + 1]?.gross_score) || null
      const putts  = parseInt(pScores[i + 1]?.putts) || 0
      const si     = playerSis[i] ?? (i + 1)
      const strokes = Math.floor(ch / 18) + (si <= (ch % 18) ? 1 : 0)
      const net    = gross != null ? gross - strokes : null
      return { gross, net, putts }
    })
    const totalGross = holes.reduce((a, h) => a + (h.gross ?? 0), 0)
    const totalNet   = holes.reduce((a, h) => a + (h.net   ?? 0), 0)
    const totalPutts = holes.reduce((a, h) => a + h.putts, 0)
    const playerName = [ep.player?.first_name, ep.player?.last_name].filter(Boolean).join(' ')
    return { playerName, flight: ep.flight ?? '', ch, holes, totalGross, totalNet, totalPutts }
  })

  // Sort by flight then score
  function sortedRows(data, scoreKey) {
    return [...data].sort((a, b) => {
      if (a.flight < b.flight) return -1
      if (a.flight > b.flight) return 1
      return (a[scoreKey] || 999) - (b[scoreKey] || 999)
    })
  }

  // ── Sheet 1: Gross ────────────────────────────────────────────────
  const grossRows = sortedRows(playerData, 'totalGross').map(p => [
    p.playerName, p.flight, p.ch || '',
    ...p.holes.map(h => h.gross ?? ''),
    p.totalGross || '', p.totalPutts || '',
  ])

  // ── Sheet 2: Net ──────────────────────────────────────────────────
  const netRows = sortedRows(playerData, 'totalNet').map(p => [
    p.playerName, p.flight, p.ch || '',
    ...p.holes.map(h => h.net ?? ''),
    p.totalNet || '', p.totalPutts || '',
  ])

  // ── Sheet 3: Payouts ──────────────────────────────────────────────
  const nonGuestEPs  = eventPlayers.filter(ep => !ep.is_guest)
  const flightCounts = {}
  nonGuestEPs.forEach(ep => { if (ep.flight) flightCounts[ep.flight] = (flightCounts[ep.flight] ?? 0) + 1 })
  const leaderboards  = computeLeaderboards(nonGuestEPs, allScores, course)
  const skinsResults  = computeAllSkins(nonGuestEPs, allScores, course)
  const { byCategory } = computePayouts(event, nonGuestEPs.length, leaderboards, sideGames, skinsResults, flightCounts)

  const playerMap = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep.player]))

  const payoutHeaders = ['Player', 'Category', 'Amount']
  const payoutRows = []
  for (const cat of byCategory) {
    const playerIds = cat.playerIds ?? (cat.playerId ? [cat.playerId] : [])
    const perPlayer = playerIds.length > 0 ? Math.floor((cat.amount / playerIds.length) * 100) / 100 : cat.amount
    for (const pid of playerIds) {
      const p = playerMap[pid]
      const name = p ? `${p.first_name} ${p.last_name}` : pid
      payoutRows.push([name, cat.label, perPlayer])
    }
    if (playerIds.length === 0) {
      payoutRows.push(['—', cat.label, cat.amount])
    }
  }

  // ── Build workbook ────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()

  const ws1 = XLSX.utils.aoa_to_sheet([sheetHeaders, parRow, siRow, ...grossRows])
  const ws2 = XLSX.utils.aoa_to_sheet([sheetHeaders, parRow, siRow, ...netRows])
  const ws3 = XLSX.utils.aoa_to_sheet([payoutHeaders, ...payoutRows])
  XLSX.utils.book_append_sheet(wb, ws1, 'Gross')
  XLSX.utils.book_append_sheet(wb, ws2, 'Net')
  XLSX.utils.book_append_sheet(wb, ws3, 'Payouts')

  XLSX.writeFile(wb, `event_${event.event_number}_scores.xlsx`)
}

function exportHandicapCSV(event, eventPlayers, allScores, course) {
  const pars = course?.par_per_hole ?? Array(18).fill(0)
  const sis  = course?.stroke_index ?? Array(18).fill(0)

  const scoreMap = {}
  for (const s of allScores) {
    if (!scoreMap[s.player_id]) scoreMap[s.player_id] = {}
    scoreMap[s.player_id][s.hole_number] = parseInt(s.gross_score) || null
  }

  const players = eventPlayers
    .filter(ep => !ep.is_guest)
    .sort((a, b) => {
      const fa = (a.flight ?? '').localeCompare(b.flight ?? '')
      return fa !== 0 ? fa : (a.adjusted_handicap_index ?? 999) - (b.adjusted_handicap_index ?? 999)
    })

  // Build per-player data with capped hole flags
  const playerRows = players.map(ep => {
    const ch = parseInt(ep.course_handicap) || parseInt(ep.adjusted_handicap_index) || 0
    const scores = scoreMap[ep.player_id] ?? {}
    const pName = [ep.player?.first_name, ep.player?.last_name].filter(Boolean).join(' ')
    const playerSis = getStrokeIndexForTee(course, ep.tee)

    const adjScores = []   // adjusted score per hole (or null)
    const capped    = []   // true if that hole was capped

    for (let h = 0; h < 18; h++) {
      const gross = scores[h + 1] ?? null
      if (gross === null) { adjScores.push(null); capped.push(false); continue }
      const full = Math.floor(ch / 18)
      const rem  = ch % 18
      const strokes = full + (playerSis[h] <= rem ? 1 : 0)
      const cap = pars[h] + 2 + strokes
      const adj = Math.min(gross, cap)
      adjScores.push(adj)
      capped.push(adj < gross)
    }

    const f9Vals = adjScores.slice(0, 9).filter(v => v !== null)
    const b9Vals = adjScores.slice(9).filter(v => v !== null)
    const adjF9  = f9Vals.length === 9 ? f9Vals.reduce((a, b) => a + b, 0) : ''
    const adjB9  = b9Vals.length === 9 ? b9Vals.reduce((a, b) => a + b, 0) : ''
    const adjTot = adjF9 !== '' && adjB9 !== '' ? adjF9 + adjB9 : ''
    const adjNotes = Array.from({ length: 18 }, (_, h) => {
      const gross = scores[h + 1] ?? null
      return capped[h] && gross !== null ? `H${h + 1}:${gross}->${adjScores[h]}` : null
    }).filter(Boolean).join(', ')

    return { pName, flight: ep.flight ?? '', ch, adjScores, capped, adjF9, adjB9, adjTot, adjNotes }
  })

  // Build HTML table so Excel renders cell colors
  const GRN  = '#1B4332'
  const GOLD = '#C9A84C'
  const AMBER_BG = '#FEF3C7'
  const AMBER_FG = '#92400E'

  function th(text, bg = GRN, color = '#fff', align = 'center') {
    return `<th style="background:${bg};color:${color};font-weight:bold;text-align:${align};padding:4px 6px;border:1px solid #aaa;white-space:nowrap">${text}</th>`
  }
  function td(text, bg = '#fff', color = '#111', bold = false, align = 'center') {
    return `<td style="background:${bg};color:${color};font-weight:${bold ? 'bold' : 'normal'};text-align:${align};padding:3px 5px;border:1px solid #ddd;white-space:nowrap">${text ?? ''}</td>`
  }

  const holeNums = Array.from({ length: 18 }, (_, i) => i + 1)
  const headerRow = `<tr>
    ${th('Player', GRN, '#fff', 'left')}
    ${th('Flight')}${th('CH')}
    ${holeNums.map(h => th(`H${h}`, '#2D6A4F')).join('')}
    ${th('Adj F9', '#1a3d2a')}${th('Adj B9', '#1a3d2a')}${th('Adj Total', '#1a3d2a')}
    ${th('Adjustments', GRN, GOLD, 'left')}
  </tr>`

  const parRowHtml = `<tr>
    ${td('Par', '#f0f4f2', GRN, true, 'left')}
    ${td('', '#f0f4f2')}${td('', '#f0f4f2')}
    ${pars.map(p => td(p, '#f0f4f2', GRN)).join('')}
    ${td(pars.slice(0,9).reduce((a,b)=>a+b,0), '#f0f4f2', GRN, true)}
    ${td(pars.slice(9).reduce((a,b)=>a+b,0), '#f0f4f2', GRN, true)}
    ${td(pars.reduce((a,b)=>a+b,0), '#f0f4f2', GRN, true)}
    ${td('', '#f0f4f2')}
  </tr>`

  const siRowHtml = `<tr>
    ${td('S.I.', '#3a5a4a', '#cde', true, 'left')}
    ${td('', '#3a5a4a')}${td('', '#3a5a4a')}
    ${sis.map(s => td(s, '#3a5a4a', '#cde')).join('')}
    ${td('', '#3a5a4a')}${td('', '#3a5a4a')}${td('', '#3a5a4a')}${td('', '#3a5a4a')}
  </tr>`

  const dataHtml = playerRows.map((r, i) => {
    const rowBg = i % 2 === 0 ? '#fff' : '#f7f7f5'
    const holeCells = r.adjScores.map((adj, h) => {
      if (adj === null) return td('', rowBg)
      return r.capped[h]
        ? td(adj, AMBER_BG, AMBER_FG, true)
        : td(adj, rowBg)
    }).join('')
    return `<tr>
      ${td(r.pName, rowBg, '#111', true, 'left')}
      ${td(r.flight, rowBg)}${td(r.ch, rowBg)}
      ${holeCells}
      ${td(r.adjF9, '#e8f0e8', GRN, true)}
      ${td(r.adjB9, '#e8f0e8', GRN, true)}
      ${td(r.adjTot, '#dceee6', GRN, true)}
      ${td(r.adjNotes || '', rowBg, '#555', false, 'left')}
    </tr>`
  }).join('')

  const evPart = (event.name ?? `event_${event.event_number}`).replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const eventDate = event.event_date ?? ''

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8">
    <style>body{font-family:Arial,sans-serif;font-size:11px}table{border-collapse:collapse}</style>
    </head><body>
    <h3 style="color:${GRN};margin-bottom:4px">${event.name ?? `Event #${event.event_number}`} — Handicap Entry</h3>
    <p style="color:#666;font-size:10px;margin-top:0">${eventDate} · Amber = score capped for handicap purposes</p>
    <table>${headerRow}${parRowHtml}${siRowHtml}${dataHtml}</table>
    </body></html>`

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = `handicap_entry_${evPart}.xls`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

// ─── Tab: Overview ────────────────────────────────────────────────
function TabOverview({ event, eventPlayers, allScores, sideGames, course, conflicts, onUpdated, orgName, orgSlug, onPrintAsset }) {
  const [editModal,   setEditModal]   = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)

  const holesEntered = new Set(allScores.map(s => `${s.player_id}-${s.hole_number}`)).size
  const nonGuests = eventPlayers.filter(e => !e.is_guest)
  const flightA = nonGuests.filter(e => e.flight === 'A').length
  const flightB = nonGuests.filter(e => e.flight === 'B').length

  // Scorecard link shown when event is active
  const scorecardUrl = `${window.location.origin}/${orgSlug}/${event.league?.slug}/${event.slug}/scorecard?eid=${event.id}`

  return (
    <div className="space-y-4">

      <Card id="event-details">
        <CardHeader
          title="Event Details"
          action={
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="secondary" onClick={() => setEditModal(true)}>Edit</Button>
              {event.status !== 'complete' && (
                <Button size="sm" variant="danger" onClick={() => setDeleteModal(true)}>Delete</Button>
              )}
            </div>
          }
        />
        <dl className="space-y-2 text-sm">
          <Row label="Date"         value={formatDate(event.event_date)} />
          <Row label="Course"       value={event.course?.name} />
          <Row label="League"       value={event.league?.name} />
          <Row label="Format"       value={FORMAT_LABELS[event.format] ?? event.format ?? 'Net Stroke Play'} />
          <Row label="Holes"        value={`${event.holes_played ?? 18} holes`} />
          <Row label="Start Time"   value={event.start_time ? formatTime(event.start_time) : '—'} />
          {!event.shotgun_start && <Row label="Tee Interval" value={`${event.tee_time_interval_mins ?? 10} min`} />}
          <Row label="Entry Fee"    value={`$${event.entry_fee}`} />
          {event.tournament_fee > 0 && <Row label="Tournament Entry Fee" value={`$${Number(event.tournament_fee).toFixed(2)}`} />}
          <Row label="Status"       value={<StatusBadge status={event.status} />} />
        </dl>
      </Card>

      <Card id="players-summary">
        <CardHeader title="Participants" />
        <dl className="space-y-2 text-sm">
          <Row label="Total Players"  value={`${nonGuests.length}${nonGuests.length !== eventPlayers.length ? ` + ${eventPlayers.length - nonGuests.length} guest${eventPlayers.length - nonGuests.length !== 1 ? 's' : ''}` : ''}`} />
          {(event.use_flights ?? false) && <Row label="Flight A" value={flightA} />}
          {(event.use_flights ?? false) && <Row label="Flight B" value={flightB} />}
          <Row label="Scores Entered" value={`${holesEntered} hole entries`} />
          <Row label="Total Pot"      value={`$${(event.entry_fee * nonGuests.length).toFixed(2)}`} />
        </dl>
      </Card>

      <Card id="public-event">
        <CardHeader title="Public Event Page" subtitle="Additional details shown to players" />
        <EventPublicFields event={event} onUpdated={onUpdated} />
      </Card>

      <Card id="cover-photo">
        <CardHeader title="Event Cover Photo" subtitle="Shown on the public event page" />
        <ImageUpload
          bucket="media"
          path={`events/${event.id}/cover`}
          currentUrl={event.cover_image_url ?? null}
          shape="rect"
          label="Recommended: 1200 × 800px JPG"
          onUploaded={async (url) => {
            await supabase.from('events').update({ cover_image_url: url }).eq('id', event.id)
            onUpdated()
          }}
          onRemoved={async () => {
            await supabase.from('events').update({ cover_image_url: null }).eq('id', event.id)
            onUpdated()
          }}
        />
      </Card>

      <Card id="event-photos">
        <CardHeader title="Event Photos" subtitle="Upload photos from the event — shown in a gallery on the public page" />
        <EventPhotosManager event={event} onUpdated={onUpdated} />
      </Card>

      {/* Score conflicts */}
      {conflicts.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader
            title={`⚠ Score Conflicts (${conflicts.length})`}
            subtitle="Multiple scorers entered different values for the same hole"
          />
          <div className="space-y-2 mt-1">
            {conflicts.map((c, i) => (
              <div key={i} className="flex items-start justify-between text-sm bg-white border border-red-200 rounded-lg px-3 py-2">
                <div>
                  <span className="font-semibold text-gray-900">
                    {c.player?.first_name} {c.player?.last_name}
                  </span>
                  <span className="text-gray-500 ml-2">· Hole {c.hole_number}</span>
                </div>
                <div className="text-right text-xs text-gray-600">
                  <div><span className="text-gray-400">Was</span> <strong>{c.previous_score}</strong> by <em>{c.previous_entered_by}</em></div>
                  <div><span className="text-red-500">Changed to</span> <strong>{c.new_score}</strong> by <em>{c.entered_by}</em></div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-500 mt-2">Use Edit Scores in the Pre/Post Round tab to review and correct the final values.</p>
        </Card>
      )}

      <EditEventModal open={editModal} onClose={() => setEditModal(false)} event={event} onSaved={onUpdated} />
      <DeleteEventModal open={deleteModal} onClose={() => setDeleteModal(false)} event={event} />
    </div>
  )
}

// ─── Description Editor (markdown bold/italic toolbar) ────────────────────────
function DescriptionEditor({ value, onChange }) {
  const ref = useRef(null)

  function wrap(marker) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const sel   = value.slice(start, end)
    const replacement = `${marker}${sel || 'text'}${marker}`
    const next = value.slice(0, start) + replacement + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const newStart = start + marker.length
      el.setSelectionRange(newStart, newStart + (sel || 'text').length)
    })
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-600">
      <div className="flex gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <button type="button" onMouseDown={e => { e.preventDefault(); wrap('**') }}
          className="px-2 py-0.5 text-sm font-bold text-gray-700 hover:bg-gray-200 rounded"
          title="Bold (**text**)">B</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); wrap('*') }}
          className="px-2 py-0.5 text-sm italic text-gray-700 hover:bg-gray-200 rounded"
          title="Italic (*text*)">I</button>
        <span className="text-xs text-gray-400 ml-2 self-center">Select text then click B or I</span>
      </div>
      <textarea
        ref={ref}
        className="w-full px-3 py-2 text-sm focus:outline-none bg-white"
        rows={5}
        placeholder="Describe the event — format, rules, prizes, anything players should know…"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ resize: 'vertical' }}
      />
    </div>
  )
}

// ─── Admin Score Editor ────────────────────────────────────────────
// ─── Public Event Fields (description, spots, sponsors) ───────────────────────
function EventPublicFields({ event, onUpdated }) {
  const [description, setDescription] = useState(event.description ?? '')
  const [spots,       setSpots]       = useState(event.registration_spots ?? '')
  const [sponsors,    setSponsors]    = useState(event.sponsors ?? [])
  const [saving,      setSaving]      = useState(false)
  const [sponsorName, setSponsorName] = useState('')
  const [uploading,   setUploading]   = useState(false)
  const fileRef = useRef(null)

  async function save() {
    setSaving(true)
    await supabase.from('events').update({
      description:        description.trim() || null,
      registration_spots: spots !== '' ? parseInt(spots) : null,
      sponsors:           sponsors.length > 0 ? sponsors : null,
    }).eq('id', event.id)
    setSaving(false)
    toast.success('Saved')
    onUpdated()
  }

  async function uploadSponsorLogo(file, idx) {
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase()
    const path = `events/${event.id}/sponsors/sponsor_${idx}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true })
    if (error) { toast.error(error.message); setUploading(false); return }
    const { data } = supabase.storage.from('media').getPublicUrl(path)
    setSponsors(prev => prev.map((s, i) => i === idx ? { ...s, logo_url: data.publicUrl } : s))
    setUploading(false)
  }

  function addSponsor() {
    if (!sponsorName.trim()) return
    setSponsors(prev => [...prev, { name: sponsorName.trim(), logo_url: null, url: '' }])
    setSponsorName('')
  }

  function updateSponsorUrl(idx, url) {
    setSponsors(prev => prev.map((s, i) => i === idx ? { ...s, url } : s))
  }

  function removeSponsor(idx) {
    setSponsors(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-4">
      {/* Description */}
      <div>
        <label className="label">Tournament Description</label>
        <DescriptionEditor value={description} onChange={setDescription} />
      </div>

      {/* Registration spots */}
      <div className="w-40">
        <Input
          label="Total Registration Spots"
          type="number"
          min="1"
          placeholder="e.g. 40"
          value={spots}
          onChange={e => setSpots(e.target.value)}
        />
      </div>

      {/* Sponsors */}
      <div>
        <label className="label">Sponsors</label>
        <div className="space-y-2 mb-3">
          {sponsors.map((s, idx) => (
            <div key={idx} className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 space-y-2">
              <div className="flex items-center gap-3">
                {s.logo_url ? (
                  <img src={s.logo_url} alt={s.name} style={{ height: 32, maxWidth: 80, objectFit: 'contain' }} />
                ) : (
                  <div className="text-xs text-gray-400 w-20 text-center">No logo</div>
                )}
                <span className="text-sm font-semibold flex-1">{s.name}</span>
                <label className="text-xs text-fairway-600 cursor-pointer underline">
                  {uploading ? 'Uploading…' : 'Upload logo'}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => uploadSponsorLogo(e.target.files[0], idx)} />
                </label>
                <button type="button" onClick={() => removeSponsor(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
              </div>
              <input
                type="url"
                value={s.url ?? ''}
                onChange={e => updateSponsorUrl(idx, e.target.value)}
                placeholder="https://sponsor-website.com (optional)"
                className="input text-xs w-full"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Sponsor name…"
            value={sponsorName}
            onChange={e => setSponsorName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSponsor())}
          />
          <Button size="sm" variant="secondary" onClick={addSponsor} type="button">Add</Button>
        </div>
      </div>

      <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
    </div>
  )
}

function AdminScoreEditor({ event, eventPlayers, allScores, course, onClose, onSaved }) {
  const [selectedId, setSelectedId] = useState(eventPlayers[0]?.player_id ?? null)
  const [scores,     setScores]     = useState(() => {
    const map = {}
    for (const s of allScores) {
      if (!map[s.player_id]) map[s.player_id] = {}
      map[s.player_id][s.hole_number] = { gross: s.gross_score ?? '', putts: s.putts ?? '' }
    }
    return map
  })
  const [saving, setSaving] = useState(false)

  const groups = {}
  for (const ep of eventPlayers) {
    const g = ep.group_number ?? 'Unassigned'
    if (!groups[g]) groups[g] = []
    groups[g].push(ep)
  }

  const selectedEp = eventPlayers.find(ep => ep.player_id === selectedId)
  const ch = selectedEp?.course_handicap ?? 0

  function getVal(hole, field) {
    return scores[selectedId]?.[hole]?.[field] ?? ''
  }

  function setVal(hole, field, value) {
    setScores(prev => ({
      ...prev,
      [selectedId]: {
        ...(prev[selectedId] ?? {}),
        [hole]: { ...(prev[selectedId]?.[hole] ?? {}), [field]: value },
      },
    }))
  }

  async function savePlayer() {
    if (!selectedId) return
    setSaving(true)
    const playerScores = scores[selectedId] ?? {}
    for (const [hStr, sc] of Object.entries(playerScores)) {
      const hole  = parseInt(hStr, 10)
      const gross = parseInt(sc.gross, 10)
      if (!gross || gross < 1) continue
      await supabase.from('scores').upsert({
        event_id:    event.id,
        player_id:   selectedId,
        hole_number: hole,
        gross_score: gross,
        putts:       sc.putts !== '' ? parseInt(sc.putts, 10) : null,
      }, { onConflict: 'event_id,player_id,hole_number' })
    }
    setSaving(false)
    toast.success('Scores saved')
    onSaved()
  }

  const holes = course ? Array.from({ length: 18 }, (_, i) => i + 1) : []

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="flex w-full max-w-5xl mx-auto my-4 bg-white rounded-xl overflow-hidden shadow-2xl">

        {/* Sidebar — player list */}
        <div className="w-56 shrink-0 border-r border-gray-200 flex flex-col" style={{ background: '#f8f9fa' }}>
          <div className="px-4 py-3 border-b border-gray-200" style={{ background: '#1B4332' }}>
            <p className="text-xs font-bold uppercase tracking-wider text-white/70">Players</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {Object.entries(groups).sort(([a],[b]) => a < b ? -1 : 1).map(([grp, players]) => (
              <div key={grp}>
                <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6c757d', background: '#f0f0ee' }}>
                  Group {grp}
                </div>
                {players.map(ep => {
                  const entered = Object.keys(scores[ep.player_id] ?? {}).length
                  const isSelected = ep.player_id === selectedId
                  return (
                    <button
                      key={ep.player_id}
                      onClick={() => setSelectedId(ep.player_id)}
                      className="w-full text-left px-3 py-2.5 border-b border-gray-100 transition-colors"
                      style={{ background: isSelected ? '#1B4332' : 'transparent', color: isSelected ? '#fff' : '#212529' }}
                    >
                      <div className="text-xs font-semibold truncate">{ep.player?.first_name} {ep.player?.last_name}</div>
                      <div className="text-xs mt-0.5" style={{ color: isSelected ? 'rgba(255,255,255,0.6)' : '#6c757d' }}>
                        {entered}/18 holes · CH {ep.course_handicap ?? '—'}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Main — score grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200" style={{ background: '#1B4332', borderBottom: '2px solid #D4AF37' }}>
            <div>
              <p style={{ fontFamily: "'Playfair Display',serif", color: '#D4AF37', fontWeight: 700, fontSize: '1rem' }}>
                Admin Score Entry
              </p>
              {selectedEp && (
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {selectedEp.player?.first_name} {selectedEp.player?.last_name} · CH {ch} · Flight {selectedEp.flight ?? '—'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={savePlayer} loading={saving}>Save</Button>
              <button onClick={onClose} className="text-white/60 hover:text-white text-lg leading-none px-2">✕</button>
            </div>
          </div>

          {/* Score grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {!course ? (
              <p className="text-sm text-gray-400 text-center py-8">No course data available.</p>
            ) : (
              [['Front 9', holes.slice(0,9)], ['Back 9', holes.slice(9)]].map(([label, holeGroup]) => (
                <div key={label} className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#1B4332' }}>{label}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr style={{ background: '#2D6A4F', color: '#fff' }}>
                          <td className="px-2 py-1.5 font-semibold w-16">Hole</td>
                          {holeGroup.map(h => <td key={h} className="px-2 py-1.5 text-center font-semibold w-12">{h}</td>)}
                          <td className="px-2 py-1.5 text-center font-semibold w-14">Total</td>
                        </tr>
                        <tr style={{ background: '#f0f0ee', color: '#6c757d' }}>
                          <td className="px-2 py-1">Par</td>
                          {holeGroup.map(h => <td key={h} className="px-2 py-1 text-center">{course.par_per_hole[h-1]}</td>)}
                          <td className="px-2 py-1 text-center font-semibold" style={{ color: '#1B4332' }}>
                            {holeGroup.reduce((s,h) => s + course.par_per_hole[h-1], 0)}
                          </td>
                        </tr>
                        <tr style={{ background: '#f0f0ee', color: '#6c757d' }}>
                          <td className="px-2 py-1">S.I.</td>
                          {holeGroup.map(h => <td key={h} className="px-2 py-1 text-center">{getStrokeIndexForTee(course, selectedEp?.tee)[h-1]}</td>)}
                          <td className="px-2 py-1" />
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-gray-200">
                          <td className="px-2 py-1 font-semibold" style={{ color: '#1B4332' }}>Gross</td>
                          {holeGroup.map(h => {
                            const val = getVal(h, 'gross')
                            const par = course.par_per_hole[h-1]
                            const diff = val !== '' ? parseInt(val,10) - par : null
                            const bg = diff == null ? '' : diff < 0 ? '#fee2e2' : diff === 0 ? '#f0fdf4' : diff === 1 ? '#fff' : '#fef9c3'
                            return (
                              <td key={h} className="px-1 py-1 text-center" style={{ background: bg }}>
                                <input
                                  type="number"
                                  min="1" max="15"
                                  value={val}
                                  onChange={e => setVal(h, 'gross', e.target.value)}
                                  className="w-10 text-center font-bold text-sm border border-gray-200 rounded focus:outline-none focus:border-fairway-500"
                                  style={{ background: 'transparent' }}
                                  inputMode="numeric"
                                />
                              </td>
                            )
                          })}
                          <td className="px-2 py-1 text-center font-bold" style={{ color: '#1B4332' }}>
                            {holeGroup.reduce((s,h) => {
                              const v = parseInt(getVal(h,'gross'),10)
                              return isNaN(v) ? s : s + v
                            }, 0) || '—'}
                          </td>
                        </tr>
                        <tr className="border-t border-gray-100">
                          <td className="px-2 py-1 font-semibold" style={{ color: '#6c757d' }}>Putts</td>
                          {holeGroup.map(h => (
                            <td key={h} className="px-1 py-1 text-center">
                              <input
                                type="number"
                                min="0" max="10"
                                value={getVal(h, 'putts')}
                                onChange={e => setVal(h, 'putts', e.target.value)}
                                className="w-10 text-center text-xs border border-gray-200 rounded focus:outline-none focus:border-fairway-500"
                                inputMode="numeric"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1 text-center text-xs" style={{ color: '#6c757d' }}>
                            {holeGroup.reduce((s,h) => {
                              const v = parseInt(getVal(h,'putts'),10)
                              return isNaN(v) ? s : s + v
                            }, 0) || '—'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-5 py-3 flex items-center justify-between bg-gray-50">
            <p className="text-xs text-gray-400">Scores are saved per player. Switch players using the sidebar.</p>
            <Button onClick={savePlayer} loading={saving}>Save Scores</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Handicap Modal ─────────────────────────────────────────────
function EditHandicapModal({ ep, course, onClose, onSaved }) {
  const [hi, setHi] = useState(ep.handicap_index ?? '')
  const [ch, setCh] = useState(ep.course_handicap ?? '')
  const [autoCalc, setAutoCalc] = useState(false)
  const [saving, setSaving] = useState(false)

  // Auto-calculate CH from HI whenever HI changes and autoCalc is on
  const calcCh = useCallback((hiVal) => {
    if (!course) return ''
    const { slope, rating, par } = course
    if (!slope || !rating || !par) return ''
    return Math.round((parseFloat(hiVal) * slope / 113) + (rating - par))
  }, [course])

  function handleHiChange(val) {
    setHi(val)
    if (autoCalc && val !== '' && !isNaN(parseFloat(val))) {
      setCh(calcCh(val))
    }
  }

  function toggleAuto(checked) {
    setAutoCalc(checked)
    if (checked && hi !== '' && !isNaN(parseFloat(hi))) {
      setCh(calcCh(hi))
    }
  }

  async function handleSave() {
    setSaving(true)
    const hiVal = parseFloat(hi)
    if (isNaN(hiVal)) { toast.error('Invalid handicap index'); setSaving(false); return }
    const chVal = ch !== '' ? parseInt(ch, 10) : null
    const { error } = await supabase
      .from('event_players')
      .update({ handicap_index: hiVal, adjusted_handicap_index: hiVal, course_handicap: chVal })
      .eq('id', ep.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Handicap updated')
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Edit Handicap</h2>
        <p className="text-sm text-gray-600">{ep.player?.first_name} {ep.player?.last_name}</p>

        <div>
          <label className="label">Handicap Index</label>
          <input
            type="number"
            step="0.1"
            value={hi}
            onChange={e => handleHiChange(e.target.value)}
            className="input"
            placeholder="e.g. 14.2"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Course Handicap</label>
            {course && (
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={autoCalc} onChange={e => toggleAuto(e.target.checked)} />
                Auto-calculate
              </label>
            )}
          </div>
          <input
            type="number"
            value={ch}
            onChange={e => setCh(e.target.value)}
            className="input"
            placeholder="e.g. 16"
            readOnly={autoCalc}
          />
          {autoCalc && course && (
            <p className="text-xs text-gray-400 mt-1">
              Calculated: ({hi} × {course.slope} / 113) + ({course.rating} − {course.par})
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={onClose} variant="secondary" className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Pre/Post Round ──────────────────────────────────────────
function TabPostRound({ event, eventPlayers, allScores, course, sideGames, orgName, orgLogoUrl, orgSlug, onPrintAsset, onUpdated, tglTeams, tglMembers, tglSelections, hasTgl }) {
  const [scoreEditor, setScoreEditor] = useState(false)
  const hasSkins = (event?.side_game_options ?? []).some(s => s.startsWith('skins'))
  const leagueName = event.league?.name ?? orgName
  const logoUrl = event.league?.logo_url ?? orgLogoUrl ?? null

  return (
    <div className="space-y-6 max-w-xl">

      {/* ── Pre-Round ─────────────────────────────────────────── */}
      <div id="print-assets" className="bg-gray-50 rounded-xl px-4 py-4 space-y-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pre-Round</div>
        <div>
          <div className="text-sm font-medium text-gray-800 mb-2">Print Assets</div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => onPrintAsset('tee_sheet')}>Tee Sheet</Button>
            <Button size="sm" variant="secondary" onClick={() => onPrintAsset('cart_signs')}>Cart Signs</Button>
            <Button size="sm" variant="secondary" onClick={() => onPrintAsset('cards')}>Side Game Signs</Button>
          </div>
          <div className="text-xs text-gray-400 mt-1.5">Tee sheet, cart signs, and side game cards for the round</div>
        </div>
        <div id="export-scorecards" className="flex items-center justify-between border-t border-gray-200 pt-3">
          <div>
            <div className="text-sm font-medium text-gray-800">Export Scorecards (PNG)</div>
            <div className="text-xs text-gray-400 mt-0.5">Printable scorecards with QR codes, one per group</div>
          </div>
          <ExportScorecardsButton
            event={event}
            eventPlayers={eventPlayers}
            course={course}
            orgName={leagueName}
            orgSlug={orgSlug}
            orgLogoUrl={logoUrl}
          />
        </div>
      </div>

      {/* ── Scoring ───────────────────────────────────────────── */}
      <div id="edit-scores" className="bg-gray-50 rounded-xl px-4 py-4 space-y-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Scoring</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-800">Edit Scores</div>
            <div className="text-xs text-gray-400 mt-0.5">Manually enter or correct hole-by-hole scores</div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setScoreEditor(true)}>Edit Scores</Button>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 pt-3">
          <div>
            <div className="text-sm font-medium text-gray-800">Scores Export (CSV)</div>
            <div className="text-xs text-gray-400 mt-0.5">All player scores, net, gross — one row per player per hole</div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => exportScoresCSV(event, eventPlayers, allScores, course, sideGames)}>
            Download
          </Button>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 pt-3">
          <div>
            <div className="text-sm font-medium text-gray-800">Handicap Entry (Excel)</div>
            <div className="text-xs text-gray-400 mt-0.5">USGA adjusted scores per hole — amber cells indicate capped scores</div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => exportHandicapCSV(event, eventPlayers, allScores, course)}>
            Download
          </Button>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────── */}
      <div id="scores-export" className="bg-gray-50 rounded-xl px-4 py-4 space-y-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Results</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-800">Tournament Results (PNG)</div>
            <div className="text-xs text-gray-400 mt-0.5">Full results card — scoring, skins, long drive, CTP</div>
          </div>
          <ExportResultsButton
            event={event}
            eventPlayers={eventPlayers}
            allScores={allScores}
            course={course}
            sideGames={sideGames ?? []}
            orgName={leagueName}
            orgLogoUrl={logoUrl}
          />
        </div>
        {hasSkins && (
          <div className="flex items-center justify-between border-t border-gray-200 pt-3">
            <div>
              <div className="text-sm font-medium text-gray-800">Scoring Summary (PNG)</div>
              <div className="text-xs text-gray-400 mt-0.5">Hole-by-hole skins results by flight, sorted by net score</div>
            </div>
            <ExportSkinsGridButton
              event={event}
              eventPlayers={eventPlayers}
              allScores={allScores}
              course={course}
              orgName={leagueName}
              orgLogoUrl={logoUrl}
            />
          </div>
        )}
        {hasTgl && (
          <div className="flex items-center justify-between border-t border-gray-200 pt-3">
            <div>
              <div className="text-sm font-medium text-gray-800">Team Play Results (PNG)</div>
              <div className="text-xs text-gray-400 mt-0.5">Team participants and points totals for this event</div>
            </div>
            <ExportTeamPlayButton
              event={event}
              eventPlayers={eventPlayers}
              allScores={allScores}
              course={course}
              tglTeams={tglTeams}
              tglMembers={tglMembers}
              tglSelections={tglSelections}
              orgName={leagueName}
              orgLogoUrl={logoUrl}
            />
          </div>
        )}
      </div>

      {scoreEditor && (
        <AdminScoreEditor
          event={event}
          eventPlayers={eventPlayers}
          allScores={allScores}
          course={course}
          onClose={() => setScoreEditor(false)}
          onSaved={onUpdated}
        />
      )}
    </div>
  )
}

// ─── Event Photos Manager ───────────────────────────────────────────
function EventPhotosManager({ event, onUpdated }) {
  const normalize = arr => (arr ?? []).map(p => typeof p === 'string' ? { url: p } : p)
  const [photos,    setPhotos]   = useState(() => normalize(event.photos))
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    try {
      const uploaded = []
      for (const file of files) {
        const ext  = file.name.split('.').pop()
        const path = `events/${event.id}/photos/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('media').upload(path, file, { upsert: false })
        if (error) { toast.error(`Upload failed: ${error.message}`); continue }
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
        uploaded.push({ url: publicUrl, uploaded_at: new Date().toISOString() })
      }
      if (!uploaded.length) return
      const next = [...photos, ...uploaded]
      setPhotos(next)
      await supabase.from('events').update({ photos: next }).eq('id', event.id)
      onUpdated()
      toast.success(`${uploaded.length} photo${uploaded.length !== 1 ? 's' : ''} uploaded`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function removePhoto(url) {
    const next = photos.filter(p => p.url !== url)
    setPhotos(next)
    await supabase.from('events').update({ photos: next }).eq('id', event.id)
    onUpdated()
  }

  async function downloadAll() {
    for (let i = 0; i < photos.length; i++) {
      const url = photos[i].url
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `event-photo-${i + 1}.${blob.type.split('/')[1] || 'jpg'}`
      a.click()
      URL.revokeObjectURL(a.href)
      await new Promise(r => setTimeout(r, 300))
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed cursor-pointer text-sm font-semibold transition-colors ${uploading ? 'opacity-50 pointer-events-none border-gray-200 text-gray-400' : 'border-fairway-400 text-fairway-700 hover:bg-fairway-50'}`}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4"/></svg>
          {uploading ? 'Uploading…' : 'Upload Photos'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {photos.length > 0 && (
          <button onClick={downloadAll} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4"/></svg>
            Download All ({photos.length})
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400">JPG, PNG, HEIC · Multiple files supported</p>

      {/* Photo grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-100">
              <div className="aspect-square">
                <img src={photo.url} alt={photo.caption ?? `Event photo ${i + 1}`} className="w-full h-full object-cover" />
              </div>
              {(photo.caption || photo.uploaded_by) && (
                <div className="px-2 py-1.5 bg-white">
                  {photo.caption && <p className="text-xs font-semibold text-gray-800 truncate">{photo.caption}</p>}
                  {photo.uploaded_by && <p className="text-xs text-gray-400 truncate">{photo.uploaded_by}</p>}
                </div>
              )}
              <button
                onClick={() => removePhoto(photo.url)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                title="Remove photo"
              >✕</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No photos yet — upload some from the event.</p>
      )}
    </div>
  )
}

// ─── Tab: Players & Flights ────────────────────────────────────────
function TabFlights({ event, eventPlayers, course, allPlayers, onUpdated }) {
  const [addModal,      setAddModal]      = useState(false)
  const [upgradePrompt, setUpgradePrompt] = useState(false)
  const [editingEp, setEditingEp] = useState(null) // ep being edited
  const org     = useOrg()
  const orgTier = org?.tier ?? 'free'

  const rostered = new Set(eventPlayers.map(ep => ep.player_id))
  const available = allPlayers.filter(p => !rostered.has(p.id))

  async function overrideFlight(epId, newFlight) {
    const patch = newFlight === 'guest'
      ? { is_guest: true,  flight: null }
      : { is_guest: false, flight: newFlight || null }
    const { error } = await supabase.from('event_players').update(patch).eq('id', epId)
    if (error) toast.error(error.message)
    else onUpdated()
  }

  async function overrideTee(epId, tee) {
    const { error } = await supabase.from('event_players').update({ tee: tee || null }).eq('id', epId)
    if (error) toast.error(error.message)
    else onUpdated()
  }

  async function removePlayer(epId) {
    if (!confirm('Remove player from this event?')) return
    const { error } = await supabase.from('event_players').delete().eq('id', epId)
    if (error) toast.error(error.message)
    else { toast.success('Player removed'); onUpdated() }
  }

  const guests   = eventPlayers.filter(e => e.is_guest).sort(epAlpha)
  const nonGuests = eventPlayers.filter(e => !e.is_guest).sort(epAlpha)
  const flightA = nonGuests.filter(e => e.flight === 'A')
  const flightB = nonGuests.filter(e => e.flight === 'B')
  const unassigned = nonGuests.filter(e => !e.flight)

  const courseTees = course?.tees ?? []

  async function saveTeeAssignment(field, value, flight) {
    const { error } = await supabase.from('events').update({ [field]: value || null }).eq('id', event.id)
    if (error) { toast.error(error.message); return }

    // Bulk-apply tee to all players in the flight (or all players when no flights)
    const playerIds = flight
      ? eventPlayers.filter(ep => ep.flight === flight).map(ep => ep.id)
      : eventPlayers.map(ep => ep.id)

    if (playerIds.length > 0) {
      await supabase
        .from('event_players')
        .update({ tee: value || null })
        .in('id', playerIds)
    }

    onUpdated()
  }

  const useFlights = event.use_flights ?? false

  // Shared player row renderer — called as renderPlayerRow(ep), NOT as <PlayerRow>
  function renderPlayerRow(ep) {
    return (
      <div key={ep.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-3 gap-2">
        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900">
            {ep.player?.first_name} {ep.player?.last_name}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2 mt-1 flex-wrap">
            {ep.is_guest
              ? <span className="bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full text-xs">Guest – Player Only</span>
              : <>
                  <span>HI: {ep.handicap_index ?? '—'}</span>
                  {ep.adjusted_handicap_index != null && ep.adjusted_handicap_index !== ep.handicap_index && (
                    <span className="text-orange-600">Adj: {ep.adjusted_handicap_index}</span>
                  )}
                  {ep.course_handicap != null && <span>CH: {ep.course_handicap}</span>}
                </>
            }
            {ep.tournament_wins_prior > 0 && (
              <span className="text-fairway-700 font-medium">{ep.tournament_wins_prior} win{ep.tournament_wins_prior !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setEditingEp(ep)}
            style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
          >Edit</button>
          {courseTees.length > 0 && (
            <select
              value={ep.tee ?? ''}
              onChange={e => overrideTee(ep.id, e.target.value)}
              className="input py-1 text-xs w-28"
              title="Tee override"
            >
              <option value="">— Tee —</option>
              {courseTees.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          )}
          {useFlights && (
            <select
              value={ep.is_guest ? 'guest' : (ep.flight ?? '')}
              onChange={e => overrideFlight(ep.id, e.target.value)}
              className="input py-1 text-xs w-28"
            >
              <option value="">—</option>
              <option value="A">Flight A</option>
              <option value="B">Flight B</option>
              <option value="guest">Guest Player</option>
            </select>
          )}
          {!useFlights && (
            <button
              type="button"
              onClick={() => overrideFlight(ep.id, ep.is_guest ? '' : 'guest')}
              className={`text-xs shrink-0 px-2 py-1 rounded-full font-semibold border ${ep.is_guest ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
            >
              Guest
            </button>
          )}
          <button
            onClick={() => removePlayer(ep.id)}
            aria-label="Remove player"
            className="text-red-400 hover:text-red-600 p-1"
          >✕</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {editingEp && (
        <EditHandicapModal
          ep={editingEp}
          course={course}
          onClose={() => setEditingEp(null)}
          onSaved={() => { setEditingEp(null); onUpdated() }}
        />
      )}
      {/* Tee Assignment — per flight when flights on, single tee when off */}
      {courseTees.length > 0 && (
        <Card>
          <CardHeader
            title="Tee Assignment"
            subtitle={useFlights ? 'Which tees each flight plays from' : 'Which tees players play from'}
          />
          <div className={`grid gap-4 mt-1 ${useFlights ? 'sm:grid-cols-2' : 'max-w-xs'}`}>
            {useFlights ? ['A', 'B'].map(flight => {
              const field = `tee_flight_${flight.toLowerCase()}`
              const current = event[field] ?? ''
              return (
                <div key={flight}>
                  <label className="label">Flight {flight} Tee</label>
                  <select value={current} onChange={e => saveTeeAssignment(field, e.target.value, flight)} className="input bg-white">
                    <option value="">— Not assigned —</option>
                    {courseTees.map(t => (
                      <option key={t.name} value={t.name}>{t.name}{t.color ? ` (${t.color})` : ''} — Slope {t.slope} / Rating {t.rating}</option>
                    ))}
                  </select>
                </div>
              )
            }) : (
              <div>
                <label className="label">Tee</label>
                <select
                  value={event.tee_flight_a ?? ''}
                  onChange={e => saveTeeAssignment('tee_flight_a', e.target.value, null)}
                  className="input bg-white"
                >
                  <option value="">— Not assigned —</option>
                  {courseTees.map(t => (
                    <option key={t.name} value={t.name}>{t.name}{t.color ? ` (${t.color})` : ''} — Slope {t.slope} / Rating {t.rating}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => {
          if (atLimit(orgTier, 'players', eventPlayers.length)) setUpgradePrompt(true)
          else setAddModal(true)
        }} variant="secondary">+ Add Player to Event</Button>
        {eventPlayers.length > 0 && (
          <span className="text-sm text-gray-500">
            {useFlights
              ? `${nonGuests.length} players · Flight A: ${flightA.length} · Flight B: ${flightB.length}${guests.length > 0 ? ` · ${guests.length} guest${guests.length !== 1 ? 's' : ''}` : ''}`
              : `${nonGuests.length} player${nonGuests.length !== 1 ? 's' : ''}${guests.length > 0 ? ` · ${guests.length} guest${guests.length !== 1 ? 's' : ''}` : ''}`
            }
          </span>
        )}
        {atLimit(orgTier, 'players', eventPlayers.length) && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#fef9c3', color: '#854d0e' }}>
            {eventPlayers.length} / {getLimit(orgTier, 'players')} players — {TIER_LABELS[nextTier(orgTier)]} plan required
          </span>
        )}
      </div>

      {/* Unassigned warning — only relevant when flights are on */}
      {useFlights && unassigned.length > 0 && (
        <Card className="overflow-hidden p-0 border-yellow-300">
          <div className="px-5 py-3 border-b border-yellow-200 flex items-center gap-2 bg-yellow-50">
            <span className="text-sm font-semibold text-yellow-800">⚠ Unassigned — {unassigned.length} player{unassigned.length !== 1 ? 's' : ''} need a flight</span>
          </div>
          <div className="divide-y divide-gray-100">
            {unassigned.map(ep => (
              <div key={ep.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="font-medium text-sm text-gray-900">{ep.player?.first_name} {ep.player?.last_name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                    <span>HI: {ep.handicap_index}</span>
                    {ep.course_handicap != null && <span>CH: {ep.course_handicap}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select value="" onChange={e => overrideFlight(ep.id, e.target.value)} className="input py-1 text-xs w-28 border-yellow-400 bg-yellow-50">
                    <option value="">Assign flight…</option>
                    <option value="A">Flight A</option>
                    <option value="B">Flight B</option>
                    <option value="guest">Guest Player</option>
                  </select>
                  <button onClick={() => setEditingEp(ep)} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-fairway-100 text-gray-600 hover:text-fairway-800 font-medium">Edit HI</button>
                  <button onClick={() => removePlayer(ep.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Flight-based roster — only when flights on */}
      {useFlights ? (
        <>
          {['A', 'B'].map(flight => {
            const list = flight === 'A' ? flightA : flightB
            if (list.length === 0 && eventPlayers.length > 0) return null
            return (
              <Card key={flight} className="overflow-hidden p-0">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
                  <FlightBadge flight={flight} />
                  <span className="text-sm font-semibold text-gray-700">{list.length} players</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {list.map(ep => renderPlayerRow(ep))}
                </div>
              </Card>
            )
          })}
          {guests.length > 0 && (
            <Card className="overflow-hidden p-0">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-purple-50">
                <span className="bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full text-xs">Guests</span>
                <span className="text-sm font-semibold text-gray-700">{guests.length} player{guests.length !== 1 ? 's' : ''} — playing only, excluded from bets/payouts</span>
              </div>
              <div className="divide-y divide-gray-100">
                {guests.map(ep => renderPlayerRow(ep))}
              </div>
            </Card>
          )}
        </>
      ) : (
        /* No flights — single flat roster */
        eventPlayers.length > 0 && (
          <Card className="overflow-hidden p-0">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-semibold text-gray-700">Players ({eventPlayers.length})</span>
            </div>
            <div className="divide-y divide-gray-100">
              {[...eventPlayers].sort(epAlpha).map(ep => renderPlayerRow(ep))}
            </div>
          </Card>
        )
      )}

      {eventPlayers.length === 0 && (
        <Card className="text-center py-10">
          <p className="text-gray-400 text-sm">No players added yet. Add players to this event.</p>
        </Card>
      )}

      <AddPlayerModal
        open={addModal}
        onClose={() => setAddModal(false)}
        eventId={event.id}
        available={available}
        course={course}
        useFlights={useFlights}
        useHandicaps={event.use_handicaps ?? true}
        onSaved={onUpdated}
      />

      <UpgradePrompt
        open={upgradePrompt}
        onClose={() => setUpgradePrompt(false)}
        reason={`You've reached the ${getLimit(orgTier, 'players')}-player limit on the ${TIER_LABELS[orgTier]} plan.`}
        requiredTier={nextTier(orgTier)}
      />
    </div>
  )
}

function AddPlayerModal({ open, onClose, eventId, available, course, useFlights, useHandicaps = true, onSaved }) {
  // bulk: { [playerId]: { hi, flight, checked } }
  const [bulk,    setBulk]    = useState({})
  const [saving,  setSaving]  = useState(false)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    if (!open) { setBulk({}); setSearch('') }
  }, [open])

  function toggle(playerId) {
    setBulk(prev => {
      const next = { ...prev }
      if (next[playerId]) {
        delete next[playerId]
      } else {
        next[playerId] = { hi: '', flight: '', autoHC: false, ch: '' }
      }
      return next
    })
  }

  function setField(playerId, field, value) {
    setBulk(prev => {
      const current = prev[playerId] ?? { hi: '', flight: '', autoHC: true, ch: '' }
      const updated = { ...current, [field]: value }
      // Recompute auto CH when HI changes
      if (field === 'hi' && updated.autoHC && course) {
        const hi = parseFloat(value)
        if (!isNaN(hi)) {
          updated.ch = Math.round((hi * course.slope / 113) + (course.rating - course.par))
        } else {
          updated.ch = ''
        }
      }
      // When toggling autoHC on, recompute
      if (field === 'autoHC' && value === true && course) {
        const hi = parseFloat(current.hi)
        if (!isNaN(hi)) {
          updated.ch = Math.round((hi * course.slope / 113) + (course.rating - course.par))
        }
      }
      return { ...prev, [playerId]: updated }
    })
  }

  function selectAll() {
    const next = {}
    available.forEach(p => { next[p.id] = bulk[p.id] ?? { hi: '', flight: '', autoHC: false, ch: '' } })
    setBulk(next)
  }

  function clearAll() { setBulk({}) }

  const filtered = search.trim()
    ? available.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        `${p.last_name} ${p.first_name}`.toLowerCase().includes(search.toLowerCase())
      )
    : available

  const selected = Object.entries(bulk)
  const allValid = selected.length > 0 && selected.every(([, v]) =>
    !useHandicaps ||
    v.flight === 'guest' ||
    (v.hi !== '' && !isNaN(parseFloat(v.hi)) &&
    (v.autoHC || (v.ch !== '' && !isNaN(parseInt(v.ch, 10)))))
  )

  async function handleSave(e) {
    e.preventDefault()
    if (!allValid) return
    setSaving(true)

    let errorMsg = null
    for (const [playerId, { hi, flight, autoHC, ch }] of selected) {
      let result
      if (flight === 'guest') {
        result = await supabase.from('event_players').insert({
          event_id:                eventId,
          player_id:               playerId,
          is_guest:                true,
          flight:                  null,
          handicap_index:          0,
          adjusted_handicap_index: 0,
        })
      } else if (!useHandicaps) {
        result = await supabase.from('event_players').insert({
          event_id:                eventId,
          player_id:               playerId,
          handicap_index:          0,
          adjusted_handicap_index: 0,
          course_handicap:         0,
          flight:                  flight || null,
        })
      } else {
        const hiVal = parseFloat(hi)
        let course_handicap = null
        if (autoHC && course) {
          const { slope, rating, par } = course
          course_handicap = Math.round((hiVal * slope / 113) + (rating - par))
        } else if (!autoHC && ch !== '') {
          course_handicap = parseInt(ch, 10)
        }
        result = await supabase.from('event_players').insert({
          event_id:                eventId,
          player_id:               playerId,
          handicap_index:          hiVal,
          adjusted_handicap_index: hiVal,
          course_handicap,
          flight:                  flight || null,
        })
      }
      if (result.error) { errorMsg = result.error.message; break }
    }

    setSaving(false)
    if (errorMsg) { toast.error(`Add failed: ${errorMsg}`); return }
    toast.success(`${selected.length} player${selected.length !== 1 ? 's' : ''} added`)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Players to Event" maxWidth="max-w-2xl">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{available.length} players available · {selected.length} selected</p>
          <div className="flex gap-2">
            <button type="button" onClick={selectAll} className="text-xs text-fairway-700 hover:underline font-medium">Select All</button>
            <span className="text-gray-300">|</span>
            <button type="button" onClick={clearAll}  className="text-xs text-gray-500 hover:underline">Clear</button>
          </div>
        </div>

        {available.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">All players from the roster are already on this event.</p>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Sticky search */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-3 py-2">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search players…"
                  className="input py-1.5 pl-8 text-sm"
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">No players match "{search}"</p>
            )}
            {filtered.map(p => {
              const checked = !!bulk[p.id]
              const vals    = bulk[p.id] ?? { hi: '', flight: '' }
              return (
                <div key={p.id} className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${checked ? 'bg-fairway-50' : 'hover:bg-gray-50'}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.id)}
                    className="accent-fairway-600 w-4 h-4 shrink-0"
                  />
                  <span className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">
                    {p.last_name}, {p.first_name}
                  </span>
                  {checked && (
                    <>
                      {/* Flight dropdown — only when flights are enabled */}
                      {useFlights && (
                        <select
                          value={vals.flight}
                          onChange={e => setField(p.id, 'flight', e.target.value)}
                          className="input py-1 text-xs w-28 shrink-0 bg-white"
                        >
                          <option value="">Not Assigned</option>
                          <option value="A">Flight A</option>
                          <option value="B">Flight B</option>
                          <option value="guest">Guest Player</option>
                        </select>
                      )}

                      {/* No-flights: Guest toggle button */}
                      {!useFlights && (
                        <button
                          type="button"
                          onClick={() => setField(p.id, 'flight', vals.flight === 'guest' ? '' : 'guest')}
                          className={`text-xs shrink-0 px-2 py-1 rounded-full font-semibold border ${vals.flight === 'guest' ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                        >
                          Guest
                        </button>
                      )}

                      {/* HI / CH fields — hidden for guest or when handicaps off */}
                      {vals.flight !== 'guest' && useHandicaps && (
                        <>
                          <input
                            type="number" step="0.1" min="-10" max="54"
                            value={vals.hi}
                            onChange={e => setField(p.id, 'hi', e.target.value)}
                            placeholder="HI"
                            className="input py-1 text-xs w-16 shrink-0"
                            required
                          />
                          {vals.autoHC ? (
                            <span
                              className="text-xs text-gray-500 w-16 shrink-0 cursor-pointer hover:text-fairway-700"
                              title="Click to enter manually"
                              onClick={() => setField(p.id, 'autoHC', false)}
                            >
                              CH: {vals.ch !== '' ? vals.ch : '—'}
                            </span>
                          ) : (
                            <input
                              type="number" min="-5" max="54"
                              value={vals.ch}
                              onChange={e => setField(p.id, 'ch', e.target.value)}
                              placeholder="CH"
                              className="input py-1 text-xs w-16 shrink-0"
                              title="Course handicap (manual)"
                              required
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setField(p.id, 'autoHC', !vals.autoHC)}
                            className={`text-xs shrink-0 px-1.5 py-1 rounded font-medium ${vals.autoHC ? 'text-fairway-600 bg-fairway-50' : 'text-orange-600 bg-orange-50'}`}
                            title={vals.autoHC ? 'Auto-calculating CH — click for manual' : 'Manual CH — click for auto'}
                          >
                            {vals.autoHC ? 'Auto' : 'Manual'}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={!allValid}>
            Add {selected.length > 0 ? selected.length : ''} Player{selected.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Tab: Groups ──────────────────────────────────────────────────
// ─── Match Pairings Manager ───────────────────────────────────────
function MatchPairingsManager({ event, eventId, eventPlayers }) {
  const [pairings,    setPairings]    = useState([])
  const [playerAId,   setPlayerAId]   = useState('')
  const [playerBId,   setPlayerBId]   = useState('')
  const [matchNumber, setMatchNumber] = useState(1)
  const [saving,      setSaving]      = useState(false)
  const [teamAName,   setTeamAName]   = useState(event?.ryder_cup_teams?.a ?? '')
  const [teamBName,   setTeamBName]   = useState(event?.ryder_cup_teams?.b ?? '')
  const [savingTeams, setSavingTeams] = useState(false)
  const isRyderCup = (event?.formats ?? []).includes('ryder_cup')

  async function loadPairings() {
    const { data } = await supabase
      .from('match_pairings')
      .select('*, playerA:players!player_a_id(first_name,last_name), playerB:players!player_b_id(first_name,last_name)')
      .eq('event_id', eventId)
      .order('match_number')
    setPairings(data ?? [])
  }

  useEffect(() => { loadPairings() }, [eventId])

  async function saveTeamNames() {
    setSavingTeams(true)
    await supabase.from('events').update({
      ryder_cup_teams: { a: teamAName.trim(), b: teamBName.trim() }
    }).eq('id', eventId)
    setSavingTeams(false)
    toast.success('Team names saved')
  }

  // Players already paired (either as A or B)
  const pairedIds = new Set(pairings.flatMap(p => [p.player_a_id, p.player_b_id]))

  const unpairedPlayers = eventPlayers.filter(ep => !pairedIds.has(ep.player_id))

  async function addPairing() {
    if (!playerAId || !playerBId || playerAId === playerBId) {
      toast.error('Select two different players')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('match_pairings').insert({
      event_id:     eventId,
      player_a_id:  playerAId,
      player_b_id:  playerBId,
      match_number: pairings.length + 1,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setPlayerAId('')
    setPlayerBId('')
    await loadPairings()
  }

  async function deletePairing(id) {
    const { error } = await supabase.from('match_pairings').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    // Renumber remaining pairings sequentially after delete
    const remaining = pairings.filter(p => p.id !== id)
    await Promise.all(remaining.map((p, i) =>
      supabase.from('match_pairings').update({ match_number: i + 1 }).eq('id', p.id)
    ))
    await loadPairings()
  }

  async function renumberAll() {
    await Promise.all(pairings.map((p, i) =>
      supabase.from('match_pairings').update({ match_number: i + 1 }).eq('id', p.id)
    ))
    await loadPairings()
    toast.success('Pairings renumbered')
  }

  function playerName(ep) {
    return `${ep.player?.last_name ?? ''}, ${ep.player?.first_name ?? ''} (CH: ${ep.course_handicap ?? '—'})`
  }

  return (
    <div className="space-y-4">
      {/* Ryder Cup team names */}
      {isRyderCup && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Team Names</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Team A</label>
              <input className="input w-full" value={teamAName} onChange={e => setTeamAName(e.target.value)} placeholder="e.g. USA" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Team B</label>
              <input className="input w-full" value={teamBName} onChange={e => setTeamBName(e.target.value)} placeholder="e.g. Europe" />
            </div>
          </div>
          <button
            type="button"
            onClick={saveTeamNames}
            disabled={savingTeams}
            className="text-sm font-semibold text-white bg-fairway-700 hover:bg-fairway-800 disabled:opacity-50 px-4 py-1.5 rounded-lg"
          >
            {savingTeams ? 'Saving…' : 'Save Team Names'}
          </button>
        </div>
      )}

      {/* Current pairings */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Current Match Pairings</h3>
          {pairings.length > 0 && (
            <button type="button" onClick={renumberAll} className="text-xs text-fairway-700 font-semibold hover:underline">
              Renumber
            </button>
          )}
        </div>
        {pairings.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-400">No pairings assigned yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {pairings.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="text-sm text-gray-800">
                  <span className="font-semibold text-blue-700">
                    {p.playerA?.last_name}, {p.playerA?.first_name}
                  </span>
                  {' '}
                  <span className="text-gray-400">vs</span>
                  {' '}
                  <span className="font-semibold text-purple-700">
                    {p.playerB?.last_name}, {p.playerB?.first_name}
                  </span>
                  <span className="ml-3 text-xs text-gray-400">Match #{p.match_number}</span>
                </div>
                <Button size="sm" variant="danger" onClick={() => deletePairing(p.id)}>Remove</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add pairing form */}
      {eventPlayers.length >= 2 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Add Pairing</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{isRyderCup ? (teamAName || 'Team A') : 'Player A'}</label>
                <select
                  className="input w-full"
                  value={playerAId}
                  onChange={e => setPlayerAId(e.target.value)}
                >
                  <option value="">Select player…</option>
                  {eventPlayers
                    .filter(ep => ep.player_id !== playerBId)
                    .map(ep => (
                      <option key={ep.player_id} value={ep.player_id}>{playerName(ep)}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{isRyderCup ? (teamBName || 'Team B') : 'Player B'}</label>
                <select
                  className="input w-full"
                  value={playerBId}
                  onChange={e => setPlayerBId(e.target.value)}
                >
                  <option value="">Select player…</option>
                  {eventPlayers
                    .filter(ep => ep.player_id !== playerAId)
                    .map(ep => (
                      <option key={ep.player_id} value={ep.player_id}>{playerName(ep)}</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={addPairing} loading={saving} disabled={!playerAId || !playerBId}>
                Add Pairing
              </Button>
            </div>
          </div>
        </div>
      )}
      {unpairedPlayers.length < 2 && pairings.length > 0 && (
        <p className="text-sm text-gray-400 text-center">All players have been paired.</p>
      )}
    </div>
  )
}

// ─── Team Match Setup ─────────────────────────────────────────────
function TeamMatchSetup({ event, eventPlayers, onUpdated }) {
  const cfg = event.team_match_config ?? {}
  const [teamAName, setTeamAName] = useState(cfg.teamA ?? '')
  const [teamBName, setTeamBName] = useState(cfg.teamB ?? '')
  const [sides,     setSides]     = useState(cfg.sides ?? {})
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    const c = event.team_match_config ?? {}
    setTeamAName(c.teamA ?? '')
    setTeamBName(c.teamB ?? '')
    setSides(c.sides ?? {})
  }, [event.team_match_config])

  function setSide(playerId, side) {
    setSides(prev => ({ ...prev, [playerId]: side }))
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('events').update({
      team_match_config: { teamA: teamAName.trim(), teamB: teamBName.trim(), sides },
    }).eq('id', event.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Team match saved'); onUpdated() }
  }

  const unassigned = eventPlayers.filter(ep => !sides[ep.player_id])
  const teamA = eventPlayers.filter(ep => sides[ep.player_id] === 'A')
  const teamB = eventPlayers.filter(ep => sides[ep.player_id] === 'B')

  function playerName(ep) {
    return `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim()
  }

  return (
    <div className="space-y-4">
      {/* Team names */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Team Names</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Team A</label>
            <input className="input w-full" value={teamAName} onChange={e => setTeamAName(e.target.value)} placeholder="e.g. MIGC" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Team B</label>
            <input className="input w-full" value={teamBName} onChange={e => setTeamBName(e.target.value)} placeholder="e.g. Westside Eagles" />
          </div>
        </div>
      </div>

      {/* Player assignments */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Assign Players to Teams</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {eventPlayers.map(ep => {
            const side = sides[ep.player_id]
            return (
              <div key={ep.player_id} className="flex items-center justify-between px-4 py-3">
                <div className="text-sm font-medium text-gray-800">
                  {playerName(ep)}
                  <span className="text-xs text-gray-400 ml-2">CH {ep.course_handicap ?? '—'}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSide(ep.player_id, 'A')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${side === 'A' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}
                  >
                    {teamAName || 'Team A'}
                  </button>
                  <button
                    onClick={() => setSide(ep.player_id, 'B')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${side === 'B' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300'}`}
                  >
                    {teamBName || 'Team B'}
                  </button>
                  {side && (
                    <button onClick={() => setSide(ep.player_id, null)} className="text-xs text-gray-400 hover:text-red-500 px-1">✕</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {unassigned.length > 0 && (
        <p className="text-xs text-amber-600 font-medium">⚠ {unassigned.length} player{unassigned.length !== 1 ? 's' : ''} not yet assigned to a team</p>
      )}

      <Button onClick={handleSave} loading={saving}>Save Team Setup</Button>
    </div>
  )
}

// ─── No-show helpers ─────────────────────────────────────────────
const NO_SHOW_TAG = 'no_show'

function isPlayerNoShow(playerId, allScores) {
  const playerScores = allScores.filter(s => s.player_id === playerId)
  return playerScores.length > 0 && playerScores.every(s => s.entered_by === NO_SHOW_TAG)
}

async function markNoShow(playerId, eventId, course) {
  const pars = course?.par_per_hole ?? Array(18).fill(4)
  const rows = pars.map((par, i) => ({
    event_id: eventId,
    player_id: playerId,
    hole_number: i + 1,
    gross_score: par + 2,
    putts: null,
    entered_by: NO_SHOW_TAG,
  }))
  const { error } = await supabase
    .from('scores')
    .upsert(rows, { onConflict: 'event_id,player_id,hole_number' })
  return error
}

async function clearNoShow(playerId, eventId) {
  const { error } = await supabase
    .from('scores')
    .delete()
    .eq('event_id', eventId)
    .eq('player_id', playerId)
    .eq('entered_by', NO_SHOW_TAG)
  return error
}

function TabGroups({ event, eventPlayers, onUpdated, orgSlug, allScores, course }) {
  const isShotgun    = event?.shotgun_start ?? false
  const [noShowLoading, setNoShowLoading] = useState(null)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  async function handleNoShow(ep) {
    if (!window.confirm(`Mark ${ep.player?.first_name} ${ep.player?.last_name} as a no-show? This will record par+2 for all 18 holes.`)) return
    setNoShowLoading(ep.player_id)
    const error = await markNoShow(ep.player_id, event.id, course)
    setNoShowLoading(null)
    if (error) { toast.error(error.message); return }
    toast.success(`${ep.player?.first_name} marked as no-show`)
    onUpdated()
  }

  async function handleClearNoShow(ep) {
    if (!window.confirm(`Remove no-show for ${ep.player?.first_name} ${ep.player?.last_name}? Their scores will be deleted.`)) return
    setNoShowLoading(ep.player_id)
    const error = await clearNoShow(ep.player_id, event.id)
    setNoShowLoading(null)
    if (error) { toast.error(error.message); return }
    toast.success(`No-show cleared for ${ep.player?.first_name}`)
    onUpdated()
  }

  // Hole assignments: { [groupNum]: holeNum }
  const [holeAssignments, setHoleAssignments] = useState(event?.group_hole_assignments ?? {})

  async function setGroupHole(groupNum, hole) {
    // Store as string e.g. "4A" or "4B" to support two groups per hole
    const next = { ...holeAssignments, [groupNum]: hole || null }
    Object.keys(next).forEach(k => { if (!next[k]) delete next[k] })
    setHoleAssignments(next)
    await supabase.from('events').update({ group_hole_assignments: next }).eq('id', event.id)
  }

  const totalPlayers = eventPlayers.length
  const numGroups    = totalPlayers > 0 ? Math.ceil(totalPlayers / 4) : 1

  // containers: { 'ungrouped': [ep, ...], 'group-0': [ep, ...], 'group-1': [...], ... }
  const [containers, setContainers] = useState({})
  const [activeId, setActiveId]     = useState(null)
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    const byGroup = {}
    const unassigned = []
    for (const ep of eventPlayers) {
      if (ep.group_number) {
        if (!byGroup[ep.group_number]) byGroup[ep.group_number] = []
        byGroup[ep.group_number].push(ep)
      } else {
        unassigned.push(ep)
      }
    }
    Object.values(byGroup).forEach(arr => arr.sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0)))

    const existingMax = Object.keys(byGroup).length > 0 ? Math.max(...Object.keys(byGroup).map(Number)) : 0
    const slots = Math.max(numGroups, existingMax)
    const next = { ungrouped: unassigned.sort(epAlpha) }
    for (let i = 0; i < slots; i++) next[`group-${i}`] = byGroup[i + 1] ?? []
    setContainers(next)
  }, [eventPlayers, numGroups])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function findContainer(id) {
    if (id in containers) return id
    for (const [key, members] of Object.entries(containers)) {
      if (members.some(ep => ep.id === id)) return key
    }
    return null
  }

  function handleDragStart({ active }) { setActiveId(active.id) }

  function handleDragOver({ active, over }) {
    if (!over) return
    const fromKey = findContainer(active.id)
    let toKey = findContainer(over.id)
    if (!toKey) toKey = over.id
    if (!fromKey || !toKey || fromKey === toKey) return

    setContainers(prev => {
      const next = {}
      for (const k of Object.keys(prev)) next[k] = [...prev[k]]

      const movedEp = next[fromKey].find(ep => ep.id === active.id)
      if (!movedEp) return prev
      next[fromKey] = next[fromKey].filter(ep => ep.id !== active.id)

      const overIdx = next[toKey]?.findIndex(ep => ep.id === over.id) ?? -1
      if (overIdx >= 0) {
        next[toKey].splice(overIdx, 0, movedEp)
      } else {
        next[toKey] = [...(next[toKey] ?? []), movedEp]
      }
      return next
    })
  }

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return

    const fromKey = findContainer(active.id)
    let toKey = findContainer(over.id)
    if (!toKey) toKey = over.id

    // Reorder within same container
    if (fromKey === toKey) {
      setContainers(prev => {
        const members = [...(prev[fromKey] ?? [])]
        const from = members.findIndex(ep => ep.id === active.id)
        const to   = members.findIndex(ep => ep.id === over.id)
        if (from === -1 || to === -1 || from === to) return prev
        const next = { ...prev, [fromKey]: arrayMove(members, from, to) }
        persistContainers(next)
        return next
      })
    } else {
      // Cross-container move was handled in onDragOver; persist current state
      persistContainers(containers)
    }
  }

  async function persistContainers(snap) {
    const source = snap ?? containers
    setSaving(true)
    try {
      const updates = []
      for (const [key, members] of Object.entries(source)) {
        const groupNum = key === 'ungrouped' ? null : parseInt(key.replace('group-', ''), 10) + 1
        members.forEach((ep, order) => {
          updates.push(
            supabase.from('event_players')
              .update({ group_number: groupNum, group_order: groupNum ? order : null })
              .eq('id', ep.id)
          )
        })
      }
      await Promise.all(updates)
      onUpdated()
    } catch (err) {
      toast.error('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Derived convenience
  const ungrouped = containers['ungrouped'] ?? []
  const groupKeys = Object.keys(containers).filter(k => k !== 'ungrouped').sort((a, b) => {
    return parseInt(a.replace('group-', ''), 10) - parseInt(b.replace('group-', ''), 10)
  })

  async function toggleScorekeeper(ep) {
    const { error } = await supabase.from('event_players')
      .update({ is_scorekeeper: !ep.is_scorekeeper })
      .eq('id', ep.id)
    if (error) toast.error(error.message)
    else onUpdated()
  }

  const [showAutoAssign, setShowAutoAssign] = useState(false)
  const [autoMethod,     setAutoMethod]     = useState('random')
  const [autoLoading,    setAutoLoading]    = useState(false)

  async function runAutoAssign() {
    setAutoLoading(true)
    try {
      let players = [...eventPlayers]
      if (autoMethod === 'alpha') {
        players.sort(epAlpha)
      } else if (autoMethod === 'handicap_balanced') {
        players.sort((a, b) => (a.course_handicap ?? a.handicap_index ?? 99) - (b.course_handicap ?? b.handicap_index ?? 99))
      } else if (autoMethod === 'handicap_grouped') {
        players.sort((a, b) => (a.course_handicap ?? a.handicap_index ?? 99) - (b.course_handicap ?? b.handicap_index ?? 99))
      } else if (autoMethod === 'by_flight') {
        players.sort((a, b) => {
          const fa = a.flight ?? 'Z', fb = b.flight ?? 'Z'
          if (fa !== fb) return fa < fb ? -1 : 1
          return epAlpha(a, b)
        })
      } else {
        for (let i = players.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [players[i], players[j]] = [players[j], players[i]]
        }
      }

      const ng = Math.ceil(players.length / 4)
      const buckets = Array.from({ length: ng }, () => [])

      if (autoMethod === 'handicap_balanced') {
        players.forEach((ep, idx) => {
          const round = Math.floor(idx / ng)
          const pos   = idx % ng
          const gi    = round % 2 === 0 ? pos : ng - 1 - pos
          buckets[gi].push(ep)
        })
      } else {
        players.forEach((ep, idx) => { buckets[Math.floor(idx / 4)].push(ep) })
      }

      await Promise.all(
        buckets.flatMap((bucket, gi) =>
          bucket.map((ep, order) =>
            supabase.from('event_players').update({ group_number: gi + 1, group_order: order }).eq('id', ep.id)
          )
        )
      )
      // Auto-assign first in each group as scorekeeper
      await Promise.all(
        buckets.map(bucket => bucket[0]
          ? supabase.from('event_players').update({ is_scorekeeper: true }).eq('id', bucket[0].id)
          : Promise.resolve()
        )
      )
      setShowAutoAssign(false)
      onUpdated()
      toast.success(`${players.length} players assigned to ${ng} groups`)
    } catch (err) {
      toast.error('Auto-assign failed: ' + err.message)
    } finally {
      setAutoLoading(false)
    }
  }

  async function clearAllGroups() {
    await Promise.all(
      eventPlayers.map(ep =>
        supabase.from('event_players').update({ group_number: null, group_order: null, is_scorekeeper: false }).eq('id', ep.id)
      )
    )
    onUpdated()
    toast.success('All group assignments cleared')
  }

  function persistGroups() { persistContainers() }

  const AUTO_METHODS = [
    { key: 'random',            label: 'Random',               desc: 'Shuffle all players randomly into groups' },
    { key: 'handicap_balanced', label: 'Balanced by Handicap', desc: 'Snake draft — each group gets a mix of low and high handicaps' },
    { key: 'handicap_grouped',  label: 'Grouped by Handicap',  desc: 'Low handicaps together, high handicaps together' },
    { key: 'by_flight',         label: 'By Flight',            desc: 'Keep Flight A and Flight B players in separate groups' },
    { key: 'alpha',             label: 'Alphabetical',         desc: 'Assign A–Z by first name, filling groups sequentially' },
  ]

  const scorerByGroup = (() => {
    const groupMap = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep.group_number]))
    const map = {}
    for (const s of (allScores ?? [])) {
      if (!s.entered_by) continue
      const g = groupMap[s.player_id]
      if (!g) continue
      if (!map[g]) map[g] = new Set()
      map[g].add(s.entered_by)
    }
    return map
  })()

  const activeEp = activeId ? eventPlayers.find(ep => ep.id === activeId) : null

  return (
    <div className="space-y-4">
      {(event.status === 'active' || (event.status === 'upcoming' && eventPlayers.length > 0 && eventPlayers.every(ep => ep.group_number))) && (
        <Card>
          <CardHeader title="Scoring Access" subtitle="Share with players to enter scores" />
          <AccessCodeSection event={event} eventPlayers={eventPlayers} onUpdated={onUpdated} orgSlug={orgSlug} />
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-600">
          {isMobile ? 'Assign players to groups.' : 'Drag players into groups.'} {numGroups} group{numGroups !== 1 ? 's' : ''} for {totalPlayers} player{totalPlayers !== 1 ? 's' : ''}.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <span className="text-xs text-gray-400">Saving…</span>}
          {eventPlayers.some(ep => ep.group_number) && (
            <Button size="sm" variant="ghost" onClick={clearAllGroups}>Clear All</Button>
          )}
          <Button size="sm" onClick={() => setShowAutoAssign(true)}>⚡ Auto-Assign</Button>
        </div>
      </div>

      {/* Auto-assign modal */}
      {showAutoAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Auto-Assign Groups</h2>
              <p className="text-sm text-gray-500 mt-1">Groups of 4 ({numGroups} groups). This overwrites current assignments.</p>
            </div>
            <div className="space-y-2">
              {AUTO_METHODS.map(m => (
                <label key={m.key} className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${autoMethod === m.key ? 'border-fairway-600 bg-fairway-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="autoMethod" value={m.key} checked={autoMethod === m.key} onChange={() => setAutoMethod(m.key)} className="mt-0.5 accent-fairway-600" />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{m.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setShowAutoAssign(false)}>Cancel</Button>
              <Button className="flex-1" loading={autoLoading} onClick={runAutoAssign}>Assign Groups</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile: dropdown assignment ── */}
      {isMobile && (
        <div className="space-y-2">
          {[...eventPlayers].sort((a, b) => {
            const an = `${a.player?.last_name} ${a.player?.first_name}`
            const bn = `${b.player?.last_name} ${b.player?.first_name}`
            return an.localeCompare(bn)
          }).map(ep => {
            const name = `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim()
            const currentGroup = ep.group_number ?? ''
            return (
              <div key={ep.id} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
                <span className="text-sm font-medium text-gray-800 truncate">{name}</span>
                <select
                  value={currentGroup}
                  onChange={async e => {
                    const val = e.target.value
                    const groupNum = val === '' ? null : parseInt(val, 10)
                    const { error } = await supabase.from('event_players')
                      .update({ group_number: groupNum, group_order: groupNum ? 0 : null })
                      .eq('id', ep.id)
                    if (error) toast.error(error.message)
                    else onUpdated()
                  }}
                  className="input py-1 text-sm w-32 shrink-0 bg-white"
                >
                  <option value="">Unassigned</option>
                  {Array.from({ length: numGroups }, (_, i) => i + 1).map(g => (
                    <option key={g} value={g}>Group {g}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Desktop: drag-and-drop ── */}
      {!isMobile && (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Ungrouped pool */}
        {ungrouped.length > 0 && (
          <DroppableGroup
            id="ungrouped"
            title="Unassigned Players"
            subtitle="Drag into a group below"
            members={ungrouped}
            holeAssignments={holeAssignments}
            isShotgun={false}
            scorerByGroup={{}}
            onToggleSK={toggleScorekeeper}
            allScores={allScores}
            showNoShow={event.status === 'active'}
            noShowLoading={noShowLoading}
            onNoShow={handleNoShow}
            onClearNoShow={handleClearNoShow}
          />
        )}

        {/* Group columns */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupKeys.map(key => {
            const i = parseInt(key.replace('group-', ''), 10)
            const g = i + 1
            const members = containers[key] ?? []
            return (
              <DroppableGroup
                key={key}
                id={key}
                title={`Group ${g}`}
                subtitle={`${members.length} player${members.length !== 1 ? 's' : ''}`}
                members={members}
                holeAssignments={holeAssignments}
                isShotgun={isShotgun}
                scorerByGroup={scorerByGroup}
                groupNum={g}
                onSetGroupHole={setGroupHole}
                onToggleSK={toggleScorekeeper}
                allScores={allScores}
                showNoShow={event.status === 'active'}
                noShowLoading={noShowLoading}
                onNoShow={handleNoShow}
                onClearNoShow={handleClearNoShow}
                onReturnToPool={ep => {
                  setContainers(prev => {
                    const next = {}
                    for (const k of Object.keys(prev)) next[k] = [...prev[k]]
                    next[key] = next[key].filter(m => m.id !== ep.id)
                    next['ungrouped'] = [...next['ungrouped'], ep].sort(epAlpha)
                    persistContainers(next)
                    return next
                  })
                }}
              />
            )
          })}
        </div>

        <DragOverlay>
          {activeEp ? <DragCard ep={activeEp} /> : null}
        </DragOverlay>
      </DndContext>
      )}
    </div>
  )
}

function DroppableGroup({ id, title, subtitle, members, isShotgun, holeAssignments, scorerByGroup, groupNum, onSetGroupHole, onToggleSK, allScores, showNoShow, noShowLoading, onNoShow, onClearNoShow, onReturnToPool }) {
  const { setNodeRef, isOver } = useDroppable({ id })

  const scored = groupNum && scorerByGroup[groupNum] ? [...scorerByGroup[groupNum]].join(', ') : null

  return (
    <div
      ref={setNodeRef}
      className="rounded-xl border-2 transition-colors"
      style={{ borderColor: isOver ? '#1B4332' : '#e5e7eb', background: isOver ? '#f0fdf4' : '#fff', minHeight: 80 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <div className="font-semibold text-gray-900 text-sm">{title}</div>
          <div className="text-xs text-gray-400">{subtitle}</div>
          {scored && <div className="text-xs text-green-700 mt-0.5">Scored by: {scored}</div>}
        </div>
        {isShotgun && groupNum && (
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-400">Hole</label>
            <select value={holeAssignments[groupNum] ?? ''} onChange={e => onSetGroupHole(groupNum, e.target.value)} className="input py-0.5 text-xs w-20 bg-white">
              <option value="">—</option>
              {Array.from({ length: 18 }, (_, i) => i + 1).flatMap(h => [
                <option key={`${h}A`} value={`${h}A`}>Hole {h}A</option>,
                <option key={`${h}B`} value={`${h}B`}>Hole {h}B</option>,
              ])}
            </select>
          </div>
        )}
      </div>

      {/* Sortable members */}
      <SortableContext items={members.map(ep => ep.id)} strategy={verticalListSortingStrategy}>
        <div className="p-2 space-y-1">
          {members.map(ep => (
            <SortablePlayerCard
              key={ep.id}
              ep={ep}
              onToggleSK={onToggleSK}
              isNoShow={isPlayerNoShow(ep.player_id, allScores)}
              showNoShow={showNoShow}
              noShowLoading={noShowLoading === ep.player_id}
              onNoShow={() => onNoShow(ep)}
              onClearNoShow={() => onClearNoShow(ep)}
              onReturnToPool={onReturnToPool ? () => onReturnToPool(ep) : null}
            />
          ))}
          {members.length === 0 && (
            <div className="text-xs text-gray-300 text-center py-4">Drop players here</div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function SortablePlayerCard({ ep, onToggleSK, isNoShow, showNoShow, noShowLoading, onNoShow, onClearNoShow, onReturnToPool }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ep.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${isNoShow ? 'opacity-60 bg-gray-50 border-gray-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
      <div className="flex items-center gap-2">
        <span {...attributes} {...listeners} className="cursor-grab text-gray-300 hover:text-gray-500 select-none" title="Drag to move">
          ⠿
        </span>
        <div>
          <span className="text-sm font-medium text-gray-900">{ep.player?.first_name} {ep.player?.last_name}</span>
          {isNoShow && <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>No Show</span>}
          {ep.flight && !isNoShow && <span className="ml-1"><FlightBadge flight={ep.flight} /></span>}
          {ep.is_scorekeeper && <span className="ml-1 text-xs font-bold text-fairway-700">SK</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {showNoShow && (
          isNoShow ? (
            <button onClick={onClearNoShow} disabled={noShowLoading} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
              {noShowLoading ? '…' : 'Undo'}
            </button>
          ) : (
            <button onClick={onNoShow} disabled={noShowLoading} className="text-xs px-2 py-1 rounded border border-amber-200 text-amber-600 hover:bg-amber-50 disabled:opacity-40">
              {noShowLoading ? '…' : 'No Show'}
            </button>
          )
        )}
        {onReturnToPool && (
          <button onClick={onReturnToPool} title="Return to pool" className="text-gray-300 hover:text-red-400 transition-colors leading-none text-base font-bold px-1">
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

function DragCard({ ep }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '2px solid #1B4332', borderRadius: 8, padding: '6px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', width: 'fit-content' }}>
      <span style={{ color: '#9ca3af' }}>⠿</span>
      {ep.player?.first_name} {ep.player?.last_name}
      {ep.flight && <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: ep.flight === 'A' ? '#dbeafe' : '#ede9fe', color: ep.flight === 'A' ? '#1d4ed8' : '#6d28d9' }}>{ep.flight}</span>}
    </div>
  )
}

// ─── Tab: Payout Config ───────────────────────────────────────────
function TabPayoutConfig({ event, eventPlayers, course, onUpdated }) {
  const [config,         setConfig]         = useState({})
  const [saving,         setSaving]         = useState(false)
  const [ctpHoles,       setCtpHoles]       = useState([])
  const [ctpInput,       setCtpInput]       = useState('')
  const [longDriveHole,  setLongDriveHole]  = useState(event.long_drive_hole ?? '')
  const [payoutBasis,    setPayoutBasis]    = useState(event.payout_basis ?? 'per_player')
  const [fixedTotal,     setFixedTotal]     = useState(event.payout_fixed_total ?? '')

  const nonGuestPlayers = eventPlayers.filter(e => !e.is_guest)
  const totalPlayers = nonGuestPlayers.length
  const numFlights = event.num_flights ?? (event.use_flights ? 2 : 0)
  const hasFlights = numFlights > 0
  // Build flightCounts: { A: n, B: n, C: n, ... }
  const flightLetters = hasFlights
    ? Array.from({ length: numFlights }, (_, i) => String.fromCharCode(65 + i))
    : []
  const flightCounts = {}
  flightLetters.forEach(l => {
    flightCounts[l] = nonGuestPlayers.filter(e => e.flight === l).length
  })

  const hasCtp       = (event.side_game_options ?? []).includes('ctp')
  const hasLongDrive = (event.side_game_options ?? []).some(s => s.startsWith('long_drive'))

  // Rebuild config whenever event setup changes
  const eventConfigKey = [
    event.id,
    (event.formats ?? []).join(','),
    (event.side_game_options ?? []).join(','),
    String(numFlights),
    JSON.stringify(event.payout_places ?? {}),
  ].join('|')

  useEffect(() => {
    const existingConfig = event.payout_config ?? {}
    const existingCtpHoles = hasCtp
      ? Object.keys(existingConfig)
          .filter(k => k.startsWith('ctp_'))
          .map(k => parseInt(k.replace('ctp_', ''), 10))
          .sort((a, b) => a - b)
      : []
    setCtpHoles(existingCtpHoles)

    const keys = activePayoutKeys(event)
    const next = {}
    for (const k of keys) {
      next[k] = existingConfig[k] ?? defaultForKey(k)
    }
    for (const h of existingCtpHoles) {
      next[`ctp_${h}`] = existingConfig[`ctp_${h}`] ?? 0
    }
    setConfig(next)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventConfigKey])

  function setVal(key, val) {
    setConfig(c => ({ ...c, [key]: parseFloat(val) || 0 }))
  }

  function addCtpHole() {
    const h = parseInt(ctpInput, 10)
    if (isNaN(h) || h < 1 || h > 18) { toast.error('Hole must be 1–18'); return }
    if (ctpHoles.includes(h)) { toast.error(`Hole ${h} already added`); return }
    const sorted = [...ctpHoles, h].sort((a, b) => a - b)
    setCtpHoles(sorted)
    setConfig(c => ({ ...c, [`ctp_${h}`]: 0 }))
    setCtpInput('')
  }

  function removeCtpHole(h) {
    setCtpHoles(prev => prev.filter(x => x !== h))
    setConfig(c => { const next = { ...c }; delete next[`ctp_${h}`]; return next })
  }

  async function handleSave() {
    setSaving(true)
    const ldHole = parseInt(longDriveHole, 10)
    const updates = {
      payout_config:       config,
      payout_basis:        payoutBasis,
      payout_fixed_total:  payoutBasis === 'fixed' ? parseFloat(fixedTotal) || 0 : null,
      long_drive_hole:     hasLongDrive && !isNaN(ldHole) && ldHole >= 1 && ldHole <= 18 ? ldHole : null,
    }
    const { error } = await supabase.from('events').update(updates).eq('id', event.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Payout config saved'); onUpdated() }
  }

  function getMultiplier(key) {
    // Full-field keys
    if (key === 'low_putts' || key.startsWith('ctp_') || key === 'skins' || key === 'long_drive') return totalPlayers
    if (!hasFlights && (key.startsWith('18_net_') || key.startsWith('18_gross_') || key.startsWith('f9_') || key.startsWith('b9_'))) return totalPlayers
    // Per-flight: extract letter
    const flMatch = key.match(/(?:skins|long_drive|low_putts|18_net|18_gross|f9|b9)_([a-z])/)
    if (flMatch) {
      const fl = flMatch[1].toUpperCase()
      return flightCounts[fl] ?? Math.round(totalPlayers / (numFlights || 1))
    }
    return totalPlayers
  }

  const totalPot = payoutBasis === 'fixed'
    ? (parseFloat(fixedTotal) || 0)
    : event.entry_fee * totalPlayers

  const totalAllocated = Object.entries(config).reduce((sum, [k, v]) => sum + ((v || 0) * getMultiplier(k)), 0)
  const overBudget     = totalAllocated > totalPot

  // Build rows — each row tagged with its flight letter (null = full field)
  const rows = Object.entries(config).map(([key, val]) => {
    const mult  = getMultiplier(key)
    const total = (val || 0) * mult
    const label = getCategoryLabel(key)
    // Determine flight letter
    const flMatch = hasFlights && key.match(/(?:skins|long_drive|low_putts|18_net|18_gross|f9|b9)_([a-z])(?:_|$)/)
    const flLetter = flMatch ? flMatch[1].toUpperCase() : null
    const isField = !flLetter
    return { key, val, label, isField, flLetter, mult, total }
  })

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="text-sm text-gray-600 space-y-0.5">
        {hasFlights
          ? <p>{flightLetters.map(l => `Flight ${l}: ${flightCounts[l]}`).join(' · ')} · Total: <strong>{totalPlayers} players</strong> · Pot: <strong className="tabular-nums">${totalPot.toFixed(2)}</strong></p>
          : <p>Total: <strong>{totalPlayers} players</strong> · Pot: <strong className="tabular-nums">${totalPot.toFixed(2)}</strong></p>
        }
        <p className={`tabular-nums ${overBudget ? 'text-red-600 font-medium' : 'text-fairway-700 font-medium'}`}>
          Allocated: ${totalAllocated.toFixed(2)}{overBudget ? ' — exceeds pot!' : ` of $${totalPot.toFixed(2)}`}
        </p>
      </div>

      {/* Payout basis */}
      <Card>
        <CardHeader title="Payout Pot" subtitle="How the total prize pool is calculated" />
        <div className="flex gap-6 mt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={payoutBasis === 'per_player'} onChange={() => setPayoutBasis('per_player')} className="accent-fairway-600" />
            <span className="text-sm text-gray-700">Attendance — entry fee × players (<strong>${(event.entry_fee * totalPlayers).toFixed(2)}</strong>)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={payoutBasis === 'fixed'} onChange={() => setPayoutBasis('fixed')} className="accent-fairway-600" />
            <span className="text-sm text-gray-700">Fixed total</span>
          </label>
        </div>
        {payoutBasis === 'fixed' && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-gray-500">Total pot: $</span>
            <input
              type="number" min="0" step="1"
              value={fixedTotal}
              onChange={e => setFixedTotal(e.target.value)}
              className="input py-1 text-sm w-32"
              placeholder="e.g. 500"
            />
          </div>
        )}
      </Card>

      {/* Long Drive hole */}
      {hasLongDrive && <Card>
        <CardHeader title="Long Drive Hole" subtitle="Designate which hole the Long Drive contest is on" />
        <div className="flex items-center gap-3">
          <input
            type="number" min="1" max="18"
            value={longDriveHole}
            onChange={e => setLongDriveHole(e.target.value)}
            placeholder="Hole #"
            className="input py-1 text-sm w-24"
          />
          {longDriveHole && !isNaN(parseInt(longDriveHole)) && (
            <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-1 rounded-full">
              Hole {longDriveHole}
              <button onClick={() => setLongDriveHole('')} className="text-yellow-600 hover:text-yellow-900 ml-0.5">×</button>
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">This hole will be highlighted on exported scorecards.</p>
      </Card>}

      {hasCtp && <Card>
        <CardHeader title="Closest to Pin Holes" subtitle="Add the specific hole numbers for CTP contests at this course" />
        <div className="flex flex-wrap gap-2 mb-3">
          {ctpHoles.map(h => (
            <span key={h} className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full">
              Hole {h}
              <button onClick={() => removeCtpHole(h)} className="text-green-600 hover:text-green-900 ml-0.5">×</button>
            </span>
          ))}
          {ctpHoles.length === 0 && <p className="text-xs text-gray-400">No CTP holes set. Add holes below.</p>}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number" min="1" max="18"
            value={ctpInput}
            onChange={e => setCtpInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCtpHole())}
            placeholder="Hole #"
            className="input py-1 text-sm w-24"
          />
          <Button size="sm" variant="secondary" onClick={addCtpHole}>+ Add Hole</Button>
          {course?.par_per_hole && (
            <button
              className="text-xs text-fairway-600 hover:underline ml-2"
              onClick={() => {
                const par3s = course.par_per_hole
                  .map((p, i) => ({ hole: i+1, par: p }))
                  .filter(h => h.par === 3 && !ctpHoles.includes(h.hole))
                par3s.forEach(h => {
                  setCtpHoles(prev => [...prev, h.hole].sort((a,b) => a-b))
                  setConfig(c => ({ ...c, [`ctp_${h.hole}`]: c[`ctp_${h.hole}`] ?? 0 }))
                })
              }}
            >
              Auto-add par-3s
            </button>
          )}
        </div>
      </Card>}

      <p className="text-xs text-gray-500">
        All values are <strong>$ per player</strong> × player count shown in each section.
      </p>

      {/* Per-flight scoring & side games — one card per flight */}
      {hasFlights && flightLetters.map(fl => {
        const flRows = rows.filter(r => r.flLetter === fl)
        if (flRows.length === 0) return null
        return (
          <Card key={fl} className="overflow-hidden p-0">
            <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100">
              <h3 className="text-xs font-semibold text-blue-700">Flight {fl} ({flightCounts[fl] ?? 0} players)</h3>
            </div>
            <PayoutTable rows={flRows} onChange={setVal} colLabel={`$ per player (Flt ${fl})`} />
          </Card>
        )
      })}

      {/* Full field — no-flight scoring + side games + CTP */}
      {rows.some(r => r.isField) && (
        <Card className="overflow-hidden p-0">
          <div className="px-4 py-2.5 bg-green-50 border-b border-green-100">
            <h3 className="text-xs font-semibold text-green-700">
              {hasFlights ? 'Full Field — Side Games & CTP' : 'All Players'} ({totalPlayers} players)
            </h3>
          </div>
          <PayoutTable rows={rows.filter(r => r.isField)} onChange={setVal} colLabel="$ per player (All)" />
        </Card>
      )}

      {/* Save */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <p className={`text-sm tabular-nums ${overBudget ? 'text-red-600 font-medium' : 'text-fairway-700 font-medium'}`}>
          {overBudget ? `⚠ Over budget by $${(totalAllocated - totalPot).toFixed(2)}` : `$${totalAllocated.toFixed(2)} allocated of $${totalPot.toFixed(2)}`}
        </p>
        <Button onClick={handleSave} loading={saving}>Save Config</Button>
      </div>
    </div>
  )
}

function PayoutTable({ rows, onChange, colLabel }) {
  if (rows.length === 0) return <p className="px-4 py-3 text-xs text-gray-400">None</p>
  const totalPerPlayer = rows.reduce((sum, r) => sum + (r.val || 0), 0)
  const totalPot       = rows.reduce((sum, r) => sum + r.total, 0)
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs font-semibold text-gray-400 border-b border-gray-100">
          <th className="px-4 py-2">Category</th>
          <th className="px-3 py-2 w-36">{colLabel}</th>
          <th className="px-3 py-2 w-24">× Players</th>
          <th className="px-3 py-2 w-24 text-right">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map(({ key, val, label, mult, total }) => (
          <tr key={key}>
            <td className="px-4 py-2 text-gray-700 text-xs">{label}</td>
            <td className="px-3 py-2">
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs">$</span>
                <input
                  type="number"
                  value={val}
                  onChange={e => onChange(key, e.target.value)}
                  className="input py-1 text-xs w-20 text-right"
                  min="0" step="1"
                />
              </div>
            </td>
            <td className="px-3 py-2 text-xs text-gray-400 tabular-nums">× {mult}</td>
            <td className="px-3 py-2 text-xs font-semibold text-gray-800 text-right tabular-nums">${total.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">
          <td className="px-4 py-2">Total</td>
          <td className="px-3 py-2 tabular-nums">${totalPerPlayer.toFixed(2)} / player</td>
          <td className="px-3 py-2" />
          <td className="px-3 py-2 text-right tabular-nums">${totalPot.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

// ─── Tab: Side Games ──────────────────────────────────────────────
function BlindPartnersCard({ event, eventPlayers, optedInIds = [], onUpdated }) {
  const drawPool = optedInIds.length > 0
    ? eventPlayers.filter(ep => optedInIds.includes(ep.player_id))
    : eventPlayers

  // Restore previously drawn pairs from DB
  const savedPairs = event.side_game_entries?.blind_partner_pairs ?? []
  const [pairs, setPairs]     = useState(savedPairs)
  const [saving, setSaving]   = useState(false)

  async function drawPartners() {
    const ids      = drawPool.map(ep => ep.player_id)
    const shuffled = [...ids].sort(() => Math.random() - 0.5)
    const newPairs = []
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      newPairs.push({ p1: shuffled[i], p2: shuffled[i + 1] })
    }
    if (shuffled.length % 2 !== 0) {
      newPairs.push({ p1: shuffled[shuffled.length - 1], p2: null })
    }
    setPairs(newPairs)
    setSaving(true)
    const prev = event.side_game_entries ?? {}
    await supabase.from('events').update({
      side_game_entries: { ...prev, blind_partner_pairs: newPairs }
    }).eq('id', event.id)
    setSaving(false)
    onUpdated?.()
  }

  function playerName(id) {
    const ep = eventPlayers.find(e => e.player_id === id)
    const p  = ep?.player ?? {}
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
  }

  const canDraw = drawPool.length >= 2

  return (
    <Card>
      <CardHeader title="Blind Partners" subtitle="Opted-in players are auto-selected — draw to assign pairs. Results appear on the leaderboard." />
      <div className="space-y-4">
        {/* Opted-in players */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Entrants ({drawPool.length})
          </div>
          {drawPool.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No players have opted in yet. Add them in the Opt-in Rosters section above.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1 mb-3">
              {drawPool.map(ep => {
                const p    = ep.player ?? {}
                const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
                return (
                  <div key={ep.player_id} className="text-sm text-gray-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-fairway-600 inline-block" />
                    {name}
                  </div>
                )
              })}
            </div>
          )}
          <button
            type="button"
            disabled={!canDraw}
            onClick={drawPartners}
            className="text-sm font-semibold text-white bg-fairway-700 hover:bg-fairway-800 disabled:opacity-50 px-4 py-1.5 rounded-lg"
          >
            🎲 {pairs.length > 0 ? 'Redraw Partners' : 'Draw Partners'}
          </button>
          {saving && <span className="ml-3 text-xs text-gray-400">Saving…</span>}
        </div>

        {/* Drawn pairs */}
        {pairs.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Drawn Pairs</div>
            <div className="space-y-1.5">
              {pairs.map((pair, i) => (
                <div key={i} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-1.5">
                  <span className="font-medium text-fairway-700">Pair {i + 1}:</span>{' '}
                  {playerName(pair.p1)} &amp; {pair.p2 ? playerName(pair.p2) : <span className="text-gray-400 italic">no partner (odd number)</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Combined net scores are ranked on the Blind Partners leaderboard tab.</p>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Tab: Side Games (opt-ins + draw + winner entry) ─────────────────────────
function TabSideGamesMain({ event, eventPlayers, course, sideGames, onUpdated }) {
  const sides   = event.side_game_options ?? []
  const buyIns  = event.side_game_buy_ins ?? {}
  const hasSideGames = sides.length > 0 || (event.custom_competitions ?? []).some(c => c?.trim())

  // Derive unique base keys from side_game_options
  const baseKeys = [...new Set(sides.map(s => {
    const m = s.match(/^(.+)_([a-z])$/)
    return (m && PER_FLIGHT_GAME_KEYS.has(m[1])) ? m[1] : s
  }))]

  // Show opt-ins for any of these games when configured — no buy-in toggle required
  const OPT_IN_GAME_KEYS = new Set(['super_ctp', 'super_skins', 'blind_partners'])
  const optInGames = baseKeys.filter(k => OPT_IN_GAME_KEYS.has(k))
  // Legacy: also include any games where admin explicitly enabled buy-in
  const buyInGames = [...new Set([...optInGames, ...baseKeys.filter(k => buyIns[k]?.enabled)])]

  // Opt-in entries state (synced to DB)
  const [entries,  setEntries]  = useState(event.side_game_entries ?? {})
  const [savingEn, setSavingEn] = useState(false)
  // Keep local state in sync when parent re-fetches event
  useEffect(() => { setEntries(event.side_game_entries ?? {}) }, [event.side_game_entries])

  // Super CTP designated hole (editable inline)
  const allPar3sMain = (course?.par_per_hole ?? [])
    .map((par, i) => ({ hole: i + 1, par }))
    .filter(h => h.par === 3)
  const [superCtpHole, setSuperCtpHole] = useState(event.super_ctp_hole ?? '')
  async function saveCtpHole(val) {
    const num = val ? parseInt(val, 10) : null
    setSuperCtpHole(val)
    await supabase.from('events').update({ super_ctp_hole: num }).eq('id', event.id)
    onUpdated?.()
  }

  async function persistEntries(next) {
    setSavingEn(true)
    await supabase.from('events').update({ side_game_entries: next }).eq('id', event.id)
    setSavingEn(false)
    onUpdated?.()
  }

  function toggleEntry(gameKey, playerId) {
    setEntries(prev => {
      const cur  = prev[gameKey] ?? []
      const next = cur.includes(playerId) ? cur.filter(id => id !== playerId) : [...cur, playerId]
      const updated = { ...prev, [gameKey]: next }
      persistEntries(updated)
      return updated
    })
  }

  function gameLabel(key) {
    const MAP = {
      skins: 'Skins', super_skins: 'Super Skins', long_drive: 'Long Drive',
      low_putts: 'Low Putts', ctp: 'Closest to Pin', super_ctp: 'Super CTP',
      blind_partners: 'Blind Partners',
    }
    return MAP[key] ?? key
  }

  if (!hasSideGames) {
    return (
      <div className="text-sm text-gray-400 py-8 text-center">
        No side games configured for this event.<br />
        <span className="text-xs">Add side games via the <strong>Edit Event</strong> button (pencil icon), then come back here.</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Opt-in rosters ───────────────────────────────────────── */}
      {buyInGames.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Opt-in Rosters</h3>
          <div className="space-y-4">
            {buyInGames.map(key => {
              const opted  = entries[key] ?? []
              const amount = buyIns[key]?.amount ?? null
              const pot    = amount != null ? opted.length * amount : null
              return (
                <Card key={key}>
                  <div className="flex items-center justify-between mb-3">
                    <CardHeader title={gameLabel(key)} subtitle={amount != null ? `$${amount} buy-in per player` : 'Separate buy-in'} />
                    {pot != null && (
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Pot</div>
                        <div className="text-lg font-bold text-green-700">${pot.toFixed(2)}</div>
                        <div className="text-xs text-gray-400">{opted.length} entrant{opted.length !== 1 ? 's' : ''}</div>
                      </div>
                    )}
                  </div>
                  {key === 'super_ctp' && (
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Designated Hole</label>
                      <select
                        value={superCtpHole}
                        onChange={e => saveCtpHole(e.target.value)}
                        className="input bg-white text-sm"
                      >
                        <option value="">— Select a par 3 hole —</option>
                        {allPar3sMain.map(h => (
                          <option key={h.hole} value={h.hole}>Hole {h.hole} (Par 3)</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    {eventPlayers.map(ep => {
                      const pid  = ep.player_id
                      const p    = ep.player ?? {}
                      const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
                      return (
                        <label key={pid} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={opted.includes(pid)}
                            onChange={() => toggleEntry(key, pid)}
                            className="accent-fairway-600 w-4 h-4"
                          />
                          {name}
                        </label>
                      )
                    })}
                  </div>
                  {savingEn && <p className="text-xs text-gray-400 mt-2">Saving…</p>}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Winner entry ─────────────────────────────────────────── */}
      {hasSideGames && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Winner Entry</h3>
          <TabSideGames
            event={event}
            eventPlayers={eventPlayers}
            course={course}
            sideGames={sideGames}
            sideGameEntries={entries}
            onUpdated={onUpdated}
          />
        </div>
      )}
    </div>
  )
}

function TabSideGames({ event, eventPlayers, course, sideGames, sideGameEntries = {}, onUpdated }) {
  // Only show CTP holes that were explicitly configured in Payout Config
  const ctpConfigHoles = Object.keys(event.payout_config ?? {})
    .filter(k => k.startsWith('ctp_'))
    .map(k => parseInt(k.replace('ctp_', ''), 10))
    .sort((a, b) => a - b)

  const par3Holes = ctpConfigHoles.map(h => ({ hole: h }))

  // Super CTP: all par 3s available to select from; admin designates one hole
  const allPar3s = (course?.par_per_hole ?? [])
    .map((p, i) => ({ hole: i + 1, par: p }))
    .filter(h => h.par === 3)
  const superCtpDesignatedHole = event.super_ctp_hole ?? null

  const flightA = eventPlayers.filter(ep => ep.flight === 'A')
  const flightB = eventPlayers.filter(ep => ep.flight === 'B')

  async function setWinner(gameType, holeNumber, playerId, flight) {
    const resolvedId = playerId === 'NO_WINNER' ? null : (playerId || null)
    playerId = resolvedId
    const existing = sideGames.find(
      g => g.game_type === gameType
        && g.hole_number === (holeNumber ?? null)
        && (flight ? g.flight === flight : true)
    )
    if (existing) {
      const { error } = await supabase.from('side_games')
        .update({ winner_player_id: playerId || null })
        .eq('id', existing.id)
      if (error) toast.error(error.message)
      else onUpdated()
    } else {
      const { error } = await supabase.from('side_games').insert({
        event_id:         event.id,
        game_type:        gameType,
        hole_number:      holeNumber ?? null,
        winner_player_id: playerId || null,
        flight:           flight ?? 'overall',
      })
      if (error) toast.error(error.message)
      else onUpdated()
    }
  }

  function getWinner(gameType, holeNumber, flight) {
    const record = sideGames.find(g =>
      g.game_type === gameType
      && g.hole_number === (holeNumber ?? null)
      && (flight ? g.flight === flight : true)
    )
    if (!record) return ''
    return record.winner_player_id ?? 'NO_WINNER'
  }

  const sides      = event.side_game_options ?? []
  const useFlights = event.use_flights ?? false
  const hasLdA     = sides.includes('long_drive_a')
  const hasLdB     = sides.includes('long_drive_b')
  const hasLd      = sides.includes('long_drive')
  const hasCtp      = sides.some(s => s === 'ctp' || s.startsWith('ctp_'))
  const hasSuperCtp = sides.some(s => s === 'super_ctp' || s.startsWith('super_ctp_'))
  const hasBlindPartners = sides.includes('blind_partners')
  const hasSuperSkins    = sides.some(s => s === 'super_skins' || s.startsWith('super_skins_'))

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Enter manual side game winners.</p>

      {/* Long Drive */}
      {(hasLd || hasLdA || hasLdB) && (
        <Card>
          <CardHeader title="Long Drive" />
          <div className="space-y-3">
            {hasLd && (
              <SideGameSelect
                players={eventPlayers}
                value={getWinner('long_drive', null, 'overall')}
                onChange={v => setWinner('long_drive', null, v, 'overall')}
              />
            )}
            {hasLdA && (
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-blue-600 w-16">Flight A</span>
                <SideGameSelect
                  players={flightA.length ? flightA : eventPlayers}
                  value={getWinner('long_drive', null, 'A')}
                  onChange={v => setWinner('long_drive', null, v, 'A')}
                />
              </div>
            )}
            {hasLdB && (
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-purple-600 w-16">Flight B</span>
                <SideGameSelect
                  players={flightB.length ? flightB : eventPlayers}
                  value={getWinner('long_drive', null, 'B')}
                  onChange={v => setWinner('long_drive', null, v, 'B')}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* CTP per par-3 */}
      {hasCtp && par3Holes.length > 0 && (() => {
        const hasCtpA = sides.includes('ctp_a')
        const hasCtpB = sides.includes('ctp_b')
        const perFlight = hasCtpA || hasCtpB
        return (
          <Card>
            <CardHeader title="Closest to Pin" subtitle="One winner per par-3 hole" />
            <div className="space-y-4">
              {par3Holes.map(h => (
                <div key={h.hole}>
                  <div className="text-xs font-semibold text-gray-500 mb-2">Hole {h.hole}</div>
                  {perFlight ? (
                    <div className="space-y-2">
                      {hasCtpA && (
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-semibold text-blue-600 w-16">Flight A</span>
                          <SideGameSelect
                            players={flightA.length ? flightA : eventPlayers}
                            value={getWinner('ctp', h.hole, 'A')}
                            onChange={v => setWinner('ctp', h.hole, v, 'A')}
                          />
                        </div>
                      )}
                      {hasCtpB && (
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-semibold text-purple-600 w-16">Flight B</span>
                          <SideGameSelect
                            players={flightB.length ? flightB : eventPlayers}
                            value={getWinner('ctp', h.hole, 'B')}
                            onChange={v => setWinner('ctp', h.hole, v, 'B')}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <SideGameSelect
                      players={eventPlayers}
                      value={getWinner('ctp', h.hole, 'overall')}
                      onChange={v => setWinner('ctp', h.hole, v, 'overall')}
                    />
                  )}
                </div>
              ))}
            </div>
          </Card>
        )
      })()}

      {/* Super CTP — single designated hole */}
      {hasSuperCtp && (() => {
        const hasSuperCtpA = sides.includes('super_ctp_a')
        const hasSuperCtpB = sides.includes('super_ctp_b')
        const perFlight = hasSuperCtpA || hasSuperCtpB
        const holeLabel = superCtpDesignatedHole ? `Hole ${superCtpDesignatedHole}` : 'No hole designated'
        const optedInIds = sideGameEntries.super_ctp ?? []
        const ctpPool = optedInIds.length > 0
          ? eventPlayers.filter(ep => optedInIds.includes(ep.player_id))
          : eventPlayers
        return (
          <Card>
            <CardHeader title="Super CTP" subtitle={holeLabel} />
            <div className="space-y-3">
              {perFlight ? (
                <div className="space-y-2">
                  {hasSuperCtpA && (
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-semibold text-blue-600 w-16">Flight A</span>
                      <SideGameSelect
                        players={ctpPool.filter(ep => !ep.flight || ep.flight === 'A')}
                        value={getWinner('super_ctp', superCtpDesignatedHole, 'A')}
                        onChange={v => setWinner('super_ctp', superCtpDesignatedHole, v, 'A')}
                      />
                    </div>
                  )}
                  {hasSuperCtpB && (
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-semibold text-purple-600 w-16">Flight B</span>
                      <SideGameSelect
                        players={ctpPool.filter(ep => !ep.flight || ep.flight === 'B')}
                        value={getWinner('super_ctp', superCtpDesignatedHole, 'B')}
                        onChange={v => setWinner('super_ctp', superCtpDesignatedHole, v, 'B')}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <SideGameSelect
                  players={ctpPool}
                  value={getWinner('super_ctp', superCtpDesignatedHole, 'overall')}
                  onChange={v => setWinner('super_ctp', superCtpDesignatedHole, v, 'overall')}
                />
              )}
            </div>
          </Card>
        )
      })()}

      {/* Blind Partners */}
      {hasBlindPartners && (
        <BlindPartnersCard
          event={event}
          eventPlayers={eventPlayers}
          optedInIds={sideGameEntries.blind_partners ?? []}
          onUpdated={onUpdated}
        />
      )}

      {/* Super Skins */}
      {hasSuperSkins && (
        <Card>
          <CardHeader title="Super Skins" subtitle="Separate entry — results auto-computed from scoring" />
          <p className="text-sm text-gray-500 py-2">Super Skins runs on the same scoring data as Skins. Winners are determined automatically once all scores are entered.</p>
        </Card>
      )}

      {/* Custom competitions */}
      {(event.custom_competitions ?? []).filter(c => c?.trim()).map((name, i) => (
        <Card key={i}>
          <CardHeader title={name} />
          <SideGameSelect
            players={eventPlayers}
            value={getWinner(`custom_${i}`, null, 'overall')}
            onChange={v => setWinner(`custom_${i}`, null, v, 'overall')}
          />
        </Card>
      ))}
    </div>
  )
}

function SideGameSelect({ players, value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input bg-white max-w-xs"
    >
      <option value="">— Select winner —</option>
      <option value="NO_WINNER">No Winner</option>
      {players.map(ep => (
        <option key={ep.player_id} value={ep.player_id}>
          {ep.player?.first_name} {ep.player?.last_name}
          {ep.flight ? ` (Flight ${ep.flight})` : ''}
        </option>
      ))}
    </select>
  )
}

// ─── Tab: Payout Summary ──────────────────────────────────────────
function TabPayoutSummary({ event, eventPlayers, allScores, sideGames, course }) {
  if (!course || eventPlayers.length === 0) {
    return <p className="text-sm text-gray-500">No data available yet.</p>
  }

  const nonGuestEPs   = eventPlayers.filter(ep => !ep.is_guest)
  const flightCounts  = {}
  nonGuestEPs.forEach(ep => { if (ep.flight) flightCounts[ep.flight] = (flightCounts[ep.flight] ?? 0) + 1 })
  const leaderboards  = computeLeaderboards(nonGuestEPs, allScores, course)
  const skinsResults  = computeAllSkins(nonGuestEPs, allScores, course)
  const { totalPot, byCategory, byPlayer, totalAllocated } = computePayouts(
    event, nonGuestEPs.length, leaderboards, sideGames, skinsResults, flightCounts
  )

  const playerMap = Object.fromEntries(
    eventPlayers.map(ep => [ep.player_id, ep.player])
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-gray-900">Total Pot: ${totalPot.toFixed(2)}</p>
          <p className="text-sm text-gray-500">{nonGuestEPs.length} players × ${event.entry_fee}</p>
        </div>
      </div>

      {/* By player */}
      <Card className="overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-800 text-sm">Payouts by Player</h3>
        </div>
        {byPlayer.length === 0
          ? <p className="px-5 py-4 text-sm text-gray-400">No payouts resolved yet.</p>
          : (
          <div className="divide-y divide-gray-100">
            {byPlayer.map(({ playerId, total, items }) => {
              const p = playerMap[playerId]
              return (
                <div key={playerId} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-900">
                      {p ? `${p.last_name}, ${p.first_name}` : playerId}
                    </span>
                    <span className="font-bold text-fairway-700">${total.toFixed(2)}</span>
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
        )}
      </Card>

      {/* By category */}
      <Card className="overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-800 text-sm">Payouts by Category</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {byCategory.map(cat => {
            const p = cat.playerId ? playerMap[cat.playerId] : null
            return (
              <div key={cat.key} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <div className="text-sm text-gray-700">{cat.label}</div>
                  <div className="text-xs text-gray-400">
                    {p ? `${p.last_name}, ${p.first_name}` : '— Unresolved'}
                  </div>
                </div>
                <span className="font-semibold text-sm text-gray-900">${cat.amount.toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// ─── Event Status Control ─────────────────────────────────────────
function EventStatusControl({ event, onUpdated }) {
  const [saving, setSaving] = useState(false)

  async function setStatus(next, msg) {
    if (!confirm(msg)) return
    setSaving(true)
    const { error } = await supabase.from('events').update({ status: next }).eq('id', event.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success(`Event set to ${next}`); onUpdated() }
  }

  if (event.status === 'upcoming') {
    return (
      <Button onClick={() => setStatus('active', 'Activate this event? Scorekeepers will be able to enter scores.')} loading={saving} variant="primary">
        ▶ Activate Event
      </Button>
    )
  }

  if (event.status === 'active') {
    return (
      <Button onClick={() => setStatus('complete', 'Close this event? Results will be locked.')} loading={saving} variant="danger">
        ⏹ Close Event
      </Button>
    )
  }

  if (event.status === 'complete') {
    return (
      <Button onClick={() => setStatus('active', 'Re-open this event? Status will return to Active and scores can be edited.')} loading={saving} variant="secondary">
        ↩ Re-open Event
      </Button>
    )
  }

  return null
}

// ─── Edit Event Modal ──────────────────────────────────────────────

// Format keys that support per-flight scoring
const PER_FLIGHT_FORMAT_KEYS = new Set(['net_stroke', 'net_stroke_front9', 'net_stroke_back9', 'low_gross', 'gross_stroke_front9', 'gross_stroke_back9'])

/** Expand formats + formatScope into the formats array saved to DB */
function buildFormatsArray(enabledFormats, formatScope, numFlights) {
  const result = []
  const letters = Array.from({ length: numFlights }, (_, i) => String.fromCharCode(65 + i))
  for (const fmt of enabledFormats) {
    if (numFlights > 0 && PER_FLIGHT_FORMAT_KEYS.has(fmt) && (formatScope[fmt] ?? 'flight') === 'flight') {
      letters.forEach(l => result.push(`${fmt}_${l.toLowerCase()}`))
    } else {
      result.push(fmt)
    }
  }
  return result
}

/** Parse saved formats array back into { formats: Set, formatScope: {} } */
function parseFormatsArray(arr) {
  const fmts = new Set()
  const scope = {}
  for (const f of arr ?? []) {
    const m = f.match(/^(.+)_([a-z])$/)
    if (m && PER_FLIGHT_FORMAT_KEYS.has(m[1])) {
      fmts.add(m[1]); scope[m[1]] = 'flight'
    } else {
      fmts.add(f)
    }
  }
  return { formats: fmts, formatScope: scope }
}

const EDIT_FORMAT_OPTIONS = [
  { group: 'Net Stroke Play', options: [
    { value: 'net_stroke',        label: 'Net — Overall (18)', tip: 'All 18 holes. Net score = gross minus course handicap. Lowest net wins.' },
    { value: 'net_stroke_front9', label: 'Net — Front 9',      tip: 'Holes 1–9 only. Net calculated using half the course handicap.' },
    { value: 'net_stroke_back9',  label: 'Net — Back 9',       tip: 'Holes 10–18 only. Net calculated using half the course handicap.' },
  ]},
  { group: 'Gross Stroke Play', options: [
    { value: 'low_gross',           label: 'Gross — Overall (18)', tip: 'No handicap applied. Lowest raw gross score wins.' },
    { value: 'gross_stroke_front9', label: 'Gross — Front 9',      tip: 'Holes 1–9 only, no handicap applied.' },
    { value: 'gross_stroke_back9',  label: 'Gross — Back 9',       tip: 'Holes 10–18 only, no handicap applied.' },
  ]},
  { group: 'Nassau', options: [
    { value: 'net_stroke_nassau', label: 'Nassau', tip: 'Three separate bets: Front 9, Back 9, and Full 18 net — each scored and paid independently.' },
  ]},
  { group: 'Stableford', options: [
    { value: 'stableford',       label: 'Stableford — Net',   tip: 'Points per hole vs par using net score. Double bogey = 0, Bogey = 1, Par = 2, Birdie = 3, Eagle = 4. Highest points wins.' },
    { value: 'stableford_gross', label: 'Stableford — Gross', tip: 'Same Stableford points but based on raw gross score — no handicap applied.' },
  ]},
  { group: 'Team Formats', options: [
    { value: 'best_ball_2', label: 'Best Ball — 2 Person', tip: 'Each player plays their own ball; team records the lowest net score on each hole.' },
    { value: 'best_ball_4', label: 'Best Ball — 4 Person', tip: 'Each player plays their own ball; team records the lowest net score on each hole. 4-person teams.' },
    { value: 'scramble',    label: 'Scramble',             tip: 'Everyone tees off, choose the best shot, all play from that spot until holed. One team score per hole.' },
    { value: 'shamble',     label: 'Shamble',              tip: 'Best drive selected, then each player plays their own ball into the hole from that spot.' },
  ]},
  { group: 'Match Play', options: [
    { value: 'match_points',    label: 'Individual Match Play', tip: 'Players are paired by handicap. Win a hole = 1 UP, tie = halved, lose = 1 DOWN. Match ends when lead exceeds holes remaining.' },
    { value: 'ryder_cup',       label: 'Ryder Cup / Team Cup',  tip: 'Flight A vs Flight B team match. Pairs compete hole-by-hole; flight aggregate points determine the winner.' },
    { value: 'team_match_play', label: 'Best Ball Match Play',  tip: 'Groups of 4 split into 2-person teams. Best net score per team per hole. Team with most holes won wins the match.' },
  ]},
]


function EditEventModal({ open, onClose, event, onSaved }) {
  const [eventDate,     setEventDate]     = useState('')
  const [eventName,     setEventName]     = useState('')
  const [eventNumber,   setEventNumber]   = useState('')
  const [entryFee,      setEntryFee]      = useState('')
  const [tournamentFee, setTournamentFee] = useState('')
  const [venmoHandle,   setVenmoHandle]   = useState('')
  const [paypalLink,    setPaypalLink]    = useState('')
  const [startTime,   setStartTime]   = useState('')
  const [interval,    setInterval]    = useState(10)
  const [formats,      setFormats]      = useState(new Set(['net_stroke']))
  const [formatScope,  setFormatScope]  = useState({})   // { format_key: 'flight'|'group' }
  const [payoutPlaces, setPayoutPlaces] = useState({})
  const [sideGames,    setSideGames]    = useState(new Set())
  const [gameScope,    setGameScope]    = useState({})
  const [numFlights,   setNumFlights]   = useState(0)
  const [shotgunStart, setShotgunStart] = useState(false)
  const [payoutBasis,  setPayoutBasis]  = useState('per_player')
  const [payoutFixed,  setPayoutFixed]  = useState('')
  const [zelleHandle,     setZelleHandle]     = useState('')
  const [customCompetitions, setCustomCompetitions] = useState([])
  const [customQuestions, setCustomQuestions] = useState([{ label: '', required: false }])
  const [scheduleItems,   setScheduleItems]   = useState([])
  const [courseId,     setCourseId]     = useState('')
  const [courses,      setCourses]      = useState([])
  const [holesPlayed,  setHolesPlayed]  = useState(18)
  const [useHandicaps, setUseHandicaps] = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [sideGameBuyIns, setSideGameBuyIns] = useState({})

  useEffect(() => {
    if (event && open) {
      setEventDate(event.event_date ?? '')
      setEventName(event.name ?? '')
      setEventNumber(event.event_number ?? '')
      setEntryFee(event.entry_fee ?? '')
      setTournamentFee(event.tournament_fee ?? '')
      setVenmoHandle(event.venmo_handle ?? '')
      setPaypalLink(event.paypal_link ?? '')
      setZelleHandle(event.zelle_handle ?? '')
      setCustomCompetitions(event.custom_competitions ?? [])
      setCustomQuestions(event.custom_questions?.length
        ? event.custom_questions
        : [{ label: '', required: false }])
      setScheduleItems(event.schedule_items ?? [])
      setStartTime(event.start_time ? event.start_time.slice(0, 5) : '')
      setInterval(event.tee_time_interval_mins ?? 10)
      const parsedFmts = parseFormatsArray(event.formats?.length ? event.formats : [event.format ?? 'net_stroke'])
      setFormats(parsedFmts.formats)
      setFormatScope(parsedFmts.formatScope)
      setPayoutPlaces(event.payout_places ?? {})
      const parsed = parseSideGameOptions(event.side_game_options)
      setSideGames(parsed.games)
      setGameScope(parsed.scope)
      setNumFlights(event.num_flights ?? (event.use_flights ? 2 : 0))
      setShotgunStart(event.shotgun_start ?? false)
      setPayoutBasis(event.payout_basis ?? 'per_player')
      setPayoutFixed(event.payout_fixed_total ?? '')
      setCourseId(event.course_id ?? '')
      setHolesPlayed(event.holes_played ?? 18)
      setUseHandicaps(event.use_handicaps ?? true)
      setSideGameBuyIns(event.side_game_buy_ins ?? {})
    }
  }, [event, open])

  useEffect(() => {
    if (!open) return
    supabase.from('courses').select('id, name').order('name').then(({ data }) => setCourses(data ?? []))
  }, [open])

  function toggleFormat(key) {
    setFormats(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function toggleSideGame(key) {
    setSideGames(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function toggleBuyIn(key) {
    setSideGameBuyIns(prev => ({ ...prev, [key]: { ...prev[key], enabled: !(prev[key]?.enabled) } }))
  }
  function setBuyInAmount(key, val) {
    setSideGameBuyIns(prev => ({ ...prev, [key]: { ...prev[key], amount: val } }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (formats.size === 0) return
    setSaving(true)
    const formatsArr = buildFormatsArray(formats, formatScope, numFlights)
    const { error } = await supabase.from('events')
      .update({
        event_date:             eventDate,
        name:                   eventName.trim() || null,
        event_number:           parseInt(eventNumber, 10),
        entry_fee:              Math.round(parseFloat(entryFee) * 100) / 100,
        tournament_fee:         tournamentFee !== '' ? Math.round(parseFloat(tournamentFee) * 100) / 100 : null,
        start_time:             startTime || null,
        tee_time_interval_mins: parseInt(interval, 10),
        format:                 formatsArr[0]?.replace(/_[a-z]$/, '') ?? formatsArr[0],
        formats:                formatsArr,
        side_game_options:      buildSideGameOptions(sideGames, gameScope, numFlights),
        payout_places:          Object.keys(payoutPlaces).length > 0 ? payoutPlaces : null,
        use_flights:            numFlights > 0,
        num_flights:            numFlights > 0 ? numFlights : null,
        shotgun_start:          shotgunStart,
        payout_basis:           payoutBasis,
        payout_fixed_total:     payoutBasis === 'fixed' ? parseFloat(payoutFixed) || 0 : null,
        venmo_handle:           venmoHandle.trim().replace(/^@/, '') || null,
        paypal_link:            paypalLink.trim() || null,
        zelle_handle:           zelleHandle.trim() || null,
        custom_questions:       customQuestions.filter(q => q.label.trim()),
        custom_competitions:    customCompetitions.filter(c => c.trim()),
        schedule_items:         scheduleItems.filter(s => s.label.trim()),
        course_id:              courseId || null,
        holes_played:           holesPlayed,
        use_handicaps:          useHandicaps,
        side_game_buy_ins:      Object.fromEntries(
          Object.entries(sideGameBuyIns)
            .filter(([k, v]) => sideGames.has(k) && v?.enabled)
            .map(([k, v]) => [k, { enabled: true, amount: v.amount !== '' && v.amount != null ? parseFloat(v.amount) : null }])
        ),
      })
      .eq('id', event.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Event updated'); onSaved(); onClose() }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Event" maxWidth="max-w-lg">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Date" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
          <Input label="Start Time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
        </div>
        <div>
          <label className="label">Course</label>
          <select className="input w-full" value={courseId} onChange={e => setCourseId(e.target.value)}>
            <option value="">— Select course —</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Event Name (optional)" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. Spring Opener…" />
          <Input label="Event #" type="number" min="1" value={eventNumber} onChange={e => setEventNumber(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Entry Fee ($)" type="number" step="0.01" min="0" value={entryFee} onChange={e => setEntryFee(e.target.value)} required />
          <Input label="Tournament Entry Fee ($)" type="number" step="0.01" min="0" value={tournamentFee} onChange={e => setTournamentFee(e.target.value)} placeholder="Charged at registration" />
        </div>
        <p className="text-xs text-gray-400 -mt-2">Entry Fee drives payouts. Tournament Entry Fee is what players pay to register.</p>

        {/* Payment links */}
        <div className="space-y-3 bg-gray-50 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Links (shown after registration)</p>
          <div>
            <label className="label">Venmo Handle</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">@</span>
              <input
                type="text"
                value={venmoHandle}
                onChange={e => setVenmoHandle(e.target.value)}
                placeholder="yourhandle"
                className="input pl-7"
              />
            </div>
          </div>
          <div>
            <label className="label">PayPal.me Link</label>
            <input
              type="url"
              value={paypalLink}
              onChange={e => setPaypalLink(e.target.value)}
              placeholder="https://paypal.me/yourname"
              className="input"
            />
          </div>
          <div>
            <label className="label">Zelle (phone or email)</label>
            <input
              type="text"
              value={zelleHandle}
              onChange={e => setZelleHandle(e.target.value)}
              placeholder="555-555-5555 or name@email.com"
              className="input"
            />
          </div>
        </div>

        {/* Schedule of Events */}
        <div className="space-y-3 bg-gray-50 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Schedule of Events <span className="normal-case text-gray-400 font-normal">(shown on event page and registration)</span></p>
          {scheduleItems.map((item, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={item.time ?? ''}
                  onChange={e => setScheduleItems(prev => prev.map((s, j) => j === i ? { ...s, time: e.target.value } : s))}
                  className="input w-28 shrink-0"
                />
                <input
                  type="text"
                  value={item.label}
                  onChange={e => setScheduleItems(prev => prev.map((s, j) => j === i ? { ...s, label: e.target.value } : s))}
                  placeholder="e.g. Check-in, Tee Time, Awards…"
                  className="input flex-1"
                />
                <button type="button" onClick={() => setScheduleItems(prev => prev.filter((_, j) => j !== i))}
                  className="text-gray-400 hover:text-red-500 text-sm shrink-0">✕</button>
              </div>
              <input
                type="text"
                value={item.description ?? ''}
                onChange={e => setScheduleItems(prev => prev.map((s, j) => j === i ? { ...s, description: e.target.value } : s))}
                placeholder="Description (optional) — e.g. Pick up your scorecard and cart assignment"
                className="input text-sm"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setScheduleItems(prev => [...prev, { time: '', label: '' }])}
            className="text-xs text-fairway-700 font-semibold hover:underline mt-1"
          >
            + Add item
          </button>
        </div>

        {/* Custom Registration Questions */}
        <div className="space-y-2 bg-gray-50 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Registration Questions <span className="normal-case text-gray-400 font-normal">(shown on registration form)</span></p>
          {customQuestions.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={q.label}
                onChange={e => setCustomQuestions(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                placeholder="e.g. Interested in bringing a guest?"
                className="input flex-1"
              />
              <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0 cursor-pointer">
                <input type="checkbox" checked={q.required}
                  onChange={e => setCustomQuestions(prev => prev.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))}
                  className="accent-fairway-600" />
                Required
              </label>
              <button type="button" onClick={() => setCustomQuestions(prev => prev.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500 text-sm shrink-0">✕</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setCustomQuestions(prev => [...prev, { label: '', required: false }])}
            className="text-xs text-fairway-700 font-semibold hover:underline mt-1"
          >
            + Add item
          </button>
        </div>

        {/* Number of Flights */}
        <div className="bg-gray-50 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-800">Number of Flights</div>
              <div className="text-xs text-gray-400 mt-0.5">Flight A = highest/best players. "No flights" = single field.</div>
            </div>
            <select
              value={numFlights}
              onChange={e => setNumFlights(Number(e.target.value))}
              className="input bg-white w-36"
            >
              <option value={0}>No flights</option>
              {Array.from({ length: 24 }, (_, i) => i + 2).map(n => (
                <option key={n} value={n}>{n} flights ({Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)).join(', ')})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Shotgun Start toggle */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-800">Shotgun Start?</div>
            <div className="text-xs text-gray-400 mt-0.5">All groups tee off simultaneously from different holes</div>
          </div>
          <button
            type="button"
            onClick={() => setShotgunStart(v => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${shotgunStart ? 'bg-fairway-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${shotgunStart ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Holes Played toggle */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-800">Holes Played</div>
            <div className="text-xs text-gray-400 mt-0.5">Defaults to 18. Select 9 for a nine-hole event.</div>
          </div>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-semibold">
            {[18, 9].map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setHolesPlayed(h)}
                className={`px-4 py-1.5 transition-colors ${holesPlayed === h ? 'bg-fairway-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Use Handicaps toggle */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-800">Use Handicaps</div>
            <div className="text-xs text-gray-400 mt-0.5">When off, handicap index is not required when adding players.</div>
          </div>
          <button
            type="button"
            onClick={() => setUseHandicaps(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useHandicaps ? 'bg-fairway-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${useHandicaps ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Scoring Formats */}
        <div>
          <label className="label">Scoring Formats</label>
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-3">
            {EDIT_FORMAT_OPTIONS.map(group => (
              <div key={group.group}>
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">{group.group}</div>
                <div className="space-y-2">
                  {group.options.map(opt => {
                    const isPerFlightEligible = PER_FLIGHT_FORMAT_KEYS.has(opt.value)
                    const fmtScope = formatScope[opt.value] ?? 'flight'
                    const flightLetters = Array.from({ length: numFlights }, (_, i) => String.fromCharCode(65 + i))
                    return (
                      <div key={opt.value}>
                        <div className="flex items-center gap-2.5">
                          <input type="checkbox" checked={formats.has(opt.value)} onChange={() => toggleFormat(opt.value)} className="accent-fairway-600 w-4 h-4 shrink-0 cursor-pointer" />
                          <span className="text-sm text-gray-800 cursor-pointer" onClick={() => toggleFormat(opt.value)}>{opt.label}</span>
                          {opt.tip && (
                            <span className="relative group/tip shrink-0">
                              <span className="text-gray-400 hover:text-fairway-600 cursor-default text-xs font-bold select-none">ⓘ</span>
                              <span className="absolute left-5 top-1/2 -translate-y-1/2 z-50 hidden group-hover/tip:block w-64 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 leading-relaxed shadow-xl pointer-events-none">
                                {opt.tip}
                              </span>
                            </span>
                          )}
                          {formats.has(opt.value) && (
                            <div className="ml-auto flex items-center gap-1.5 shrink-0">
                              <span className="text-xs text-gray-400">Places to pay:</span>
                              <select
                                value={payoutPlaces[opt.value] ?? 1}
                                onChange={e => setPayoutPlaces(prev => ({ ...prev, [opt.value]: Number(e.target.value) }))}
                                className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                              >
                                {PLACES_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                        {formats.has(opt.value) && isPerFlightEligible && numFlights > 0 && (
                          <div className="ml-6 mt-1.5 flex gap-4">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" checked={fmtScope === 'group'}
                                onChange={() => setFormatScope(prev => ({ ...prev, [opt.value]: 'group' }))}
                                className="accent-fairway-600" />
                              <span className="text-xs text-gray-600">Whole group</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" checked={fmtScope === 'flight'}
                                onChange={() => setFormatScope(prev => ({ ...prev, [opt.value]: 'flight' }))}
                                className="accent-fairway-600" />
                              <span className="text-xs text-gray-600">Per flight ({flightLetters.join(', ')})</span>
                            </label>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {formats.size === 0 && <p className="text-xs text-red-500 mt-1">Select at least one format.</p>}
        </div>

        {/* Side Games */}
        <div>
          <label className="label">Side Games / Competitions</label>
          <div className="space-y-3 bg-gray-50 rounded-xl px-4 py-3">
            {[...PER_FLIGHT_GAMES, ...GROUP_GAMES].map(opt => {
              const checked = sideGames.has(opt.key)
              const scope = gameScope[opt.key] ?? 'flight'
              const flightLetters = Array.from({ length: numFlights }, (_, i) => String.fromCharCode(65 + i))
              const isPerFlight = PER_FLIGHT_GAMES.some(g => g.key === opt.key)
              const buyIn = sideGameBuyIns[opt.key] ?? {}
              return (
                <div key={opt.key}>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={() => toggleSideGame(opt.key)} className="accent-fairway-600 w-4 h-4" />
                    <span className="text-sm text-gray-800">{opt.label}</span>
                  </label>
                  {checked && isPerFlight && numFlights > 0 && (
                    <div className="ml-6 mt-1.5 flex gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" checked={scope === 'flight'}
                          onChange={() => setGameScope(prev => ({ ...prev, [opt.key]: 'flight' }))}
                          className="accent-fairway-600" />
                        <span className="text-xs text-gray-600">Per flight ({flightLetters.join(', ')})</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" checked={scope === 'group'}
                          onChange={() => setGameScope(prev => ({ ...prev, [opt.key]: 'group' }))}
                          className="accent-fairway-600" />
                        <span className="text-xs text-gray-600">Whole group</span>
                      </label>
                    </div>
                  )}
                  {checked && (
                    <div className="ml-6 mt-1.5 flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={buyIn.enabled ?? false} onChange={() => toggleBuyIn(opt.key)} className="accent-fairway-600 w-4 h-4" />
                        <span className="text-xs text-gray-600">Separate buy-in</span>
                      </label>
                      {buyIn.enabled && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">$</span>
                          <input
                            type="number" min="0" step="1"
                            value={buyIn.amount ?? ''}
                            onChange={e => setBuyInAmount(opt.key, e.target.value)}
                            placeholder="0"
                            className="w-16 border border-gray-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-600"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Custom Competitions */}
          <div className="mt-3">
            <div className="space-y-2">
              {customCompetitions.map((name, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setCustomCompetitions(prev => prev.map((c, j) => j === i ? e.target.value : c))}
                    placeholder="e.g. Bingo Bango Bongo"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                  <button type="button" onClick={() => setCustomCompetitions(prev => prev.filter((_, j) => j !== i))}
                    className="text-gray-400 hover:text-red-500 text-lg leading-none">✕</button>
                </div>
              ))}
            </div>
            <button type="button"
              onClick={() => setCustomCompetitions(prev => [...prev, ''])}
              className="mt-2 text-xs font-semibold text-green-700 hover:text-green-900">
              + Add Custom Competition
            </button>
          </div>
        </div>

        {!shotgunStart && <Input label="Tee Interval (min)" type="number" min="1" max="60" value={interval} onChange={e => setInterval(e.target.value)} />}

        {/* Payout Basis */}
        <div>
          <label className="label">Payout Pot Based On</label>
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="editPayoutBasis" value="per_player" checked={payoutBasis === 'per_player'} onChange={() => setPayoutBasis('per_player')} className="accent-fairway-600" />
              <span className="text-sm text-gray-700">Attendance (entry fee × players)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="editPayoutBasis" value="fixed" checked={payoutBasis === 'fixed'} onChange={() => setPayoutBasis('fixed')} className="accent-fairway-600" />
              <span className="text-sm text-gray-700">Fixed total</span>
            </label>
          </div>
          {payoutBasis === 'fixed' && (
            <Input className="mt-2" label="Fixed Pot Total ($)" type="number" step="0.01" min="0" value={payoutFixed} onChange={e => setPayoutFixed(e.target.value)} placeholder="e.g. 500" />
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={formats.size === 0}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  )
}

function DeleteEventModal({ open, onClose, event }) {
  const [saving, setSaving] = useState(false)
  const navigate = Link // placeholder — we'll use window.history

  async function handleDelete() {
    setSaving(true)
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Event deleted')
    window.history.back()
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete Event">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          Are you sure you want to delete <strong>Event #{event?.event_number}</strong>?
          This will permanently remove all scores, pairings, and side game data for this event.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          This cannot be undone.
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={saving} onClick={handleDelete}>Delete Event</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────
function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  )
}

// ─── Access Code Section ───────────────────────────────────────────
// ─── Per-Group Code Section ────────────────────────────────────────
function AccessCodeSection({ event, eventPlayers, onUpdated, orgSlug }) {
  // group_codes stored as { "1": "ABC123", "2": "XYZ789" }
  const [groupCodes, setGroupCodes] = useState(event.group_codes ?? {})
  const [saving,     setSaving]     = useState(false)
  const scorecardUrl = `${window.location.origin}/${orgSlug}/${event.league?.slug}/${event.slug}/scorecard?eid=${event.id}`

  // Unique sorted group numbers from event players
  const groupNums = [...new Set(
    eventPlayers.map(ep => ep.group_number).filter(g => g != null)
  )].sort((a, b) => a - b)

  function makeCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let r = ''
    for (let i = 0; i < 5; i++) r += chars[Math.floor(Math.random() * chars.length)]
    return r
  }

  function setCode(groupNum, val) {
    setGroupCodes(prev => ({ ...prev, [groupNum]: val.toUpperCase() }))
  }

  function generateAll() {
    const next = {}
    for (const g of groupNums) next[g] = makeCode()
    setGroupCodes(next)
  }

  async function saveAll() {
    setSaving(true)
    const { error } = await supabase.from('events')
      .update({ group_codes: groupCodes })
      .eq('id', event.id)
    setSaving(false)
    if (error) { toast.error('Failed to save codes'); return }
    toast.success('Group codes saved')
    onUpdated()
  }

  if (groupNums.length === 0) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1">Group Codes (no login needed)</p>
        <p className="text-xs text-gray-400">Assign players to groups first, then set codes here.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-600">Group Codes (no login needed)</p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={generateAll}>Generate All</Button>
          <Button size="sm" variant="primary" onClick={saveAll} disabled={saving}>Save</Button>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        {groupNums.map(g => {
          const code = groupCodes[g] ?? ''
          const players = eventPlayers
            .filter(ep => ep.group_number === g)
            .map(ep => `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim())
            .join(', ')
          return (
            <div key={g} className="flex items-center gap-2">
              <div className="shrink-0 text-xs font-bold text-gray-500 w-16">Group {g}</div>
              <input
                type="text"
                value={code}
                onChange={e => setCode(g, e.target.value)}
                placeholder="—"
                maxLength={8}
                className="input text-sm w-28 uppercase tracking-widest font-bold text-center"
              />
              <div className="text-xs text-gray-400 truncate flex-1" title={players}>{players}</div>
              <Button size="sm" variant="secondary" onClick={() => setCode(g, makeCode())}>↺</Button>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-500 mb-1.5">
        Share the scorecard link + each group's code. Players enter their code to access scoring — no account needed.
      </p>
      <div className="flex items-center gap-2">
        <input readOnly value={scorecardUrl} className="input text-xs flex-1 bg-gray-50" onFocus={e => e.target.select()} />
        <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(scorecardUrl); toast.success('Link copied!') }}>
          Copy
        </Button>
      </div>
    </div>
  )
}

// ─── Tab: Registrations ───────────────────────────────────────────
function TabRegistrations({ event, onUpdated, orgId }) {
  const [regs,              setRegs]              = useState([])
  const [loading,           setLoading]           = useState(true)
  const [confirmedExpanded, setConfirmedExpanded] = useState(false)

  const regUrl = `${window.location.origin}/register/${event.league?.slug ?? leagueSlug}/${event.slug ?? event.id}`

  async function load() {
    const { data } = await supabase
      .from('registrations')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: false })
    setRegs(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [event.id])

  async function setStatus(id, status) {
    const { error } = await supabase.from('registrations').update({ status }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(status === 'confirmed' ? 'Registration confirmed' : 'Registration cancelled')
    load()
  }

  async function removeReg(id) {
    if (!window.confirm('Remove this registration? This cannot be undone.')) return
    const { error } = await supabase.from('registrations').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Registration removed')
    load()
  }

  async function addToRoster(reg) {
    // Upsert player by email or name, then add to event_players
    let playerId = null

    if (reg.email) {
      const { data: existing } = await supabase.from('players').select('id').eq('email', reg.email).maybeSingle()
      if (existing) playerId = existing.id
    }

    if (!playerId) {
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .ilike('first_name', reg.first_name)
        .ilike('last_name', reg.last_name)
        .maybeSingle()
      if (existing) playerId = existing.id
    }

    if (!playerId) {
      const { data: newPlayer, error: pErr } = await supabase
        .from('players')
        .insert({ first_name: reg.first_name, last_name: reg.last_name, email: reg.email ?? null, org_id: orgId })
        .select('id')
        .single()
      if (pErr) { toast.error('Failed to create player: ' + pErr.message); return }
      playerId = newPlayer.id
    }

    const { error: epErr } = await supabase.from('event_players').upsert({
      event_id:                event.id,
      player_id:               playerId,
      handicap_index:          0,
      adjusted_handicap_index: 0,
    }, { onConflict: 'event_id,player_id' })

    if (epErr) { toast.error('Failed to add to roster: ' + epErr.message); return }

    await setStatus(reg.id, 'confirmed')
    toast.success(`${reg.first_name} ${reg.last_name} added to roster`)
    onUpdated()
  }

  const pending   = regs.filter(r => r.status === 'pending').sort(regAlpha)
  const confirmed = regs.filter(r => r.status === 'confirmed').sort(regAlpha)
  const cancelled = regs.filter(r => r.status === 'cancelled')

  const STATUS_COLORS = {
    pending:   'bg-amber-100 text-amber-700',
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  }

  function RegRow({ reg }) {
    return (
      <div className="py-3 space-y-2">
        {/* Player info */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ${STATUS_COLORS[reg.status]}`}>
            {reg.status}
          </span>
          <p className="text-sm font-semibold text-gray-900">
            {reg.first_name} {reg.last_name}
            {reg.flight && <span className="ml-2 text-xs text-gray-400">Flight {reg.flight}</span>}
          </p>
        </div>
        {reg.email && <p className="text-xs text-gray-500">{reg.email}</p>}
        {reg.notes && (
          <p className="text-xs text-gray-400 italic">
            "{reg.notes}"
          </p>
        )}
        <p className="text-xs text-gray-400">
          {new Date(reg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </p>
        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {reg.status === 'pending' && (
            <>
              <Button size="sm" variant="primary" onClick={() => addToRoster(reg)}>
                Confirm + Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus(reg.id, 'cancelled')}>
                Cancel
              </Button>
            </>
          )}
          {reg.status === 'cancelled' && (
            <Button size="sm" variant="secondary" onClick={() => setStatus(reg.id, 'pending')}>
              Restore
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={() => removeReg(reg.id)}>
            Remove
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Registration link */}
      <Card>
        <CardHeader title="Registration Link" subtitle="Share this link with players to register" />
        <div className="flex items-center gap-2 px-4 pb-4">
          <input readOnly value={regUrl} className="input text-xs flex-1 bg-gray-50" onFocus={e => e.target.select()} />
          <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(regUrl); toast.success('Link copied!') }}>
            Copy
          </Button>
        </div>
        {!event.venmo_handle && !event.paypal_link && !event.zelle_handle && (
          <p className="text-xs text-amber-600 px-4 pb-3">
            ⚠ No payment links set — players won't see a payment button after registering. Add a Venmo handle, Zelle, or PayPal link in Event Settings.
          </p>
        )}
      </Card>

      {/* Pending */}
      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : (
        <>
          <Card>
            <CardHeader
              title={`Pending (${pending.length})`}
              subtitle="Payment not yet confirmed"
            />
            {pending.length === 0
              ? <p className="text-sm text-gray-400 px-4 pb-4">No pending registrations.</p>
              : <div className="divide-y divide-gray-100 px-4">{pending.map(r => <RegRow key={r.id} reg={r} />)}</div>
            }
          </Card>

          {confirmed.length > 0 && (
            <Card>
              <button
                onClick={() => setConfirmedExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-900">Confirmed ({confirmed.length})</span>
                <span className="text-gray-400 text-xs">{confirmedExpanded ? '▲ Hide' : '▼ Show'}</span>
              </button>
              {confirmedExpanded && (
                <div className="divide-y divide-gray-100 px-4 pb-2">{confirmed.map(r => <RegRow key={r.id} reg={r} />)}</div>
              )}
            </Card>
          )}

          {cancelled.length > 0 && (
            <Card>
              <CardHeader title={`Cancelled (${cancelled.length})`} />
              <div className="divide-y divide-gray-100 px-4">{cancelled.map(r => <RegRow key={r.id} reg={r} />)}</div>
            </Card>
          )}

          {/* Notes & Guest Requests */}
          {(() => {
            const withNotes = regs.filter(r => r.notes && r.status !== 'cancelled')
            if (withNotes.length === 0) return null

            function parseNotes(raw) {
              const parts = (raw ?? '').split(' | ').map(s => s.trim()).filter(Boolean)
              const guestPart = parts.find(p => p.toLowerCase().startsWith('guest request:'))
              const regularParts = parts.filter(p => !p.toLowerCase().startsWith('guest request:') && p !== 'No guest')
              let guest = null
              if (guestPart) {
                const info = guestPart.replace(/^guest request:\s*/i, '')
                const [name, email, ghin] = info.split(',').map(s => s.trim())
                guest = { name, email: email ?? null, ghin: ghin ? ghin.replace(/^GHIN:\s*/i, '') : null }
              }
              return { guest, notes: regularParts.join(' | ') || null }
            }

            return (
              <Card>
                <CardHeader
                  title={`Notes & Guest Requests (${withNotes.length})`}
                  subtitle="Submitted by registrants"
                />
                <div className="divide-y divide-gray-100 px-4 pb-2">
                  {withNotes.map(reg => {
                    const { guest, notes } = parseNotes(reg.notes)
                    const timestamp = new Date(reg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                    return (
                      <div key={reg.id} className="py-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{reg.first_name} {reg.last_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[reg.status]}`}>{reg.status}</span>
                          <span className="text-xs text-gray-400 ml-auto">{timestamp}</span>
                        </div>
                        {guest && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-0.5">
                            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Guest Request</p>
                            <p className="text-sm font-medium text-gray-900">{guest.name}</p>
                            {guest.email && <p className="text-xs text-gray-500">{guest.email}</p>}
                            {guest.ghin && <p className="text-xs text-gray-500">GHIN: {guest.ghin}</p>}
                          </div>
                        )}
                        {notes && (
                          <p className="text-xs text-gray-500 italic">"{notes}"</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })()}
        </>
      )}
    </div>
  )
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key]
    if (k == null) return acc
    ;(acc[k] = acc[k] ?? []).push(item)
    return acc
  }, {})
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatTime(t) {
  // t is "HH:MM:SS" from Postgres
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`
}

const FORMAT_LABELS = {
  // Net stroke play
  net_stroke:           'Net Stroke Play — Full 18',
  net_stroke_front9:    'Net Stroke Play — Front 9',
  net_stroke_back9:     'Net Stroke Play — Back 9',
  net_stroke_nassau:    'Nassau (Net)',
  // Gross stroke play
  low_gross:            'Low Gross — Full 18',
  gross_stroke_front9:  'Low Gross — Front 9',
  gross_stroke_back9:   'Low Gross — Back 9',
  gross_stroke_nassau:  'Nassau (Gross)',
  callaway:             'Callaway / Peoria',
  // Points & alternative
  stableford:           'Stableford (Net)',
  stableford_gross:     'Stableford (Gross)',
  modified_stableford:  'Modified Stableford',
  quota_chicago:        'Quota / Chicago',
  // Team best ball
  best_ball_2:          '2-Person Best Ball (Net)',
  best_ball_4:          '4-Person Best Ball (Net)',
  best_ball_2_gross:    '2-Person Best Ball (Gross)',
  best_ball_4_gross:    '4-Person Best Ball (Gross)',
  cha_cha_cha:          '1-2-3 / ChaChaCha',
  team_match_play:      'Best Ball Match Play',
  // Scramble & alternate
  scramble:             'Scramble',
  shamble:              'Shamble',
  alternate_shot:       'Alternate Shot (Foursomes)',
  chapman:              'Chapman / Pinehurst',
  // Match play & cups
  match_points:         'Individual Match Play',
  four_ball_match:      'Four-Ball Match Play',
  ryder_cup:            'Ryder Cup / Team Cup',
}

// ─── TGL Manager ─────────────────────────────────────────────────────────────
// Manage TGL teams for this league and select 2 players per team for this event.

function TGLManager({ event, eventPlayers, allScores, course, tglTeams, tglMembers, tglSelections, tglLocked, onUpdated }) {
  const [showTeamModal,  setShowTeamModal]  = useState(false)
  const [showMemberModal,setShowMemberModal]= useState(false)
  const [selectedTeam,   setSelectedTeam]   = useState(null)
  const [newTeamName,    setNewTeamName]    = useState('')
  const [newTeamColor,   setNewTeamColor]   = useState('#16a34a')
  const [saving,         setSaving]         = useState(false)

  async function lockSelections() {
    await supabase.from('tgl_event_locks').insert({ event_id: event.id })
    onUpdated()
    toast.success('TGL selections locked for this event')
  }

  async function unlockSelections() {
    await supabase.from('tgl_event_locks').delete().eq('event_id', event.id)
    onUpdated()
    toast.success('TGL selections unlocked')
  }

  // Compute event results if scores exist
  const eventResults = (() => {
    if (!course || !allScores.length || !tglTeams.length) return null
    try {
      const lb = computeLeaderboards(eventPlayers, allScores, course)
      const epMap = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep]))

      const attachPlayer = r => ({ ...r, player: epMap[r.player_id]?.player ?? null })

      // Score TGL points per-flight so Flight A competes within Flight A, etc.
      const rankedA = (lb.full?.A ?? []).map(attachPlayer)
      const rankedB = (lb.full?.B ?? []).map(attachPlayer)

      // Field size = enrolled players per flight, so missing/unassigned players
      // don't shrink the denominator and deflate everyone else's points.
      const hasFlights = eventPlayers.some(ep => ep.flight === 'A' || ep.flight === 'B')
      const enrolledA = hasFlights ? eventPlayers.filter(ep => ep.flight === 'A').length : eventPlayers.length
      const enrolledB = eventPlayers.filter(ep => ep.flight === 'B').length
      const pointsA = rankedA.length ? assignTGLPoints(rankedA, Math.max(rankedA.length, enrolledA)) : {}
      const pointsB = rankedB.length ? assignTGLPoints(rankedB, Math.max(rankedB.length, enrolledB)) : {}
      const combinedPoints = { ...pointsA, ...pointsB }

      const allRanked = [...rankedA, ...rankedB]
      if (!allRanked.length) return null

      return computeTGLEventResults(allRanked, tglSelections, tglTeams, tglMembers, combinedPoints)
    } catch {
      return null
    }
  })()

  async function createTeam() {
    if (!newTeamName.trim()) return
    setSaving(true)
    const { error } = await supabase.from('tgl_teams').insert({
      league_id: event.league_id,
      name: newTeamName.trim(),
      color: newTeamColor,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setNewTeamName('')
    setShowTeamModal(false)
    onUpdated()
  }

  async function deleteTeam(teamId) {
    if (!confirm('Delete this team and all its members?')) return
    await supabase.from('tgl_teams').delete().eq('id', teamId)
    onUpdated()
  }

  // Select / deselect a player for an event slot on a team
  async function toggleEventSelection(teamId, playerId) {
    const existing = tglSelections.find(s => s.team_id === teamId && s.player_id === playerId)
    if (existing) {
      await supabase.from('tgl_event_selections').delete().eq('id', existing.id)
    } else {
      // Check limit: max 2 per team per event (only count members on the team roster)
      const teamMemberIds = new Set(tglMembers.filter(m => m.team_id === teamId).map(m => m.player_id))
      const teamCount = tglSelections.filter(s => s.team_id === teamId && teamMemberIds.has(s.player_id)).length
      if (teamCount >= 2) { toast.error('Max 2 players per team per event'); return }
      // Check player not already on another team for this event
      const conflict = tglSelections.find(s => s.player_id === playerId && s.team_id !== teamId)
      if (conflict) { toast.error('Player already selected for another team this event'); return }
      await supabase.from('tgl_event_selections').insert({
        event_id: event.id,
        team_id: teamId,
        player_id: playerId,
      })
    }
    onUpdated()
  }

  return (
    <div className="space-y-6">
      {/* Teams header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-800">Team Play</h3>
            {tglLocked && (
              <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                🔒 Locked
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {tglLocked
              ? 'Selections are locked. Unlock to make changes.'
              : 'Select 2 players per team for this event, then submit to lock.'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {!tglLocked && <Button size="sm" variant="secondary" onClick={() => setShowTeamModal(true)}>+ New Team</Button>}
          {tglLocked ? (
            <Button size="sm" variant="secondary" onClick={unlockSelections}>Unlock</Button>
          ) : (
            <Button size="sm" onClick={lockSelections} disabled={tglSelections.length === 0}>
              Submit Selections
            </Button>
          )}
        </div>
      </div>

      {tglTeams.length === 0 && (
        <p className="text-sm text-gray-400 italic">No teams yet. Create up to 4 teams for this league.</p>
      )}

      {/* Team cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {tglTeams.map(team => {
          const members = tglMembers.filter(m => m.team_id === team.id)
          const memberIds = new Set(members.map(m => m.player_id))
          const selected = tglSelections.filter(s => s.team_id === team.id && memberIds.has(s.player_id))
          const eventPoints = eventResults?.teamResults?.find(r => r.team.id === team.id)?.teamPoints ?? null

          return (
            <div key={team.id} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Team header bar */}
              <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: team.color + '22', borderBottom: `3px solid ${team.color}` }}>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: team.color }} />
                  <span className="font-semibold text-gray-900 text-sm">{team.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {eventPoints !== null && (
                    <span className="text-xs font-medium text-gray-600 bg-white rounded-full px-2 py-0.5 border">
                      {eventPoints % 1 === 0 ? eventPoints : eventPoints.toFixed(1)} pts
                    </span>
                  )}
                  {!tglLocked && (
                    <button
                      onClick={() => { setSelectedTeam(team); setShowMemberModal(true) }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Roster
                    </button>
                  )}
                  {!tglLocked && (
                    <button onClick={() => deleteTeam(team.id)} className="text-xs text-red-500 hover:text-red-700">✕</button>
                  )}
                </div>
              </div>

              {/* Event selections */}
              <div className="p-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Playing this event ({selected.length}/2):</p>
                {members.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No roster members yet.</p>
                ) : (
                  <div className="space-y-1">
                    {members.map(m => {
                      const isSelected = selected.some(s => s.player_id === m.player_id)
                      const conflictSel = !isSelected ? tglSelections.find(s => s.player_id === m.player_id && s.team_id !== team.id) : null
                      const conflictTeam = conflictSel ? tglTeams.find(t => t.id === conflictSel.team_id) : null
                      const onAnotherTeam = !!conflictSel
                      return (
                        <div key={m.player_id} className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${onAnotherTeam ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={tglLocked || (!isSelected && selected.length >= 2 && !onAnotherTeam)}
                            onChange={() => !tglLocked && toggleEventSelection(team.id, m.player_id)}
                            className="rounded text-green-600 cursor-pointer"
                          />
                          <span className={isSelected ? 'font-medium text-gray-900' : onAnotherTeam ? 'text-amber-800' : 'text-gray-600'}>
                            {m.player?.first_name} {m.player?.last_name}
                          </span>
                          {onAnotherTeam && (
                            <span className="ml-auto text-xs text-amber-600 font-medium">
                              on {conflictTeam?.name ?? 'another team'} —{' '}
                              <button
                                className="underline hover:text-amber-800"
                                onClick={async () => {
                                  await supabase.from('tgl_event_selections').delete().eq('id', conflictSel.id)
                                  onUpdated()
                                }}
                              >
                                remove
                              </button>
                            </span>
                          )}
                          {isSelected && eventResults && (() => {
                            const pp = eventResults.playerPoints?.[m.player_id]
                            return pp != null ? (
                              <span className="ml-auto text-xs text-gray-400">
                                {pp % 1 === 0 ? pp : pp.toFixed(1)} pts
                              </span>
                            ) : null
                          })()}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Event results summary */}
      {eventResults && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Event Team Play Scores</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left px-4 py-2">Rank</th>
                <th className="text-left px-4 py-2">Team</th>
                <th className="text-left px-4 py-2">Players</th>
                <th className="text-right px-4 py-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {eventResults.teamResults.map(tr => (
                <tr key={tr.team.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2 font-semibold text-gray-700">#{tr.rank}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tr.team.color }} />
                      <span className="font-medium">{tr.team.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-600 text-xs">
                    {tr.selectedPlayers.map(p => `${p.name} (${p.points % 1 === 0 ? p.points : p.points.toFixed(1)})`).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-gray-900">
                    {tr.teamPoints % 1 === 0 ? tr.teamPoints : tr.teamPoints.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Team Modal */}
      {showTeamModal && (
        <Modal open={showTeamModal} title="New Team Play Team" onClose={() => setShowTeamModal(false)}>
          <div className="space-y-4">
            <Input
              label="Team Name"
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              placeholder="e.g. Just the Tips"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Color</label>
              <input
                type="color"
                value={newTeamColor}
                onChange={e => setNewTeamColor(e.target.value)}
                className="h-10 w-20 rounded cursor-pointer border border-gray-300"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowTeamModal(false)}>Cancel</Button>
              <Button onClick={createTeam} disabled={saving || !newTeamName.trim()}>
                {saving ? 'Saving…' : 'Create Team'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Roster Management Modal */}
      {showMemberModal && selectedTeam && (
        <TGLRosterModal
          team={selectedTeam}
          tglMembers={tglMembers.filter(m => m.team_id === selectedTeam.id)}
          allEventPlayers={eventPlayers}
          onClose={() => { setShowMemberModal(false); setSelectedTeam(null) }}
          onUpdated={onUpdated}
        />
      )}
    </div>
  )
}

function TGLRosterModal({ team, tglMembers, allEventPlayers, onClose, onUpdated }) {
  const memberIds = new Set(tglMembers.map(m => m.player_id))

  async function toggleMember(playerId) {
    if (memberIds.has(playerId)) {
      const member = tglMembers.find(m => m.player_id === playerId)
      await supabase.from('tgl_team_members').delete().eq('id', member.id)
    } else {
      await supabase.from('tgl_team_members').insert({ team_id: team.id, player_id: playerId })
    }
    onUpdated()
  }

  return (
    <Modal open={true} title={`${team.name} — Roster`} onClose={onClose}>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {allEventPlayers.length === 0 && (
          <p className="text-sm text-gray-400 italic">No players registered for this event yet.</p>
        )}
        {allEventPlayers.map(ep => {
          const isMember = memberIds.has(ep.player_id)
          return (
            <label key={ep.player_id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-gray-50 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={isMember}
                onChange={() => toggleMember(ep.player_id)}
                className="rounded text-green-600"
              />
              <span className={isMember ? 'font-medium text-gray-900' : 'text-gray-600'}>
                {ep.player?.first_name} {ep.player?.last_name}
              </span>
              <span className="ml-auto text-xs text-gray-400">{ep.flight ? `Flight ${ep.flight}` : ''}</span>
            </label>
          )
        })}
      </div>
      <div className="flex justify-end pt-4">
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  )
}

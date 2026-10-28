import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { computePayouts, DEFAULT_PAYOUT_CONFIG, getCategoryLabel, ctpLabel, activePayoutKeys, defaultForKey, flightLetterOf } from '../../lib/engines/payouts'
import { computeLeaderboards, computeStableford, computeBlindPartners, blindPartnersMode, getStrokeIndexForTee } from '../../lib/engines/scoring'
import { computeAllSkins, computeSuperSkins } from '../../lib/engines/skins'
import { computeTGLEventResults, assignTGLPoints } from '../../lib/engines/tgl'
import Card, { CardHeader } from '../../components/ui/Card'
import { ExportScorecardsButton, ExportSkinsGridButton, ExportResultsButton, ExportTeamPlayButton, ExportMatchPlayCardsButton } from '../../components/ScorecardExport'
import { useOrg, useFeatures } from '../../lib/OrgContext'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import Badge, { FlightBadge, StatusBadge } from '../../components/ui/Badge'
import ImageUpload from '../../components/ui/ImageUpload'
import UpgradePrompt from '../../components/ui/UpgradePrompt'
import PrintAssets from '../../components/ui/PrintAssets'
import { matchCH, computeMatchPoints, TIEBREAK_PRESETS } from '../../lib/engines/matchPoints'
import { computePlayerPayouts } from '../../lib/engines/payoutSummary'
import EventEmailModal from '../../components/ui/EventEmailModal'
import { ActionButton } from '../../components/ui/Button'
import ExportRow from '../../components/ui/ExportRow'
import SectionCard, { LockedSectionCard } from '../../components/ui/SectionCard'
import HeroEmailCard from '../../components/ui/HeroEmailCard'
import EventAdminHeader from '../../components/ui/EventAdminHeader'
import ReadinessCard, { buildReadiness } from '../../components/ui/ReadinessCard'
import { EventDetailsCard, ParticipantsCard, formatMoney } from '../../components/ui/OverviewCards'
import StatTiles, { playerTiles } from '../../components/ui/StatTiles'
import RegistrationCard from '../../components/ui/RegistrationCard'
import FlightsTeesCard from '../../components/ui/FlightsTeesCard'
import RosterCard from '../../components/ui/RosterCard'
import PhotosCard from '../../components/ui/PhotosCard'
import { atLimit, getLimit, nextTier, TIER_LABELS } from '../../lib/features'
import { BUY_IN_ELIGIBLE_KEYS, OPT_IN_GAME_LABELS, optInAmount, isBuyInEnabled, baseSideGameKey, isPerFlight } from '../../lib/sideGames'

// Collapsed from 7 → 4 tabs: Players = Registrations + Players & Flights; Payout = Config + Side Games + Summary
const ALL_ADMIN_TABS = ['Overview', 'Players', 'Groups', 'Side Games', 'Payout', 'Pre/Post Round', 'Team Play']

// ─── Side game helpers (shared between EditEventModal and elsewhere) ──────────
// Every side game offers a "Per flight / Whole group" scope radio. Scope only
// decides how the competition is *pooled* (one whole-group pot vs. one
// independent pot per flight, where players only compete against — and can only
// win from — their own flight). It is orthogonal to the "Separate buy-in" flag,
// which decides who *funds* the pot: opted-in entrants only (separate buy-in)
// vs. the whole field/flight out of the entry fee (no separate buy-in).
// Per flight, Blind Partners draws pairs *within* each flight (an A player is
// never paired with a B player) and each flight pays its own pot.
const PER_FLIGHT_GAMES = [
  { key: 'skins',          label: 'Skins' },
  { key: 'super_skins',    label: 'Super Skins' },
  { key: 'long_drive',     label: 'Long Drive' },
  { key: 'low_putts',      label: 'Low Putts' },
  { key: 'ctp',            label: 'Closest to Pin (par 3s)' },
  { key: 'super_ctp',      label: 'Super CTP (par 3s)' },
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
  const navigate = useNavigate()
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
  const [headerEditOpen, setHeaderEditOpen] = useState(false)
  const [addPlayerOpen,   setAddPlayerOpen]   = useState(false)
  const [playerLimitOpen, setPlayerLimitOpen] = useState(false)
  const [printAsset,     setPrintAsset]     = useState(null) // 'cards' | 'tee_sheet' | 'cart_signs'
  const [searchParams,   setSearchParams]   = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'Overview'
  const setActiveTab = (tab) => setSearchParams({ tab })
  const onPlayersTab = activeTab === 'Players'

  // Same check the old in-tab button made: at the plan's player limit, show the upgrade prompt.
  function handleAddPlayer() {
    if (atLimit(org?.tier ?? 'free', 'players', eventPlayers.length)) setPlayerLimitOpen(true)
    else setAddPlayerOpen(true)
  }

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

  async function handleClone() {
    const { data: numData } = await supabase
      .from('events').select('event_number').eq('league_id', event.league_id)
      .order('event_number', { ascending: false }).limit(1)
    const nextNum = numData?.[0]?.event_number ? numData[0].event_number + 1 : 1

    const {
      id, created_at, slug, display_order, event_number, status, name,
      league: _league, course: _course,
      ...rest
    } = event

    const baseName = name ? name : `Event #${event_number}`

    const { data: inserted, error } = await supabase.from('events').insert({
      ...rest,
      event_number: nextNum,
      name: `${baseName} (Copy)`,
      status: 'upcoming',
    }).select('slug').single()

    if (error) { toast.error(error.message); return }
    toast.success('Event cloned')
    if (inserted?.slug) navigate(`/admin/${orgSlug}/${leagueSlug}/${inserted.slug}`)
  }

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-10 w-64 bg-surface-high rounded" /><div className="h-48 bg-surface-high rounded-sm" /></div>
  if (!event)  return <p className="text-ink-muted">Event not found.</p>

  // Only computed when the "Payouts per Player" print asset is open — mirrors
  // TabPayoutSummary's exact computation so the printed sheet always matches
  // the on-screen Payout Summary tab.
  const payoutsByPlayer = printAsset === 'payouts_per_player'
    ? computePlayerPayouts(event, eventPlayers, allScores, course, sideGames)
    : []

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="text-sm text-ink-muted flex items-center gap-1.5">
        <Link to="/admin" className="hover:text-ink">Home</Link>
        <span>/</span>
        <Link to="/admin/leagues" className="hover:text-ink">Leagues</Link>
        <span>/</span>
        <span className="text-ink font-medium">{event.name ?? `Event #${event.event_number}`}</span>
      </nav>

      {/* Header */}
      <EventAdminHeader
        clubName={event.league?.name}
        title={onPlayersTab ? 'Players' : (event.name ? event.name : `Event #${event.event_number}`)}
        statusBadge={<StatusBadge status={event.status} />}
        meta={onPlayersTab
          ? [event.name ?? `Event #${event.event_number}`, event.course?.name, formatDate(event.event_date), event.tournament_fee > 0 ? `Entry fee ${formatMoney(event.tournament_fee)}` : null].filter(Boolean).join(' · ')
          : [event.course?.name, formatDate(event.event_date), event.start_time ? `${formatTime(event.start_time)} start` : null].filter(Boolean).join(' · ')}
        links={[
          { href: `/${orgSlug}/${event.league?.slug}/${event.slug}/event`, label: 'Event page' },
          ...(!onPlayersTab && event.league?.org_id === import.meta.env.VITE_MIGC_ORG_ID
            ? [{ href: `/wager/${event.id}/board`, label: 'Wager board' }]
            : []),
        ]}
        actions={onPlayersTab ? (
          <Button icon="plus" onClick={handleAddPlayer}>Add player</Button>
        ) : (
          <>
            {activeTab !== 'Overview' && (
              <ActionButton variant="ghost" onClick={() => setHeaderEditOpen(true)}>Edit event</ActionButton>
            )}
            <ActionButton variant="ghost" onClick={handleClone}>Clone</ActionButton>
            <EventStatusControl event={event} onUpdated={load} />
          </>
        )}
      />
      <EditEventModal open={headerEditOpen} onClose={() => setHeaderEditOpen(false)} event={event} onSaved={load} />

      {/* Tabs — rendered in sidebar on desktop; shown here on mobile only */}
      <div className="border-b border-surface-border md:hidden">
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
              {tab === 'Pre/Post Round' ? 'Print & share' : tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'Overview' && (
        <TabOverview event={event} eventPlayers={eventPlayers} allScores={allScores} sideGames={sideGames} course={course} conflicts={conflicts} onUpdated={load} leagues={leagues} orgName={org?.name} orgSlug={orgSlug} onPrintAsset={setPrintAsset} onGoToTab={setActiveTab} />
      )}

      {activeTab === 'Players' && (
        <TabFlights
          event={event}
          eventPlayers={eventPlayers}
          course={course}
          allPlayers={allPlayers}
          onUpdated={load}
          addModal={addPlayerOpen}
          setAddModal={setAddPlayerOpen}
          upgradePrompt={playerLimitOpen}
          setUpgradePrompt={setPlayerLimitOpen}
          registrationSlot={hasFeature('registration') ? (
            <TabRegistrations event={event} onUpdated={load} orgId={org?.id} />
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-sm text-sm" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <svg width="16" height="16" fill="none" stroke="#1d4ed8" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <span style={{ color: '#1e40af' }}>
                <strong>Online Registration</strong> is a Club plan feature.{' '}
                <a href="/onboarding" className="underline font-semibold">Upgrade to Club →</a>
              </span>
            </div>
          )}
        />
      )}

      {activeTab === 'Groups' && (
        <div className="space-y-6">
          <TabGroups event={event} eventPlayers={eventPlayers} onUpdated={load} orgSlug={orgSlug} allScores={allScores} course={course} />
          {((event.formats ?? (event.format ? [event.format] : [])).includes('match_points') ||
            (event.formats ?? (event.format ? [event.format] : [])).includes('ryder_cup')) && (
            <div className="border-t border-surface-border pt-6">
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">Match Play Pairings</h3>
              <MatchPairingsManager event={event} eventId={event.id} eventPlayers={eventPlayers} allScores={allScores} course={course} onUpdated={load} />
            </div>
          )}
          {(event.formats ?? (event.format ? [event.format] : [])).includes('team_match_play') && (
            <div className="border-t border-surface-border pt-6">
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">Team Match Setup</h3>
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
          orgSlug={orgSlug}
          leagueSlug={leagueSlug}
        />
      )}

      {activeTab === 'Payout' && (
        <div className="space-y-6">
          <div id="payout-config">
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">Payout Config</h3>
            <TabPayoutConfig event={event} eventPlayers={eventPlayers} course={course} onUpdated={load} />
          </div>
          <div id="payout-summary" className="border-t border-surface-border pt-6">
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">Payout Summary</h3>
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
          leagueSlug={leagueSlug}
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

      {printAsset && <PrintAssets type={printAsset} event={event} eventPlayers={eventPlayers} tglSelections={tglSelections} orgSlug={orgSlug} leagueSlug={leagueSlug} payoutsByPlayer={payoutsByPlayer} onClose={() => setPrintAsset(null)} />}
    </div>
  )
}

// ─── Export Scores ────────────────────────────────────────────────
async function exportScoresCSV(event, eventPlayers, allScores, course, sideGames = []) {
  const { default: ExcelJS } = await import('exceljs')

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
  const stablefordData = computeStableford(nonGuestEPs, allScores, course)
  const stablefordGrossData = computeStableford(nonGuestEPs, allScores, course, true)
  const blindPartnersData = computeBlindPartners(event, nonGuestEPs, allScores, course)
  const superSkinsResult  = computeSuperSkins(event, nonGuestEPs, allScores, course)
  const { byCategory } = computePayouts(event, nonGuestEPs.length, leaderboards, sideGames, skinsResults, flightCounts, {
    stablefordData, blindPartnersData, superSkinsResult, stablefordGrossData, eventPlayers: nonGuestEPs,
  })

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
  const wb = new ExcelJS.Workbook()

  const ws1 = wb.addWorksheet('Gross')
  ws1.addRows([sheetHeaders, parRow, siRow, ...grossRows])

  const ws2 = wb.addWorksheet('Net')
  ws2.addRows([sheetHeaders, parRow, siRow, ...netRows])

  const ws3 = wb.addWorksheet('Payouts')
  ws3.addRows([payoutHeaders, ...payoutRows])

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `event_${event.event_number}_scores.xlsx`
  a.click()
  URL.revokeObjectURL(url)
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
function TabOverview({ event, eventPlayers, allScores, sideGames, course, conflicts, onUpdated, orgName, orgSlug, onPrintAsset, onGoToTab }) {
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

      <EventDetailsCard
        onEdit={() => setEditModal(true)}
        fields={[
          ...(event.tournament_fee > 0 ? [{ label: 'Entry fee', value: formatMoney(event.tournament_fee), helper: 'Paid by each player' }] : []),
          { label: 'Pot contribution', value: formatMoney(event.entry_fee), helper: 'Per player, toward winnings' },
          { label: 'Format', value: FORMAT_LABELS[event.format] ?? event.format ?? 'Net Stroke Play' },
          { label: 'Holes', value: (event.holes_played ?? 18) === 18 ? '18 (full)' : `${event.holes_played} holes` },
          ...(!event.shotgun_start ? [{ label: 'Tee interval', value: `${event.tee_time_interval_mins ?? 10} min` }] : []),
          { label: 'Start time', value: event.start_time ? formatTime(event.start_time) : '—' },
        ]}
      />

      {event.status === 'upcoming' && (
        <ReadinessCard
          items={buildReadiness({ event, eventPlayers })}
          onAction={key => {
            if (key === 'players' || key === 'flights') onGoToTab?.('Players')
            else scrollToId({ cover: 'cover-photo', description: 'description-field', spots: 'spots-field' }[key] ?? 'public-event')
          }}
        />
      )}

      <ParticipantsCard
        onViewPlayers={() => onGoToTab?.('Players')}
        stats={[
          { label: 'Players', value: nonGuests.length, helper: nonGuests.length !== eventPlayers.length ? `+ ${eventPlayers.length - nonGuests.length} guest${eventPlayers.length - nonGuests.length !== 1 ? 's' : ''}` : undefined },
          { label: 'Total pot', value: formatMoney(event.entry_fee * nonGuests.length), helper: `${nonGuests.length} × ${formatMoney(event.entry_fee)} contribution` },
          ...((event.use_flights ?? false) ? [{ label: 'Flight A', value: flightA }, { label: 'Flight B', value: flightB }] : []),
          ...(event.status !== 'upcoming' ? [{ label: 'Scores entered', value: holesEntered, helper: 'hole entries' }] : []),
        ]}
      />

      <Card id="public-event">
        <CardHeader title="Public event page" subtitle="What players see when they open the event link." />
        <EventPublicFields event={event} onUpdated={onUpdated} />
      </Card>

      <PhotosCard
        galleryNote={event.status === 'upcoming' ? 'Add photos after the round.' : null}
        cover={
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
        }
        gallery={<EventPhotosManager event={event} onUpdated={onUpdated} />}
      />

      {/* Score conflicts */}
      {conflicts.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader
            title={`⚠ Score Conflicts (${conflicts.length})`}
            subtitle="Multiple scorers entered different values for the same hole"
          />
          <div className="space-y-2 mt-1">
            {conflicts.map((c, i) => (
              <div key={i} className="flex items-start justify-between text-sm bg-white border border-red-200 rounded-sm px-3 py-2">
                <div>
                  <span className="font-semibold text-ink">
                    {c.player?.first_name} {c.player?.last_name}
                  </span>
                  <span className="text-ink-muted ml-2">· Hole {c.hole_number}</span>
                </div>
                <div className="text-right text-xs text-ink">
                  <div><span className="text-ink-muted">Was</span> <strong>{c.previous_score}</strong> by <em>{c.previous_entered_by}</em></div>
                  <div><span className="text-red-500">Changed to</span> <strong>{c.new_score}</strong> by <em>{c.entered_by}</em></div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-500 mt-2">Use Edit Scores in the Print & share tab to review and correct the final values.</p>
        </Card>
      )}

      {event.status !== 'complete' && (
        <section id="delete-event" className="flex flex-col gap-3 rounded-sm border border-red-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-base font-bold text-ink">Delete event</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Removes the event, players and scores. This can't be undone.</p>
          </div>
          <Button variant="secondary" className="shrink-0 !border-red-200 !text-red-600 hover:!bg-red-50" onClick={() => setDeleteModal(true)}>
            Delete event
          </Button>
        </section>
      )}

      <EditEventModal open={editModal} onClose={() => setEditModal(false)} event={event} onSaved={onUpdated} />
      <DeleteEventModal open={deleteModal} onClose={() => setDeleteModal(false)} event={event} />
    </div>
  )
}

// ─── Description Editor (markdown bold/italic toolbar) ────────────────────────
function DescriptionEditor({ value, onChange, rows = 5, placeholder = 'Describe the event — format, rules, prizes, anything players should know…' }) {
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
    <div className="border border-surface-highest rounded-sm overflow-hidden focus-within:ring-2 focus-within:ring-fairway-500">
      <div className="flex gap-1 px-2 py-1.5 bg-surface-container border-b border-surface-border">
        <button type="button" onMouseDown={e => { e.preventDefault(); wrap('**') }}
          className="px-2 py-0.5 text-sm font-bold text-ink hover:bg-surface-high rounded"
          aria-label="Bold" title="Bold (**text**)">B</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); wrap('*') }}
          className="px-2 py-0.5 text-sm italic text-ink hover:bg-surface-high rounded"
          aria-label="Italic" title="Italic (*text*)">I</button>
      </div>
      <textarea
        ref={ref}
        className="w-full px-3 py-2 text-sm focus:outline-none bg-white"
        rows={rows}
        placeholder={placeholder}
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
  const [localRules,  setLocalRules]  = useState(event.local_rules ?? '')
  const [spots,       setSpots]       = useState(event.registration_spots ?? '')
  const [sponsors,    setSponsors]    = useState(event.sponsors ?? [])
  const [saving,      setSaving]      = useState(false)
  const [sponsorName, setSponsorName] = useState('')
  const [uploading,   setUploading]   = useState(false)
  const fileRef = useRef(null)

  async function save() {
    setSaving(true)
    const payload = {
      description:        description.trim() || null,
      registration_spots: spots !== '' ? parseInt(spots) : null,
      sponsors:           sponsors.length > 0 ? sponsors : null,
    }
    // Only send local_rules when it changed, so saving other fields keeps working
    // even before the local_rules column has been added to the database.
    const newRules = localRules.trim() || null
    if (newRules !== (event.local_rules?.trim() || null)) payload.local_rules = newRules
    const { error } = await supabase.from('events').update(payload).eq('id', event.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
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
    <div className="space-y-5">
      {/* Description */}
      <div id="description-field">
        <label className="label">Tournament description</label>
        <DescriptionEditor value={description} onChange={setDescription} />
      </div>

      {/* Local rules */}
      <div>
        <label className="label">Local rules <span className="font-normal text-ink-muted">(optional)</span></label>
        <p className="text-xs text-ink-muted mb-1.5">
          Players get a reminder in the scoring app, plus a Local Rules section on the event page. Leave blank for none.
        </p>
        <DescriptionEditor
          value={localRules}
          onChange={setLocalRules}
          rows={4}
          placeholder="e.g. Drops from the cart path are free within one club length. Ground under repair is marked with white lines."
        />
      </div>

      {/* Registration spots + Sponsors */}
      <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
        <div id="spots-field">
          <Input
            label="Registration spots"
            type="number"
            min="1"
            placeholder="e.g. 40"
            value={spots}
            onChange={e => setSpots(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Sponsors</label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Sponsor name"
              value={sponsorName}
              onChange={e => setSponsorName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSponsor())}
            />
            <Button variant="secondary" onClick={addSponsor} type="button">Add</Button>
          </div>
          {sponsors.length === 0 ? (
            <p className="mt-1.5 text-xs text-ink-muted">No sponsors added yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {sponsors.map((s, idx) => (
                <div key={idx} className="bg-surface-container rounded-sm px-3 py-2 border border-surface-border space-y-2">
                  <div className="flex items-center gap-3">
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={s.name} style={{ height: 32, maxWidth: 80, objectFit: 'contain' }} />
                    ) : (
                      <div className="text-xs text-ink-muted w-20 text-center">No logo</div>
                    )}
                    <span className="text-sm font-semibold flex-1">{s.name}</span>
                    <label className="text-xs text-fairway-600 cursor-pointer underline">
                      {uploading ? 'Uploading…' : 'Upload logo'}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => uploadSponsorLogo(e.target.files[0], idx)} />
                    </label>
                    <Button type="button" variant="ghost" size="sm" iconOnly label="Remove sponsor" className="hover:!text-red-600" onClick={() => removeSponsor(idx)}>✕</Button>
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
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-2 border-t border-surface-border pt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        <span className="text-xs text-ink-muted">Changes save to the public page</span>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save public page'}</Button>
      </div>
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
      <div className="flex w-full max-w-5xl mx-auto my-4 bg-white rounded-sm overflow-hidden shadow-2xl">

        {/* Sidebar — player list */}
        <div className="w-56 shrink-0 border-r border-surface-border flex flex-col" style={{ background: '#f8f9fa' }}>
          <div className="px-4 py-3 border-b border-surface-border" style={{ background: '#1B4332' }}>
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
                      className="w-full text-left px-3 py-2.5 border-b border-surface-border transition-colors"
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
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border" style={{ background: '#1B4332', borderBottom: '2px solid #D4AF37' }}>
            <div>
              <p style={{ fontFamily: "'Manrope',sans-serif", color: '#D4AF37', fontWeight: 700, fontSize: '1rem' }}>
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
              <p className="text-sm text-ink-muted text-center py-8">No course data available.</p>
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
                        <tr className="border-t border-surface-border">
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
                                  className="w-10 text-center font-bold text-sm border border-surface-border rounded focus:outline-none focus:border-fairway-500"
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
                        <tr className="border-t border-surface-border">
                          <td className="px-2 py-1 font-semibold" style={{ color: '#6c757d' }}>Putts</td>
                          {holeGroup.map(h => (
                            <td key={h} className="px-1 py-1 text-center">
                              <input
                                type="number"
                                min="0" max="10"
                                value={getVal(h, 'putts')}
                                onChange={e => setVal(h, 'putts', e.target.value)}
                                className="w-10 text-center text-xs border border-surface-border rounded focus:outline-none focus:border-fairway-500"
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
          <div className="border-t border-surface-border px-5 py-3 flex items-center justify-between bg-surface-container">
            <p className="text-xs text-ink-muted">Scores are saved per player. Switch players using the sidebar.</p>
            <Button onClick={savePlayer} loading={saving}>Save Scores</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Handicap Modal ─────────────────────────────────────────────
function EditHandicapModal({ ep, course, onClose, onSaved }) {
  // Resolve tee-specific values for this player's assigned tee (computed before state)
  // Par is course-level only; slope/rating are per-tee
  const activeTee = ep.tee && course?.tees?.length
    ? (course.tees.find(t => t.name?.toLowerCase() === ep.tee?.toLowerCase()) ?? null)
    : null
  const chSlope  = activeTee?.slope  ?? course?.slope  ?? null
  const chRating = activeTee?.rating ?? course?.rating ?? null
  const chPar    = course?.par ?? null
  const teeName  = ep.tee ?? null

  // handicap_index is a NOT NULL column — 0 is the placeholder used for
  // "not entered yet" (see AddPlayerModal), so treat it the same as blank
  // here rather than showing a misleading 0.0 scratch handicap.
  const hasHi    = ep.handicap_index != null && ep.handicap_index !== 0
  const hiInit   = hasHi ? ep.handicap_index : ''
  const hasCh    = ep.course_handicap != null && ep.course_handicap !== 0
  const chInit   = (chSlope && chRating && chPar && hasHi)
    ? Math.round((parseFloat(hiInit) * chSlope / 113) + (chRating - chPar))
    : (hasCh ? ep.course_handicap : '')

  const [hi, setHi] = useState(String(hiInit))
  const [ch, setCh] = useState(String(chInit))
  const [autoCalc, setAutoCalc] = useState(true)
  const [saving, setSaving] = useState(false)

  // Match play course handicap — optional override, independent of any fixed
  // percentage. NULL means "same as stroke play". Left open so each tournament
  // can apply whatever allowance/adjustment it wants, entered directly.
  const [sameForMatchPlay, setSameForMatchPlay] = useState(ep.match_play_course_handicap == null)
  const [matchCh, setMatchCh] = useState(ep.match_play_course_handicap != null ? String(ep.match_play_course_handicap) : '')

  // Auto-calculate CH from HI whenever HI changes and autoCalc is on
  const calcCh = useCallback((hiVal) => {
    if (!chSlope || !chRating || !chPar) return ''
    return Math.round((parseFloat(hiVal) * chSlope / 113) + (chRating - chPar))
  }, [chSlope, chRating, chPar])

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
    const hiVal = hi !== '' ? parseFloat(hi) : 0
    if (hi !== '' && isNaN(hiVal)) { toast.error('Invalid handicap index'); setSaving(false); return }
    const chVal = ch !== '' ? parseInt(ch, 10) : null
    const matchChVal = sameForMatchPlay ? null : (matchCh !== '' ? parseInt(matchCh, 10) : null)
    const { error } = await supabase
      .from('event_players')
      .update({
        handicap_index: hiVal,
        adjusted_handicap_index: hiVal,
        course_handicap: chVal,
        match_play_course_handicap: matchChVal,
      })
      .eq('id', ep.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Handicap updated')
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-ink">Edit Handicap</h2>
        <p className="text-sm text-ink">{ep.player?.first_name} {ep.player?.last_name}</p>

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
              <label className="flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer">
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
          {autoCalc && chSlope && (
            <p className="text-xs text-ink-muted mt-1">
              {teeName && <span className="font-medium">{teeName} tee — </span>}
              ({hi} × {chSlope} / 113) + ({chRating} − {chPar})
            </p>
          )}
        </div>

        <div className="border-t border-surface-border pt-3">
          <label className="flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={sameForMatchPlay}
              onChange={e => setSameForMatchPlay(e.target.checked)}
            />
            Same handicap for match play
          </label>
          {!sameForMatchPlay && (
            <div>
              <label className="label">Match Play Course Handicap</label>
              <input
                type="number"
                value={matchCh}
                onChange={e => setMatchCh(e.target.value)}
                className="input"
                placeholder="e.g. 12"
              />
              <p className="text-xs text-ink-muted mt-1">
                Used only for match play scoring in this event — stroke play keeps the Course Handicap above.
              </p>
            </div>
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
function TabPostRound({ event, eventPlayers, allScores, course, sideGames, orgName, orgLogoUrl, orgSlug, leagueSlug, onPrintAsset, onUpdated, tglTeams, tglMembers, tglSelections, hasTgl }) {
  const [scoreEditor, setScoreEditor] = useState(false)
  const [emailKind, setEmailKind] = useState(null) // 'pre' | 'post'
  const hasSkins = (event?.side_game_options ?? []).some(s => s.startsWith('skins'))
  const eventFormats = event?.formats ?? (event?.format ? [event.format] : [])
  const hasMatchPlay = eventFormats.includes('match_points') || eventFormats.includes('ryder_cup')
  const leagueName = event.league?.name ?? orgName
  const logoUrl = event.league?.logo_url ?? orgLogoUrl ?? null
  const hasOptInGames = [...new Set((event?.side_game_options ?? []).map(k => k.replace(/_[ab]$/, '')))]
    .some(k => isBuyInEnabled(event, k) && optInAmount(event, k) != null)
  const hasBuyInGames = [...new Set((event?.side_game_options ?? []).map(k => k.replace(/_[ab]$/, '')))]
    .some(k => isBuyInEnabled(event, k))

  const isComplete = event.status === 'complete'
  const hasScores = (allScores ?? []).length > 0

  const preRoundPanel = (
    <div id="print-assets">
      <SectionCard eyebrow="Step 1 · Before the round" title="Pre-round" done={isComplete}>
        <HeroEmailCard
          stacked={isComplete}
          title="Tournament details email"
          description="Event info, groups, tee times and matchups"
          onPreview={() => setEmailKind('pre')}
          onCopy={() => setEmailKind('pre')}
        />
        <h3 className="mb-1 text-[11px] font-bold uppercase tracking-widest text-ink-muted">Print</h3>
        <ExportRow
          stacked={isComplete}
          title="Tee sheet" tag="PRINT"
          description="Groups, tee times and starting holes"
          actions={<ActionButton onClick={() => onPrintAsset('tee_sheet')}>Preview</ActionButton>}
        />
        <ExportRow
          stacked={isComplete}
          id="export-scorecards"
          title="Scorecards" tag="PNG"
          description="Printable scorecards with QR codes, one per group"
          actions={
            <ExportScorecardsButton
              event={event}
              eventPlayers={eventPlayers}
              course={course}
              orgName={leagueName}
              orgSlug={orgSlug}
              orgLogoUrl={logoUrl}
            />
          }
        />
        {hasMatchPlay && (
          <ExportRow
          stacked={isComplete}
            title="Match play cards" tag="PNG"
            description="Blank paper cards to track hole-by-hole match results"
            actions={<ExportMatchPlayCardsButton event={event} eventPlayers={eventPlayers} course={course} />}
          />
        )}
        <ExportRow
          stacked={isComplete}
          title="Cart & side game signs" tag="PRINT"
          description="Cart signs and side game cards for the round"
          actions={
            <>
              <ActionButton onClick={() => onPrintAsset('cart_signs')}>Cart signs</ActionButton>
              <ActionButton onClick={() => onPrintAsset('cards')}>Side game signs</ActionButton>
              {hasOptInGames && (
                <ActionButton onClick={() => onPrintAsset('checkin_qr')}>Check-in QR</ActionButton>
              )}
              {hasBuyInGames && (
                <ActionButton onClick={() => onPrintAsset('opt_in_rosters')}>Opt-in rosters</ActionButton>
              )}
            </>
          }
        />
      </SectionCard>
    </div>
  )

  const scoringPanel = (
    <div id="edit-scores">
      <SectionCard
        eyebrow={isComplete ? 'Scores & handicaps' : 'Step 2 · During the round'}
        title="Scoring"
      >
        <ActionButton className="mb-4 w-full" onClick={() => setScoreEditor(true)}>
          {hasScores ? 'Edit scores' : 'Enter scores'}
        </ActionButton>
        <ExportRow
          id="scores-csv"
          title="Scores export" tag="CSV"
          description="All player scores, net, gross — one row per player per hole"
          actions={
            <ActionButton
              icon="download" iconOnly label="Download scores export (CSV)"
              disabled={!hasScores}
              onClick={() => exportScoresCSV(event, eventPlayers, allScores, course, sideGames)}
            >
              Download
            </ActionButton>
          }
        />
        <ExportRow
          title="Handicap entry" tag="XLSX"
          description="USGA adjusted scores per hole — amber cells indicate capped scores"
          actions={
            <ActionButton
              icon="download" iconOnly label="Download handicap entry (XLSX)"
              disabled={!hasScores}
              onClick={() => exportHandicapCSV(event, eventPlayers, allScores, course)}
            >
              Download
            </ActionButton>
          }
        />
        {!hasScores && <p className="mt-1 text-xs text-ink-muted">Available once scores are entered</p>}
      </SectionCard>
    </div>
  )

  const resultsPanel = isComplete ? (
    <div id="scores-export">
      <SectionCard eyebrow="Share results" title="Results">
        <HeroEmailCard
          title="Results email"
          description="Winners, payouts and match results"
          onPreview={() => setEmailKind('post')}
          onCopy={() => setEmailKind('post')}
        />
        <ExportRow
          title="Tournament results" tag="PNG"
          description="Full results card — scoring, skins, long drive, CTP"
          actions={
            <ExportResultsButton
              event={event}
              eventPlayers={eventPlayers}
              allScores={allScores}
              course={course}
              sideGames={sideGames ?? []}
              orgName={leagueName}
              orgLogoUrl={logoUrl}
            />
          }
        />
        <ExportRow
          title="Payouts per player" tag="PNG"
          description="Per-player payout totals with category breakdown"
          actions={<ActionButton onClick={() => onPrintAsset('payouts_per_player')}>Preview</ActionButton>}
        />
        {hasSkins && (
          <ExportRow
            title="Skins by flight" tag="PNG"
            description="Hole-by-hole skins results by flight, sorted by net score"
            actions={
              <ExportSkinsGridButton
                event={event}
                eventPlayers={eventPlayers}
                allScores={allScores}
                course={course}
                orgName={leagueName}
                orgLogoUrl={logoUrl}
              />
            }
          />
        )}
        {hasTgl && (
          <ExportRow
            title="Team play standings" tag="PNG"
            description="Team participants and points totals for this event"
            actions={
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
            }
          />
        )}
      </SectionCard>
    </div>
  ) : (
    <LockedSectionCard
      eyebrow="Step 3 · After the round"
      title="Results"
      note="Unlocks when the event is marked complete"
      items={[
        'Results email',
        'Tournament results',
        'Payouts per player',
        ...(hasSkins ? ['Skins by flight'] : []),
        ...(hasTgl ? ['Team play standings'] : []),
      ]}
    />
  )

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <div className="grid items-start gap-6 min-[900px]:grid-cols-3">
        <div className="space-y-6 min-[900px]:col-span-2">
          {isComplete ? resultsPanel : preRoundPanel}
        </div>
        <div className="space-y-6">
          {scoringPanel}
          {isComplete ? preRoundPanel : resultsPanel}
        </div>
      </div>

      {emailKind && (
        <EventEmailModal
          kind={emailKind}
          event={event}
          eventPlayers={eventPlayers}
          allScores={allScores}
          course={course}
          sideGames={sideGames}
          leagueName={leagueName}
          logoUrl={logoUrl}
          orgSlug={orgSlug}
          leagueSlug={leagueSlug}
          onClose={() => setEmailKind(null)}
        />
      )}

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
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className={`inline-flex min-h-[44px] items-center gap-2 px-4 rounded-sm border border-surface-highest bg-white cursor-pointer text-sm font-semibold text-ink transition-colors hover:bg-surface-dim ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4"/></svg>
          {uploading ? 'Uploading…' : 'Upload photos'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {photos.length > 0 && (
          <Button variant="secondary" icon="download" onClick={downloadAll}>Download all ({photos.length})</Button>
        )}
      </div>
      <p className="text-xs text-ink-muted">JPG, PNG, HEIC · multiple files</p>

      {/* Photo grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo, i) => (
            <div key={i} className="relative group rounded-sm overflow-hidden border border-surface-border">
              <div className="aspect-square">
                <img src={photo.url} alt={photo.caption ?? `Event photo ${i + 1}`} className="w-full h-full object-cover" />
              </div>
              {(photo.caption || photo.uploaded_by) && (
                <div className="px-2 py-1.5 bg-white">
                  {photo.caption && <p className="text-xs font-semibold text-ink truncate">{photo.caption}</p>}
                  {photo.uploaded_by && <p className="text-xs text-ink-muted truncate">{photo.uploaded_by}</p>}
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
        <p className="text-sm text-ink-muted">No photos yet — upload some from the event.</p>
      )}
    </div>
  )
}

// ─── Tab: Players & Flights ────────────────────────────────────────
function TabFlights({ event, eventPlayers, course, allPlayers, onUpdated, registrationSlot = null, addModal, setAddModal, upgradePrompt, setUpgradePrompt }) {
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

  const nonGuests = eventPlayers.filter(e => !e.is_guest).sort(epAlpha)
  const flightA = nonGuests.filter(e => e.flight === 'A')
  const flightB = nonGuests.filter(e => e.flight === 'B')

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

  const sortedRoster = [...eventPlayers].sort(epAlpha)
  const atPlayerLimit = atLimit(orgTier, 'players', eventPlayers.length)
  const tiles = useFlights ? playerTiles(eventPlayers) : playerTiles(eventPlayers).slice(0, 1)
  const teePanels = useFlights
    ? ['A', 'B'].map(flight => {
        const field = `tee_flight_${flight.toLowerCase()}`
        return {
          key: flight,
          title: `Flight ${flight}`,
          count: (flight === 'A' ? flightA : flightB).length,
          value: event[field] ?? '',
          onChange: v => saveTeeAssignment(field, v, flight),
        }
      })
    : [{
        key: 'all',
        title: 'All players',
        count: eventPlayers.length,
        value: event.tee_flight_a ?? '',
        onChange: v => saveTeeAssignment('tee_flight_a', v, null),
      }]

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

      {atPlayerLimit && (
        <div className="flex justify-end">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-status-upcoming-bg text-status-upcoming-text">
            {eventPlayers.length} / {getLimit(orgTier, 'players')} players — {TIER_LABELS[nextTier(orgTier)]} plan required
          </span>
        </div>
      )}

      <StatTiles tiles={tiles} />

      {registrationSlot}

      {courseTees.length > 0 && (
        <FlightsTeesCard panels={teePanels} tees={courseTees} useFlights={useFlights} />
      )}

      <RosterCard
        players={sortedRoster}
        tees={courseTees}
        useFlights={useFlights}
        onSetFlight={(ep, value) => overrideFlight(ep.id, value)}
        onSetTee={(ep, value) => overrideTee(ep.id, value)}
        onEditHi={ep => setEditingEp(ep)}
        onRemove={ep => removePlayer(ep.id)}
      />

      <AddPlayerModal
        open={addModal}
        onClose={() => setAddModal(false)}
        eventId={event.id}
        available={available}
        course={course}
        defaultTeeName={event.tee_flight_a ?? null}
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

function AddPlayerModal({ open, onClose, eventId, available, course, defaultTeeName, useFlights, useHandicaps = true, onSaved }) {
  // bulk: { [playerId]: { hi, flight, checked } }
  const [bulk,    setBulk]    = useState({})
  const [saving,  setSaving]  = useState(false)
  const [search,  setSearch]  = useState('')

  // Resolve tee-specific slope/rating/par for CH calculation
  // Par is course-level only; slope/rating are per-tee
  const activeTee = defaultTeeName && course?.tees?.length
    ? (course.tees.find(t => t.name?.toLowerCase() === defaultTeeName?.toLowerCase()) ?? null)
    : null
  const chSlope  = activeTee?.slope  ?? course?.slope  ?? null
  const chRating = activeTee?.rating ?? course?.rating ?? null
  const chPar    = course?.par ?? null

  useEffect(() => {
    if (!open) { setBulk({}); setSearch('') }
  }, [open])

  function toggle(playerId) {
    setBulk(prev => {
      const next = { ...prev }
      if (next[playerId]) {
        delete next[playerId]
      } else {
        next[playerId] = { hi: '', flight: '', autoHC: true, ch: '' }
      }
      return next
    })
  }

  function setField(playerId, field, value) {
    setBulk(prev => {
      const current = prev[playerId] ?? { hi: '', flight: '', autoHC: true, ch: '' }
      const updated = { ...current, [field]: value }
      // Recompute auto CH when HI changes
      if (field === 'hi' && updated.autoHC && chSlope && chRating && chPar) {
        const hi = parseFloat(value)
        if (!isNaN(hi)) {
          updated.ch = Math.round((hi * chSlope / 113) + (chRating - chPar))
        } else {
          updated.ch = ''
        }
      }
      // When toggling autoHC on, recompute
      if (field === 'autoHC' && value === true && chSlope && chRating && chPar) {
        const hi = parseFloat(current.hi)
        if (!isNaN(hi)) {
          updated.ch = Math.round((hi * chSlope / 113) + (chRating - chPar))
        }
      }
      return { ...prev, [playerId]: updated }
    })
  }

  function selectAll() {
    const next = {}
    available.forEach(p => { next[p.id] = bulk[p.id] ?? { hi: '', flight: '', autoHC: true, ch: '' } })
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
  // HI/CH are optional — a blank value is always valid (filled in later via the
  // upload feature); if a value IS entered, it must be a well-formed number.
  const allValid = selected.length > 0 && selected.every(([, v]) =>
    !useHandicaps ||
    v.flight === 'guest' ||
    (
      (v.hi === '' || !isNaN(parseFloat(v.hi))) &&
      (v.autoHC || v.ch === '' || !isNaN(parseInt(v.ch, 10)))
    )
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
        // HI/CH are optional — blank fields are filled in later (e.g. via the
        // upload feature) rather than blocking the add. handicap_index is a
        // NOT NULL column, so a blank HI is stored as 0 (same placeholder the
        // guest/no-handicap insert paths above already use); course_handicap
        // is nullable and left null when blank.
        const hiVal = hi !== '' ? parseFloat(hi) : 0
        let course_handicap = null
        if (hi !== '' && autoHC && chSlope && chRating && chPar) {
          course_handicap = Math.round((hiVal * chSlope / 113) + (chRating - chPar))
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
          <p className="text-sm text-ink-muted">{available.length} players available · {selected.length} selected</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={selectAll}>Select All</Button>
            <span className="text-surface-outline">|</span>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
          </div>
        </div>

        {available.length === 0 ? (
          <p className="text-sm text-ink-muted py-4 text-center">All players from the roster are already on this event.</p>
        ) : (
          <div className="border border-surface-border rounded-sm overflow-hidden">
            {/* Sticky search */}
            <div className="sticky top-0 z-10 bg-white border-b border-surface-border px-3 py-2">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <div className="max-h-80 overflow-y-auto divide-y divide-surface-border">
            {filtered.length === 0 && (
              <p className="text-sm text-ink-muted py-4 text-center">No players match "{search}"</p>
            )}
            {filtered.map(p => {
              const checked = !!bulk[p.id]
              const vals    = bulk[p.id] ?? { hi: '', flight: '' }
              return (
                <div key={p.id} className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${checked ? 'bg-fairway-50' : 'hover:bg-surface-dim'}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.id)}
                    className="accent-fairway-600 w-4 h-4 shrink-0"
                  />
                  <span className="text-sm font-medium text-ink flex-1 min-w-0 truncate">
                    {p.first_name} {p.last_name}
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
                          className={`text-xs shrink-0 px-2 py-1 rounded-full font-semibold border ${vals.flight === 'guest' ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-surface-high text-ink-muted border-surface-border'}`}
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
                          />
                          {vals.autoHC ? (
                            <span
                              className="text-xs text-ink-muted w-16 shrink-0 cursor-pointer hover:text-fairway-700"
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
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setField(p.id, 'autoHC', !vals.autoHC)}
                            className={`text-xs shrink-0 px-1.5 py-1 rounded font-medium ${vals.autoHC ? 'text-fairway-600 bg-fairway-50' : 'text-status-upcoming-text bg-status-upcoming-bg'}`}
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
function MatchPairingsManager({ event, eventId, eventPlayers, allScores = [], course = null, onUpdated }) {
  const [pairings,    setPairings]    = useState([])
  const [playerAId,   setPlayerAId]   = useState('')
  const [playerBId,   setPlayerBId]   = useState('')
  const [matchNumber, setMatchNumber] = useState(1)
  const [saving,      setSaving]      = useState(false)
  const [teamAName,   setTeamAName]   = useState(event?.ryder_cup_teams?.a ?? '')
  const [teamBName,   setTeamBName]   = useState(event?.ryder_cup_teams?.b ?? '')
  const [savingTeams, setSavingTeams] = useState(false)
  const isRyderCup = (event?.formats ?? []).includes('ryder_cup')

  // Tie rules: when on, a match that is all square after 18 holes must get a winner
  // (decided by the tiebreakers below, or by an admin's manual pick on that match).
  const [requireWinner, setRequireWinner] = useState(!!event?.match_rules?.requireWinner)
  const [tiePreset,     setTiePreset]     = useState(event?.match_rules?.preset ?? 'full')
  const [savingRules,   setSavingRules]   = useState(false)
  useEffect(() => {
    setRequireWinner(!!event?.match_rules?.requireWinner)
    setTiePreset(event?.match_rules?.preset ?? 'full')
  }, [event?.match_rules])

  async function saveTieRules() {
    setSavingRules(true)
    const rules = requireWinner ? { requireWinner: true, preset: tiePreset } : null
    const { error } = await supabase.from('events').update({ match_rules: rules }).eq('id', eventId)
    setSavingRules(false)
    if (error) { toast.error(error.message); return }
    toast.success(requireWinner ? 'Tie rules saved: every match will have a winner' : 'Tie rules saved: ties are halved')
    onUpdated?.()
  }

  // Drag-and-drop reordering of the Current Match Pairings list — dragging a
  // row updates match_number (order) for all pairings, not player selection.
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [activeDragPairingId, setActiveDragPairingId] = useState(null)

  function handlePairingDragStart({ active }) { setActiveDragPairingId(active.id) }

  async function handlePairingDragEnd({ active, over }) {
    setActiveDragPairingId(null)
    if (!over || active.id === over.id) return
    const oldIndex = pairings.findIndex(p => p.id === active.id)
    const newIndex = pairings.findIndex(p => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(pairings, oldIndex, newIndex)
    setPairings(reordered)
    await Promise.all(reordered.map((p, i) =>
      supabase.from('match_pairings').update({ match_number: i + 1 }).eq('id', p.id)
    ))
    await loadPairings()
  }

  async function loadPairings() {
    const { data } = await supabase
      .from('match_pairings')
      .select('*, playerA:players!player_a_id(first_name,last_name), playerB:players!player_b_id(first_name,last_name)')
      .eq('event_id', eventId)
      .order('match_number')
    setPairings(data ?? [])
  }

  useEffect(() => { loadPairings() }, [eventId])

  // Live result per pairing, using the event's tie rules (and any manual winners)
  const resultsById = useMemo(() => {
    if (!course || pairings.length === 0 || allScores.length === 0) return {}
    const res = computeMatchPoints(eventPlayers, allScores, course, pairings, event?.match_rules)
    return Object.fromEntries(res.pairings.map(r => [r.pairingId, r]))
  }, [eventPlayers, allScores, course, pairings, event?.match_rules])
  const needWinnerCount = Object.values(resultsById).filter(r => r.needsWinner).length

  async function setManualWinner(pairingId, playerId, note) {
    const { error } = await supabase.from('match_pairings')
      .update({ winner_player_id: playerId || null, winner_note: playerId ? (note || null) : null })
      .eq('id', pairingId)
    if (error) { toast.error(error.message); return }
    await loadPairings()
    toast.success(playerId ? 'Winner saved' : 'Manual winner cleared')
  }

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

  // Alphabetical (first name, then last name) rather than handicap order — easier to scan in the dropdowns
  const sortedUnpaired = [...unpairedPlayers].sort((a, b) => {
    const nameA = `${a.player?.first_name ?? ''} ${a.player?.last_name ?? ''}`.trim().toLowerCase()
    const nameB = `${b.player?.first_name ?? ''} ${b.player?.last_name ?? ''}`.trim().toLowerCase()
    return nameA.localeCompare(nameB)
  })

  // Course handicap lookup by player id, used to show relative match-play strokes
  const epByPlayerId = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep]))
  function relativeStrokes(playerAId, playerBId) {
    const chA = matchCH(epByPlayerId[playerAId]) ?? 0
    const chB = matchCH(epByPlayerId[playerBId]) ?? 0
    const baseline = Math.min(chA, chB)
    return { relA: Math.max(0, chA - baseline), relB: Math.max(0, chB - baseline) }
  }

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
    if (error) {
      // 23503 = foreign key violation: wagers still reference this match
      toast.error(error.code === '23503'
        ? 'This match has bets on it, so it can\'t be removed. Remove or settle its bets on the wager board first.'
        : error.message)
      return
    }
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
    return `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''} (CH: ${matchCH(ep) ?? '—'})`
  }

  return (
    <div className="space-y-4">
      {/* Optional match play team names — blank shows no team label anywhere */}
      <div className="bg-white rounded-sm border border-surface-border p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">Team Names <span className="font-normal text-ink-muted">(optional)</span></h3>
            <p className="text-xs text-ink-muted mt-0.5">Labels the two sides of each match on the leaderboard and results. Leave blank to show no team label.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Team A</label>
              <input className="input w-full" value={teamAName} onChange={e => setTeamAName(e.target.value)} placeholder="e.g. USA" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Team B</label>
              <input className="input w-full" value={teamBName} onChange={e => setTeamBName(e.target.value)} placeholder="e.g. Europe" />
            </div>
          </div>
          <Button type="button" size="sm" onClick={saveTeamNames} loading={savingTeams}>
            {savingTeams ? 'Saving…' : 'Save team names'}
          </Button>
      </div>

      {/* Tie rules */}
      <div className="bg-white rounded-sm border border-surface-border p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Tie Rules</h3>
          <p className="text-xs text-ink-muted mt-0.5">What happens when a match is all square after 18 holes.</p>
        </div>
        <label className="flex items-start gap-2 text-sm text-ink cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={requireWinner} onChange={e => setRequireWinner(e.target.checked)} />
          <span>
            Every match must have a winner
            <span className="block text-xs text-ink-muted">Off: a tied match is halved (½ point each). On: a tie is broken as set below.</span>
          </span>
        </label>
        {requireWinner && (
          <div className="pl-6 space-y-2">
            <label className="block text-xs font-medium text-ink">Tiebreaker</label>
            <select className="input w-full" value={tiePreset} onChange={e => setTiePreset(e.target.value)}>
              {Object.entries(TIEBREAK_PRESETS).map(([key, p]) => (
                <option key={key} value={key}>{p.label}</option>
              ))}
            </select>
            <p className="text-xs text-ink-muted">
              Steps run in the order shown; the first one that separates the two players decides the match. Net scores include the match's handicap strokes.
              {tiePreset === 'putts' && ' Putts only count if putts were entered for both players. A putt-off is played in person, so the match then waits for you to pick the winner.'}
              {' '}You can always pick a winner by hand on any tied match below, which overrides the tiebreaker.
            </p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={saveTieRules} loading={savingRules}>Save Tie Rules</Button>
          {needWinnerCount > 0 && (
            <span className="text-xs font-semibold text-status-upcoming-text bg-status-upcoming-bg border border-surface-border rounded-full px-2.5 py-1">
              {needWinnerCount} match{needWinnerCount > 1 ? 'es' : ''} need{needWinnerCount > 1 ? '' : 's'} a winner
            </span>
          )}
        </div>
      </div>

      {/* Current pairings — drag to reorder match number */}
      <div className="bg-white rounded-sm border border-surface-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-container border-b border-surface-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Current Match Pairings</h3>
            {pairings.length > 1 && <p className="text-xs text-ink-muted mt-0.5">Drag to reorder</p>}
          </div>
          {pairings.length > 0 && (
            <Button type="button" variant="secondary" size="sm" onClick={renumberAll}>Renumber</Button>
          )}
        </div>
        {pairings.length === 0 ? (
          <p className="px-4 py-4 text-sm text-ink-muted">No pairings assigned yet.</p>
        ) : (
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragStart={handlePairingDragStart} onDragEnd={handlePairingDragEnd}>
            <SortableContext items={pairings.map(p => p.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-surface-border">
                {pairings.map(p => {
                  const { relA, relB } = relativeStrokes(p.player_a_id, p.player_b_id)
                  return (
                    <SortablePairingRow key={p.id} pairing={p} relA={relA} relB={relB} result={resultsById[p.id]} onSetWinner={setManualWinner} onRemove={() => deletePairing(p.id)} />
                  )
                })}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeDragPairingId ? (() => {
                const p = pairings.find(pp => pp.id === activeDragPairingId)
                if (!p) return null
                const { relA, relB } = relativeStrokes(p.player_a_id, p.player_b_id)
                return (
                  <div className="bg-white border-2 border-fairway-600 rounded-sm px-4 py-3 shadow-xl">
                    <PairingRowLabel pairing={p} relA={relA} relB={relB} />
                  </div>
                )
              })() : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Add pairing form */}
      {eventPlayers.length >= 2 && (
        <div className="bg-white rounded-sm border border-surface-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-container border-b border-surface-border">
            <h3 className="text-sm font-semibold text-ink">Add Pairing</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">{isRyderCup ? (teamAName || 'Team A') : 'Player A'}</label>
                <select
                  className="input w-full"
                  value={playerAId}
                  onChange={e => setPlayerAId(e.target.value)}
                >
                  <option value="">Select player…</option>
                  {sortedUnpaired
                    .filter(ep => ep.player_id !== playerBId)
                    .map(ep => (
                      <option key={ep.player_id} value={ep.player_id}>{playerName(ep)}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink mb-1">{isRyderCup ? (teamBName || 'Team B') : 'Player B'}</label>
                <select
                  className="input w-full"
                  value={playerBId}
                  onChange={e => setPlayerBId(e.target.value)}
                >
                  <option value="">Select player…</option>
                  {sortedUnpaired
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
        <p className="text-sm text-ink-muted text-center">All players have been paired.</p>
      )}
    </div>
  )
}

function PairingRowLabel({ pairing: p, relA, relB }) {
  return (
    <div className="text-sm text-ink">
      <span className="font-semibold text-blue-700">
        {p.playerA?.first_name} {p.playerA?.last_name}{relA > 0 ? ` (${relA})` : ''}
      </span>
      {' '}
      <span className="text-ink-muted">vs</span>
      {' '}
      <span className="font-semibold text-purple-700">
        {p.playerB?.first_name} {p.playerB?.last_name}{relB > 0 ? ` (${relB})` : ''}
      </span>
      <span className="ml-3 text-xs text-ink-muted">Match #{p.match_number}</span>
    </div>
  )
}

function SortablePairingRow({ pairing, relA, relB, result, onSetWinner, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pairing.id })
  const [note, setNote] = useState(pairing.winner_note ?? '')
  useEffect(() => { setNote(pairing.winner_note ?? '') }, [pairing.winner_note])
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  const nameA = `${pairing.playerA?.first_name ?? ''} ${pairing.playerA?.last_name ?? ''}`.trim()
  const nameB = `${pairing.playerB?.first_name ?? ''} ${pairing.playerB?.last_name ?? ''}`.trim()
  const tied = result?.tiedAfter18
  const tb = result?.tiebreak
  const winnerName = result?.winner === 'A' ? nameA : result?.winner === 'B' ? nameB : null
  return (
    <div ref={setNodeRef} style={style} className="px-4 py-3 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span {...attributes} {...listeners} className="cursor-grab text-surface-outline hover:text-ink-muted select-none shrink-0" title="Drag to reorder">⠿</span>
          <PairingRowLabel pairing={pairing} relA={relA} relB={relB} />
        </div>
        <Button size="sm" variant="danger" onClick={onRemove}>Remove</Button>
      </div>

      {tied && (
        <div className="mt-2 ml-7 rounded-sm border border-surface-border bg-surface-container px-3 py-2 space-y-2">
          <div className="text-xs">
            {result.needsWinner && (
              <span className="font-semibold text-status-upcoming-text">
                {result.needsPuttOff
                  ? 'All square after the tiebreakers. Play the putt-off, then pick the winner below.'
                  : 'All square after 18. A winner is needed. Pick one below.'}
              </span>
            )}
            {!result.needsWinner && tb && tb.by === 'manual' && (
              <span className="font-semibold text-status-active-text">Winner: {winnerName} (decided by admin)</span>
            )}
            {!result.needsWinner && tb && tb.by !== 'manual' && (
              <span className="font-semibold text-status-active-text">
                Winner: {winnerName} on tiebreak ({tb.label}{tb.unit === 'net' ? ' (net)' : ''}: {result.winner === 'A' ? tb.valueA : tb.valueB} vs {result.winner === 'A' ? tb.valueB : tb.valueA})
              </span>
            )}
            {!result.needsWinner && !tb && <span className="font-semibold text-ink">All square after 18. Halved (½ point each).</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-ink-muted">Winner</label>
            <select
              className="input text-xs"
              value={pairing.winner_player_id ?? ''}
              onChange={e => onSetWinner(pairing.id, e.target.value, note)}
            >
              <option value="">Use tiebreaker rules</option>
              <option value={pairing.player_a_id}>{nameA}</option>
              <option value={pairing.player_b_id}>{nameB}</option>
            </select>
            {pairing.winner_player_id && (
              <input
                className="input text-xs flex-1 min-w-[160px]"
                placeholder="Reason (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                onBlur={() => note !== (pairing.winner_note ?? '') && onSetWinner(pairing.id, pairing.winner_player_id, note)}
              />
            )}
          </div>
        </div>
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
      <div className="bg-white rounded-sm border border-surface-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-ink">Team Names</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Team A</label>
            <input className="input w-full" value={teamAName} onChange={e => setTeamAName(e.target.value)} placeholder="e.g. MIGC" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Team B</label>
            <input className="input w-full" value={teamBName} onChange={e => setTeamBName(e.target.value)} placeholder="e.g. Westside Eagles" />
          </div>
        </div>
      </div>

      {/* Player assignments */}
      <div className="bg-white rounded-sm border border-surface-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-container border-b border-surface-border">
          <h3 className="text-sm font-semibold text-ink">Assign Players to Teams</h3>
        </div>
        <div className="divide-y divide-surface-border">
          {eventPlayers.map(ep => {
            const side = sides[ep.player_id]
            return (
              <div key={ep.player_id} className="flex items-center justify-between px-4 py-3">
                <div className="text-sm font-medium text-ink">
                  {playerName(ep)}
                  <span className="text-xs text-ink-muted ml-2">CH {matchCH(ep) ?? '—'}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSide(ep.player_id, 'A')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-sm border transition-colors ${side === 'A' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-ink-muted border-surface-border hover:border-blue-300'}`}
                  >
                    {teamAName || 'Team A'}
                  </button>
                  <button
                    onClick={() => setSide(ep.player_id, 'B')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-sm border transition-colors ${side === 'B' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-ink-muted border-surface-border hover:border-purple-300'}`}
                  >
                    {teamBName || 'Team B'}
                  </button>
                  {side && (
                    <button onClick={() => setSide(ep.player_id, null)} className="text-xs text-ink-muted hover:text-red-500 px-1">✕</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {unassigned.length > 0 && (
        <p className="text-xs text-status-upcoming-text font-medium">⚠ {unassigned.length} player{unassigned.length !== 1 ? 's' : ''} not yet assigned to a team</p>
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

  // Tap-to-move alternative to drag-and-drop — the drag handle is awkward on touch,
  // so every card also gets a "Move to" select that jumps straight to a target group.
  function moveToContainer(ep, fromKey, toKey) {
    if (!toKey || fromKey === toKey) return
    setContainers(prev => {
      const next = {}
      for (const k of Object.keys(prev)) next[k] = [...prev[k]]
      next[fromKey] = next[fromKey].filter(m => m.id !== ep.id)
      next[toKey] = [...(next[toKey] ?? []), ep]
      persistContainers(next)
      return next
    })
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
  const moveOptions = [
    { key: 'ungrouped', label: 'Unassigned' },
    ...groupKeys.map(key => ({ key, label: `Group ${parseInt(key.replace('group-', ''), 10) + 1}` })),
  ]

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
        supabase.from('event_players').update({ group_number: null, group_order: null }).eq('id', ep.id)
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
        <p className="text-sm text-ink">
          Drag players into groups. {numGroups} group{numGroups !== 1 ? 's' : ''} for {totalPlayers} player{totalPlayers !== 1 ? 's' : ''}.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <span className="text-xs text-ink-muted">Saving…</span>}
          {eventPlayers.some(ep => ep.group_number) && (
            <Button size="sm" variant="ghost" onClick={clearAllGroups}>Clear All</Button>
          )}
          <Button size="sm" onClick={() => setShowAutoAssign(true)}>Auto-assign</Button>
        </div>
      </div>

      {/* Auto-assign modal */}
      {showAutoAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-md p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-ink">Auto-Assign Groups</h2>
              <p className="text-sm text-ink-muted mt-1">Groups of 4 ({numGroups} groups). This overwrites current assignments.</p>
            </div>
            <div className="space-y-2">
              {AUTO_METHODS.map(m => (
                <label key={m.key} className={`flex items-start gap-3 rounded-sm border-2 px-4 py-3 cursor-pointer transition-colors ${autoMethod === m.key ? 'border-fairway-600 bg-fairway-50' : 'border-surface-border hover:border-surface-highest'}`}>
                  <input type="radio" name="autoMethod" value={m.key} checked={autoMethod === m.key} onChange={() => setAutoMethod(m.key)} className="mt-0.5 accent-fairway-600" />
                  <div>
                    <div className="text-sm font-semibold text-ink">{m.label}</div>
                    <div className="text-xs text-ink-muted mt-0.5">{m.desc}</div>
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
            subtitle="Drag into a group below, or use Move to on mobile"
            members={ungrouped}
            holeAssignments={holeAssignments}
            isShotgun={false}
            scorerByGroup={{}}
            allScores={allScores}
            showNoShow={event.status === 'active'}
            noShowLoading={noShowLoading}
            onNoShow={handleNoShow}
            onClearNoShow={handleClearNoShow}
            moveOptions={moveOptions}
            onMoveToGroup={moveToContainer}
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
                allScores={allScores}
                showNoShow={event.status === 'active'}
                noShowLoading={noShowLoading}
                onNoShow={handleNoShow}
                onClearNoShow={handleClearNoShow}
                moveOptions={moveOptions}
                onMoveToGroup={moveToContainer}
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
    </div>
  )
}

function DroppableGroup({ id, title, subtitle, members, isShotgun, holeAssignments, scorerByGroup, groupNum, onSetGroupHole, allScores, showNoShow, noShowLoading, onNoShow, onClearNoShow, onReturnToPool, moveOptions, onMoveToGroup }) {
  const { setNodeRef, isOver } = useDroppable({ id })

  const scored = groupNum && scorerByGroup[groupNum] ? [...scorerByGroup[groupNum]].join(', ') : null

  return (
    <div
      ref={setNodeRef}
      className="rounded-sm border-2 transition-colors"
      style={{ borderColor: isOver ? '#1B4332' : '#e5e7eb', background: isOver ? '#f0fdf4' : '#fff', minHeight: 80 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div>
          <div className="font-semibold text-ink text-sm">{title}</div>
          <div className="text-xs text-ink-muted">{subtitle}</div>
          {scored && <div className="text-xs text-status-active-text mt-0.5">Scored by: {scored}</div>}
        </div>
        {isShotgun && groupNum && (
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-ink-muted">Hole</label>
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
              isNoShow={isPlayerNoShow(ep.player_id, allScores)}
              showNoShow={showNoShow}
              noShowLoading={noShowLoading === ep.player_id}
              onNoShow={() => onNoShow(ep)}
              onClearNoShow={() => onClearNoShow(ep)}
              onReturnToPool={onReturnToPool ? () => onReturnToPool(ep) : null}
              moveOptions={moveOptions}
              currentKey={id}
              onMoveToGroup={onMoveToGroup}
            />
          ))}
          {members.length === 0 && (
            <div className="text-xs text-surface-outline text-center py-4">Drop players here</div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function SortablePlayerCard({ ep, isNoShow, showNoShow, noShowLoading, onNoShow, onClearNoShow, onReturnToPool, moveOptions, currentKey, onMoveToGroup }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ep.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center justify-between rounded-sm px-3 py-2 border ${isNoShow ? 'opacity-60 bg-surface-container border-surface-border' : 'bg-white border-surface-border hover:border-surface-border'}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span {...attributes} {...listeners} className="cursor-grab text-surface-outline hover:text-ink-muted select-none hidden sm:inline" title="Drag to move">
          ⠿
        </span>
        <div className="min-w-0">
          <span className="text-sm font-medium text-ink">{ep.player?.first_name} {ep.player?.last_name}</span>
          {isNoShow && <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>No Show</span>}
          {ep.flight && !isNoShow && <span className="ml-1"><FlightBadge flight={ep.flight} /></span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {moveOptions && onMoveToGroup && (
          <select
            value=""
            onChange={e => { if (e.target.value) onMoveToGroup(ep, currentKey, e.target.value) }}
            className="input py-0.5 text-xs w-28 bg-white text-ink-muted sm:hidden"
          >
            <option value="">Move to…</option>
            {moveOptions.filter(o => o.key !== currentKey).map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        )}
        {showNoShow && (
          isNoShow ? (
            <button onClick={onClearNoShow} disabled={noShowLoading} className="text-xs px-2 py-1 rounded border border-surface-border text-ink-muted hover:bg-surface-dim disabled:opacity-40">
              {noShowLoading ? '…' : 'Undo'}
            </button>
          ) : (
            <button onClick={onNoShow} disabled={noShowLoading} className="text-xs px-2 py-1 rounded border border-surface-border text-status-upcoming-text hover:bg-status-upcoming-bg disabled:opacity-40">
              {noShowLoading ? '…' : 'No Show'}
            </button>
          )
        )}
        {onReturnToPool && (
          <button onClick={onReturnToPool} title="Return to pool" className="text-surface-outline hover:text-red-400 transition-colors leading-none text-base font-bold px-1">
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
  const sideGameEntries = event.side_game_entries ?? {}

  // Rebuild config whenever event setup changes
  const eventConfigKey = [
    event.id,
    (event.formats ?? []).join(','),
    (event.side_game_options ?? []).join(','),
    String(numFlights),
    String(event.super_ctp_hole ?? ''),
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
    // "Separate buy-in" pots are funded only by the players who opted in — never
    // fall back to the full field, since an empty/unset entrant list means zero entrants.
    const base = baseSideGameKey(key)
    if (base && isBuyInEnabled(event, base)) {
      const opted = sideGameEntries[base] ?? []
      const fl = flightLetterOf(key)
      if (!fl) return opted.length
      const idsInFlight = new Set(nonGuestPlayers.filter(ep => ep.flight === fl).map(ep => ep.player_id))
      return opted.filter(pid => idsInFlight.has(pid)).length
    }
    // Full-field keys
    if (key === 'low_putts' || key.startsWith('ctp_') || key === 'skins' || key === 'long_drive') return totalPlayers
    if (!hasFlights && (key.startsWith('18_net_') || key.startsWith('18_gross_') || key.startsWith('f9_') || key.startsWith('b9_') || key.startsWith('stf_net_'))) return totalPlayers
    // Per-flight: extract letter
    const fl = flightLetterOf(key)
    if (fl) {
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
  // and whether it's an opt-in pot (funded only by entrants, not the whole field)
  const rows = Object.entries(config).map(([key, val]) => {
    const mult  = getMultiplier(key)
    const total = (val || 0) * mult
    const label = getCategoryLabel(key)
    const base    = baseSideGameKey(key)
    const isOptIn = !!(base && isBuyInEnabled(event, base))
    const flLetter = hasFlights ? flightLetterOf(key) : null
    const isField = !flLetter && !isOptIn
    return { key, val, label, isField, isOptIn, flLetter, mult, total }
  })
  // Separate Buy-in games get their own table each — never merged with another
  // game's rows. A player can only opt into one game and (if per-flight) only
  // occupies one flight, so a combined "$/player" total spanning rows from
  // different games or flights would overstate what any single player pays.
  const optInGameOrder   = []
  const optInGamesByBase = {}
  for (const r of rows) {
    if (!r.isOptIn) continue
    const base = baseSideGameKey(r.key)
    if (!base) continue
    if (!optInGamesByBase[base]) { optInGamesByBase[base] = []; optInGameOrder.push(base) }
    optInGamesByBase[base].push(r)
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="text-sm text-ink space-y-0.5">
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
            <span className="text-sm text-ink">Attendance — pot contribution × players (<strong>${(event.entry_fee * totalPlayers).toFixed(2)}</strong>)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={payoutBasis === 'fixed'} onChange={() => setPayoutBasis('fixed')} className="accent-fairway-600" />
            <span className="text-sm text-ink">Fixed total</span>
          </label>
        </div>
        {payoutBasis === 'fixed' && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-ink-muted">Total pot: $</span>
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
            <span className="inline-flex items-center gap-1 bg-status-upcoming-bg text-status-upcoming-text text-xs font-semibold px-2.5 py-1 rounded-full">
              Hole {longDriveHole}
              <button onClick={() => setLongDriveHole('')} className="text-status-upcoming-text hover:text-ink ml-0.5">×</button>
            </span>
          )}
        </div>
        <p className="text-xs text-ink-muted mt-2">This hole will be highlighted on exported scorecards.</p>
      </Card>}

      {hasCtp && <Card>
        <CardHeader title="Closest to Pin Holes" subtitle="Add the specific hole numbers for CTP contests at this course" />
        <div className="flex flex-wrap gap-2 mb-3">
          {ctpHoles.map(h => (
            <span key={h} className="inline-flex items-center gap-1 bg-status-active-bg text-fairway-800 text-xs font-semibold px-2.5 py-1 rounded-full">
              Hole {h}
              <button onClick={() => removeCtpHole(h)} className="text-status-active-text hover:text-fairway-800 ml-0.5">×</button>
            </span>
          ))}
          {ctpHoles.length === 0 && <p className="text-xs text-ink-muted">No CTP holes set. Add holes below.</p>}
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

      <p className="text-xs text-ink-muted">
        All values are <strong>$ per player</strong> × player count shown in each section.
      </p>

      {/* Per-flight scoring & side games — one card per flight */}
      {hasFlights && flightLetters.map(fl => {
        const flRows = rows.filter(r => r.flLetter === fl && !r.isOptIn)
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

      {/* Full field — no-flight scoring + CTP + low putts (everyone participates) */}
      {rows.some(r => r.isField) && (
        <Card className="overflow-hidden p-0">
          <div className="px-4 py-2.5 bg-status-active-bg border-b border-fairway-200">
            <h3 className="text-xs font-semibold text-status-active-text">
              {hasFlights ? 'Full Field — Scoring & CTP' : 'All Players'} ({totalPlayers} players)
            </h3>
          </div>
          <PayoutTable rows={rows.filter(r => r.isField)} onChange={setVal} colLabel="$ per player (All)" />
        </Card>
      )}

      {/* Separate Buy-in games — one table per game, since a player never
          contributes to more than one game (or more than one flight's pot
          within a game), so each table's own total pot is the only figure
          that means anything. */}
      {optInGameOrder.map(base => {
        const gameRows     = optInGamesByBase[base]
        const perFlightGame = gameRows.some(r => r.flLetter)
        const label = OPT_IN_GAME_LABELS[base] ?? base
        return (
          <Card key={base} className="overflow-hidden p-0">
            <div className="px-4 py-2.5 bg-status-upcoming-bg border-b border-surface-border">
              <h3 className="text-xs font-semibold text-status-upcoming-text">
                {label} — Separate Buy-in {perFlightGame ? '(Per Flight)' : '(Whole Group)'}
              </h3>
              <p className="text-xs text-status-upcoming-text/80 mt-0.5">
                {perFlightGame
                  ? "Each flight is its own pot, funded only by that flight's opted-in players — money is never mixed between flights, and only entrants in that flight can win it."
                  : "One pot open to every player who opts in, regardless of flight. Count comes from the Side Games tab's opt-in roster, not the full field."}
              </p>
            </div>
            <PayoutTable rows={gameRows} onChange={setVal} colLabel="$ per entrant" showPerPlayerTotal={false} />
          </Card>
        )
      })}

      {/* Save */}
      <div className="flex items-center justify-between pt-2 border-t border-surface-border">
        <p className={`text-sm tabular-nums ${overBudget ? 'text-red-600 font-medium' : 'text-fairway-700 font-medium'}`}>
          {overBudget ? `⚠ Over budget by $${(totalAllocated - totalPot).toFixed(2)}` : `$${totalAllocated.toFixed(2)} allocated of $${totalPot.toFixed(2)}`}
        </p>
        <Button onClick={handleSave} loading={saving}>Save Config</Button>
      </div>
    </div>
  )
}

function PayoutTable({ rows, onChange, colLabel, showPerPlayerTotal = true }) {
  if (rows.length === 0) return <p className="px-4 py-3 text-xs text-ink-muted">None</p>
  const totalPerPlayer = rows.reduce((sum, r) => sum + (r.val || 0), 0)
  const totalPot       = rows.reduce((sum, r) => sum + r.total, 0)
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs font-semibold text-ink-muted border-b border-surface-border">
          <th className="px-4 py-2">Category</th>
          <th className="px-3 py-2 w-36">{colLabel}</th>
          <th className="px-3 py-2 w-24">× Players</th>
          <th className="px-3 py-2 w-24 text-right">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-surface-border">
        {rows.map(({ key, val, label, mult, total }) => (
          <tr key={key}>
            <td className="px-4 py-2 text-ink text-xs">{label}</td>
            <td className="px-3 py-2">
              <div className="flex items-center gap-1">
                <span className="text-ink-muted text-xs">$</span>
                <input
                  type="number"
                  value={val}
                  onChange={e => onChange(key, e.target.value)}
                  className="input py-1 text-xs w-20 text-right"
                  min="0" step="1"
                />
              </div>
            </td>
            <td className="px-3 py-2 text-xs text-ink-muted tabular-nums">× {mult}</td>
            <td className="px-3 py-2 text-xs font-semibold text-ink text-right tabular-nums">${total.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
      {/* A "$/player" total only means something when every row in the table
          is funded by the same players (full-field / per-flight scoring
          categories). Separate Buy-in tables never show it — a player is
          never in more than one flight's row, so summing $ values across
          rows would overstate what any single entrant actually pays. */}
      {showPerPlayerTotal ? (
        <tfoot>
          <tr className="border-t border-surface-border bg-surface-container text-xs font-semibold text-ink">
            <td className="px-4 py-2">Total</td>
            <td className="px-3 py-2 tabular-nums">${totalPerPlayer.toFixed(2)} / player</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right tabular-nums">${totalPot.toFixed(2)}</td>
          </tr>
        </tfoot>
      ) : rows.length > 1 ? (
        <tfoot>
          <tr className="border-t border-surface-border bg-surface-container text-xs font-semibold text-ink">
            <td className="px-4 py-2" colSpan={3}>Combined pot (across flights)</td>
            <td className="px-3 py-2 text-right tabular-nums">${totalPot.toFixed(2)}</td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  )
}

// ─── Tab: Side Games ──────────────────────────────────────────────
function BlindPartnersCard({ event, eventPlayers, optedInIds = [], onUpdated }) {
  const drawPool = eventPlayers.filter(ep => optedInIds.includes(ep.player_id))

  // Restore previously drawn pairs and odd-player config from DB
  const savedPairs = event.side_game_entries?.blind_partner_pairs ?? []
  const savedOdd   = event.side_game_entries?.blind_partner_odd ?? null
  const [pairs, setPairs]     = useState(savedPairs)
  const [saving, setSaving]   = useState(false)
  const [oddConfig, setOddConfig] = useState(savedOdd ?? { type: 'ghost', score: '', player_id: '' })
  const [savingOdd, setSavingOdd] = useState(false)

  // Pairs are scored on the event's own metric, so the ghost value is entered in it too
  const isStableford = blindPartnersMode(event) === 'stableford'

  // Keep local state in sync if parent re-fetches
  useEffect(() => {
    setPairs(event.side_game_entries?.blind_partner_pairs ?? [])
    const od = event.side_game_entries?.blind_partner_odd
    if (od) setOddConfig(od)
  }, [event.side_game_entries])

  async function drawPartners() {
    // Per flight, pairs are drawn *within* each flight — an A player is never
    // paired with a B player, and each flight leaves at most one odd player.
    const perFlight = isPerFlight(event, 'blind_partners')
    const groups = perFlight
      ? Object.values(drawPool.reduce((acc, ep) => {
          (acc[ep.flight ?? '—'] ??= []).push(ep); return acc
        }, {}))
      : [drawPool]

    const newPairs = []
    for (const group of groups) {
      const shuffled = [...group].sort(() => Math.random() - 0.5)
      for (let i = 0; i < shuffled.length - 1; i += 2) {
        newPairs.push({ p1: shuffled[i].player_id, p2: shuffled[i + 1].player_id, flight: shuffled[i].flight ?? null })
      }
      if (shuffled.length % 2 !== 0) {
        const last = shuffled[shuffled.length - 1]
        newPairs.push({ p1: last.player_id, p2: null, flight: last.flight ?? null })
      }
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

  async function saveOddConfig(next) {
    setSavingOdd(true)
    const prev = event.side_game_entries ?? {}
    await supabase.from('events').update({
      side_game_entries: { ...prev, blind_partner_odd: next }
    }).eq('id', event.id)
    setSavingOdd(false)
    onUpdated?.()
  }

  function playerName(id) {
    const ep = eventPlayers.find(e => e.player_id === id)
    const p  = ep?.player ?? {}
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
  }

  const canDraw   = drawPool.length >= 2
  const oddPair   = pairs.find(p => p.p2 === null)
  const oddPlayer = oddPair ? eventPlayers.find(ep => ep.player_id === oddPair.p1) : null

  return (
    <Card>
      <CardHeader title="Blind Partners" subtitle="Only opted-in players are entered — draw to assign pairs. Results appear on the leaderboard." />
      <div className="space-y-4">
        {/* Entrant list */}
        <div>
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">
            Entrants ({drawPool.length})
          </div>
          {drawPool.length === 0 ? (
            <p className="text-sm text-ink-muted italic">No players have opted in yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1 mb-3">
              {drawPool.map(ep => {
                const p    = ep.player ?? {}
                const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
                return (
                  <div key={ep.player_id} className="text-sm text-ink flex items-center gap-1.5">
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
            className="text-sm font-semibold text-white bg-fairway-700 hover:bg-fairway-800 disabled:opacity-50 px-4 py-1.5 rounded-sm"
          >
            {pairs.length > 0 ? 'Redraw partners' : 'Draw partners'}
          </button>
          {saving && <span className="ml-3 text-xs text-ink-muted">Saving…</span>}
        </div>

        {/* Drawn pairs */}
        {pairs.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Drawn Pairs</div>
            <div className="space-y-1.5">
              {pairs.map((pair, i) => (
                <div key={i} className="text-sm text-ink bg-surface-container rounded-sm px-3 py-1.5">
                  <span className="font-medium text-fairway-700">Pair {i + 1}:</span>{' '}
                  {playerName(pair.p1)} &amp; {pair.p2
                    ? playerName(pair.p2)
                    : <span className="text-status-upcoming-text font-medium italic">odd player out</span>
                  }
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-muted mt-2">Combined net scores are ranked on the Blind Partners leaderboard tab.</p>
          </div>
        )}

        {/* Odd player out config — only shown when draw produces an odd pair */}
        {oddPlayer && (
          <div className="border border-surface-border bg-status-upcoming-bg rounded-sm px-4 py-3 space-y-3">
            <div>
              <div className="text-xs font-semibold text-status-upcoming-text uppercase tracking-wide mb-0.5">Odd Player Out</div>
              <div className="text-sm font-medium text-ink">
                {(() => { const p = oddPlayer.player ?? {}; return [p.first_name, p.last_name].filter(Boolean).join(' ') || '—' })()}
              </div>
              <div className="text-xs text-ink-muted mt-0.5">Choose how to assign a partner score for this player.</div>
            </div>

            {/* Type toggle */}
            <div className="flex gap-3">
              {[{ val: 'ghost', label: 'Ghost score' }, { val: 'blind', label: 'Blind score' }].map(opt => (
                <label key={opt.val} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="oddType"
                    value={opt.val}
                    checked={oddConfig.type === opt.val}
                    onChange={() => {
                      const next = { ...oddConfig, type: opt.val }
                      setOddConfig(next)
                      saveOddConfig(next)
                    }}
                    className="accent-fairway-700"
                  />
                  <span className="font-medium text-ink">{opt.label}</span>
                </label>
              ))}
            </div>

            {/* Ghost: preset score in the event's scoring metric */}
            {oddConfig.type === 'ghost' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-ink font-medium">
                  {isStableford ? 'Preset points:' : 'Preset net score:'}
                </label>
                <input
                  type="number"
                  value={oddConfig.score ?? ''}
                  placeholder={isStableford ? 'e.g. 36' : 'e.g. 72'}
                  onChange={e => setOddConfig(prev => ({ ...prev, score: e.target.value }))}
                  onBlur={e => {
                    const next = { ...oddConfig, score: e.target.value ? Number(e.target.value) : '' }
                    setOddConfig(next)
                    saveOddConfig(next)
                  }}
                  className="w-20 border border-surface-border rounded-sm px-2 py-1 text-sm text-center"
                />
                <span className="text-xs text-ink-muted">{isStableford ? 'points' : 'net strokes'}</span>
              </div>
            )}

            {/* Blind: pick a player from the field */}
            {oddConfig.type === 'blind' && (
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs text-ink font-medium">Partner's score drawn from:</label>
                <select
                  value={oddConfig.player_id ?? ''}
                  onChange={e => {
                    const next = { ...oddConfig, player_id: e.target.value }
                    setOddConfig(next)
                    saveOddConfig(next)
                  }}
                  className="border border-surface-border rounded-sm px-2 py-1 text-sm"
                >
                  <option value="">— select player —</option>
                  {drawPool
                    .filter(ep => ep.player_id !== oddPair.p1)
                    .map(ep => {
                      const p = ep.player ?? {}
                      return (
                        <option key={ep.player_id} value={ep.player_id}>
                          {[p.first_name, p.last_name].filter(Boolean).join(' ') || ep.player_id}
                        </option>
                      )
                    })}
                </select>
                {oddConfig.player_id && (
                  <span className="text-xs text-ink-muted">Their net score counts as the partner's score.</span>
                )}
              </div>
            )}

            {savingOdd && <span className="text-xs text-ink-muted">Saving…</span>}
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Tab: Side Games (opt-ins + draw + winner entry) ─────────────────────────
function TabSideGamesMain({ event, eventPlayers, course, sideGames, onUpdated, orgSlug, leagueSlug }) {
  const sides   = event.side_game_options ?? []
  const hasSideGames = sides.length > 0 || (event.custom_competitions ?? []).some(c => c?.trim())
  const optInUrl = `${window.location.origin}/${orgSlug}/${event.league?.slug ?? leagueSlug}/${event.slug}/opt-in`

  // Derive unique base keys from side_game_options
  const baseKeys = [...new Set(sides.map(s => {
    const m = s.match(/^(.+)_([a-z])$/)
    return (m && PER_FLIGHT_GAME_KEYS.has(m[1])) ? m[1] : s
  }))]

  // Any base game flagged "Separate buy-in" gets an opt-in roster here (the 3
  // legacy opt-in games are always buy-in-enabled — see isBuyInEnabled()).
  const buyInGames = baseKeys.filter(k => isBuyInEnabled(event, k))

  // Buy-in games are funded by Payout Config's "$ per entrant" — read it directly so the
  // pot shown here always matches the Payouts tab instead of a separately-entered amount.
  function payoutAmountForKey(key) {
    return optInAmount(event, key)
  }

  // Opt-in entries state (synced to DB)
  const [entries,  setEntries]  = useState(event.side_game_entries ?? {})
  const [savingEn, setSavingEn] = useState(false)
  // Keep local state in sync when parent re-fetches event
  useEffect(() => { setEntries(event.side_game_entries ?? {}) }, [event.side_game_entries])

  // Paid reconciliation state — separate from `entries` (who opted in) so admin
  // can track who's actually handed over cash/Venmo, same shape as side_game_entries.
  const [paid,     setPaid]     = useState(event.side_game_paid ?? {})
  const [savingPd, setSavingPd] = useState(false)
  useEffect(() => { setPaid(event.side_game_paid ?? {}) }, [event.side_game_paid])

  // Super CTP designated hole (editable inline)
  const allPar3sMain = (course?.par_per_hole ?? [])
    .map((par, i) => ({ hole: i + 1, par }))
    .filter(h => h.par === 3)
  const [superCtpHole, setSuperCtpHole] = useState(event.super_ctp_hole ?? '')
  // Keep local state in sync when parent re-fetches event
  useEffect(() => { setSuperCtpHole(event.super_ctp_hole ?? '') }, [event.super_ctp_hole])
  async function saveCtpHole(val) {
    const num = val ? parseInt(val, 10) : null
    setSuperCtpHole(val)
    const { error } = await supabase.from('events').update({ super_ctp_hole: num }).eq('id', event.id)
    if (error) { toast.error(error.message); setSuperCtpHole(event.super_ctp_hole ?? ''); return }
    onUpdated?.()
  }

  async function persistEntries(next) {
    setSavingEn(true)
    await supabase.from('events').update({ side_game_entries: next }).eq('id', event.id)
    setSavingEn(false)
    onUpdated?.()
  }

  function toggleEntry(gameKey, playerId) {
    const cur        = entries[gameKey] ?? []
    const isRemoving = cur.includes(playerId)
    const next       = isRemoving ? cur.filter(id => id !== playerId) : [...cur, playerId]
    const updated    = { ...entries, [gameKey]: next }
    setEntries(updated)
    persistEntries(updated)

    // Un-opting a player also clears their paid flag — no stale "paid" for
    // someone no longer in the roster for this game.
    if (isRemoving) {
      const curPaid = paid[gameKey]
      const hasPaid = Array.isArray(curPaid) ? curPaid.includes(playerId) : curPaid?.[playerId] != null
      if (hasPaid) {
        const updatedGamePaid = Array.isArray(curPaid)
          ? curPaid.filter(id => id !== playerId)
          : Object.fromEntries(Object.entries(curPaid).filter(([id]) => id !== playerId))
        const updatedPaid = { ...paid, [gameKey]: updatedGamePaid }
        setPaid(updatedPaid)
        persistPaid(updatedPaid)
      }
    }
  }

  async function persistPaid(next) {
    setSavingPd(true)
    await supabase.from('events').update({ side_game_paid: next }).eq('id', event.id)
    setSavingPd(false)
    onUpdated?.()
  }

  // Payment method per player per game — 'cash' | 'venmo' | null. Older events
  // stored side_game_paid[key] as a plain array of paid player IDs (no method);
  // those show as 'unspecified' until the admin picks a method, which upgrades
  // that game's entry to the new { playerId: 'cash'|'venmo' } shape.
  function paidMethodFor(gameKey, playerId) {
    const v = paid[gameKey]
    if (Array.isArray(v)) return v.includes(playerId) ? 'unspecified' : null
    return v?.[playerId] ?? null
  }

  function setPaidMethod(gameKey, playerId, method) {
    setPaid(prev => {
      const cur    = prev[gameKey]
      const curObj = Array.isArray(cur)
        ? Object.fromEntries(cur.map(id => [id, 'unspecified']))
        : { ...(cur ?? {}) }
      if (method) curObj[playerId] = method
      else delete curObj[playerId]
      const updated = { ...prev, [gameKey]: curObj }
      persistPaid(updated)
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
      <div className="text-sm text-ink-muted py-8 text-center">
        No side games configured for this event.<br />
        <span className="text-xs">Add side games via the <strong>Edit Event</strong> button (pencil icon), then come back here.</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Opt-in link ──────────────────────────────────────────── */}
      {buyInGames.length > 0 && (
        <Card>
          <CardHeader title="Opt-In Link" subtitle="Share this link (or the printable Check-In QR sign) so players can self-serve join & pay for opt-in games" />
          <div className="flex items-center gap-2 px-4 pb-4">
            <input readOnly value={optInUrl} className="input text-xs flex-1 bg-surface-container" onFocus={e => e.target.select()} />
            <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(optInUrl); toast.success('Link copied!') }}>
              Copy
            </Button>
          </div>
        </Card>
      )}

      {/* ── Opt-in rosters ───────────────────────────────────────── */}
      {buyInGames.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">Opt-in Rosters</h3>
          <div className="space-y-4">
            {buyInGames.map(key => {
              const opted      = entries[key] ?? []
              const paidCount  = opted.filter(pid => paidMethodFor(key, pid) != null).length
              const cashCount  = opted.filter(pid => paidMethodFor(key, pid) === 'cash').length
              const venmoCount = opted.filter(pid => paidMethodFor(key, pid) === 'venmo').length
              const amount     = payoutAmountForKey(key)
              const pot        = amount != null ? opted.length * amount : null
              return (
                <Card key={key}>
                  <div className="flex items-center justify-between mb-3">
                    <CardHeader title={gameLabel(key)} subtitle={amount != null ? `$${amount} per entrant · set in Payouts tab` : 'Set the $ per entrant in the Payouts tab'} />
                    {pot != null && (
                      <div className="text-right">
                        <div className="text-xs text-ink-muted">Pot</div>
                        <div className="text-lg font-bold text-status-active-text">${pot.toFixed(2)}</div>
                        <div className="text-xs text-ink-muted">{opted.length} entrant{opted.length !== 1 ? 's' : ''}</div>
                        {opted.length > 0 && (
                          <div className={`text-xs font-medium ${paidCount === opted.length ? 'text-status-active-text' : 'text-status-upcoming-text'}`}>
                            {paidCount}/{opted.length} paid
                            {(cashCount > 0 || venmoCount > 0) && (
                              <span className="text-ink-muted font-normal"> ({cashCount} cash · {venmoCount} venmo)</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {key === 'super_ctp' && (
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-ink-muted block mb-1">Designated Hole</label>
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
                    {[...eventPlayers].sort(epAlpha).map(ep => {
                      const pid     = ep.player_id
                      const p       = ep.player ?? {}
                      const name    = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
                      const isOpted = opted.includes(pid)
                      const method  = paidMethodFor(key, pid)
                      return (
                        <div key={pid} className="flex items-center justify-between gap-1.5 text-sm text-ink">
                          <label className="flex items-center gap-2 cursor-pointer min-w-0">
                            <input
                              type="checkbox"
                              checked={isOpted}
                              onChange={() => toggleEntry(key, pid)}
                              className="accent-fairway-600 w-4 h-4 shrink-0"
                            />
                            <span className="truncate">{name}</span>
                          </label>
                          {isOpted && (
                            <div className="flex items-center gap-1 shrink-0">
                              {method === 'unspecified' && (
                                <span className="text-xs text-status-active-text" title="Marked paid before cash/Venmo tracking existed">✓</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setPaidMethod(key, pid, method === 'cash' ? null : 'cash')}
                                className={`px-1.5 py-0.5 rounded text-xs font-medium border transition-colors ${
                                  method === 'cash' ? 'bg-fairway-700 text-white border-fairway-700' : 'text-ink-muted border-surface-border hover:border-surface-highest'
                                }`}
                              >
                                Cash
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaidMethod(key, pid, method === 'venmo' ? null : 'venmo')}
                                className={`px-1.5 py-0.5 rounded text-xs font-medium border transition-colors ${
                                  method === 'venmo' ? 'bg-blue-600 text-white border-blue-600' : 'text-ink-muted border-surface-border hover:border-surface-highest'
                                }`}
                              >
                                Venmo
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {(savingEn || savingPd) && <p className="text-xs text-ink-muted mt-2">Saving…</p>}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Winner entry ─────────────────────────────────────────── */}
      {hasSideGames && (
        <div>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">Winner Entry</h3>
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
  const hasBlindPartners = sides.some(s => s === 'blind_partners' || s.startsWith('blind_partners_'))
  const hasSuperSkins    = sides.some(s => s === 'super_skins' || s.startsWith('super_skins_'))

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink">Enter manual side game winners.</p>

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
                  <div className="text-xs font-semibold text-ink-muted mb-2">Hole {h.hole}</div>
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
        const ctpPool = eventPlayers.filter(ep => optedInIds.includes(ep.player_id))
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
          <CardHeader title="Super Skins" subtitle="Results auto-computed from scoring" />
          <p className="text-sm text-ink-muted py-2">
            Super Skins runs on the same scoring data as Skins. Winners are determined automatically once all scores are entered.
            {sides.some(s => /^super_skins_[a-z]$/.test(s))
              && ' Each flight competes in its own separate pot, based on each player\u2019s flight assignment — money is never mixed between flights.'}
          </p>
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
    return <p className="text-sm text-ink-muted">No data available yet.</p>
  }

  const nonGuestEPs   = eventPlayers.filter(ep => !ep.is_guest)
  const flightCounts  = {}
  nonGuestEPs.forEach(ep => { if (ep.flight) flightCounts[ep.flight] = (flightCounts[ep.flight] ?? 0) + 1 })
  const leaderboards  = computeLeaderboards(nonGuestEPs, allScores, course)
  const skinsResults  = computeAllSkins(nonGuestEPs, allScores, course)
  const stablefordData = computeStableford(nonGuestEPs, allScores, course)
  const stablefordGrossData = computeStableford(nonGuestEPs, allScores, course, true)
  const blindPartnersData = computeBlindPartners(event, nonGuestEPs, allScores, course)
  const superSkinsResult  = computeSuperSkins(event, nonGuestEPs, allScores, course)
  const { totalPot, buyInPotTotal, byCategory, byPlayer, totalAllocated } = computePayouts(
    event, nonGuestEPs.length, leaderboards, sideGames, skinsResults, flightCounts, {
      stablefordData, blindPartnersData, superSkinsResult, stablefordGrossData, eventPlayers: nonGuestEPs,
    }
  )

  const playerMap = Object.fromEntries(
    eventPlayers.map(ep => [ep.player_id, ep.player])
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-ink">Total Pot: ${totalPot.toFixed(2)}</p>
          <p className="text-sm text-ink-muted">
            {nonGuestEPs.length} players × ${event.entry_fee}
            {buyInPotTotal > 0 && <> + ${buyInPotTotal.toFixed(2)} separate buy-ins</>}
          </p>
        </div>
      </div>

      {/* By player */}
      <Card className="overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-surface-border bg-surface-container">
          <h3 className="font-semibold text-ink text-sm">Payouts by Player</h3>
        </div>
        {byPlayer.length === 0
          ? <p className="px-5 py-4 text-sm text-ink-muted">No payouts resolved yet.</p>
          : (
          <div className="divide-y divide-surface-border">
            {byPlayer.map(({ playerId, total, items }) => {
              const p = playerMap[playerId]
              return (
                <div key={playerId} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-ink">
                      {p ? `${p.first_name} ${p.last_name}` : playerId}
                    </span>
                    <span className="font-bold text-fairway-700">${total.toFixed(2)}</span>
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
        )}
      </Card>

      {/* By category */}
      <Card className="overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-surface-border bg-surface-container">
          <h3 className="font-semibold text-ink text-sm">Payouts by Category</h3>
        </div>
        <div className="divide-y divide-surface-border">
          {byCategory.map(cat => {
            const p = cat.playerId ? playerMap[cat.playerId] : null
            return (
              <div key={cat.key} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <div className="text-sm text-ink">{cat.label}</div>
                  <div className="text-xs text-ink-muted">
                    {p ? `${p.first_name} ${p.last_name}` : '— Unresolved'}
                  </div>
                </div>
                <span className="font-semibold text-sm text-ink">${cat.amount.toFixed(2)}</span>
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
      <ActionButton variant="ghost" onClick={() => setStatus('active', 'Activate this event? Scorekeepers will be able to enter scores.')} loading={saving}>
        Activate event
      </ActionButton>
    )
  }

  if (event.status === 'active') {
    return (
      <ActionButton variant="ghost" onClick={() => setStatus('complete', 'Close this event? Results will be locked.')} loading={saving}>
        Close event
      </ActionButton>
    )
  }

  if (event.status === 'complete') {
    return (
      <ActionButton variant="ghost" onClick={() => setStatus('active', 'Re-open this event? Status will return to Active and scores can be edited.')} loading={saving}>
        Re-open event
      </ActionButton>
    )
  }

  return null
}

// ─── Edit Event Modal ──────────────────────────────────────────────

// Format keys that support per-flight scoring
const PER_FLIGHT_FORMAT_KEYS = new Set(['net_stroke', 'net_stroke_front9', 'net_stroke_back9', 'low_gross', 'gross_stroke_front9', 'gross_stroke_back9', 'stableford', 'stableford_gross'])

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
    { value: 'net_stroke_nassau',   label: 'Nassau — Net',   tip: 'Three separate bets: Front 9, Back 9, and Full 18 net — each scored and paid independently.' },
    { value: 'gross_stroke_nassau', label: 'Nassau — Gross', tip: 'Same three bets — Front 9, Back 9, Full 18 — scored on raw gross score, no handicap applied.' },
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
    setSideGameBuyIns(prev => ({ ...prev, [key]: { enabled: !(prev[key]?.enabled) } }))
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
          [...sideGames]
            .filter(k => BUY_IN_ELIGIBLE_KEYS.has(k))
            .map(k => [k, { enabled: !!sideGameBuyIns[k]?.enabled }])
            .filter(([, v]) => v.enabled)
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
          <Input label="Pot contribution ($)" type="number" step="0.01" min="0" value={entryFee} onChange={e => setEntryFee(e.target.value)} required />
          <Input label="Entry fee ($)" type="number" step="0.01" min="0" value={tournamentFee} onChange={e => setTournamentFee(e.target.value)} placeholder="Charged at registration" />
        </div>
        <p className="text-xs text-ink-muted -mt-2">Pot contribution is per player, toward winnings, and drives payouts. Entry fee is what each player pays to register.</p>

        {/* Payment links */}
        <div className="space-y-3 bg-surface-container rounded-sm px-4 py-3">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Payment Links (shown after registration)</p>
          <div>
            <label className="label">Venmo Handle</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm font-medium">@</span>
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
        <div className="space-y-3 bg-surface-container rounded-sm px-4 py-3">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Schedule of Events <span className="normal-case text-ink-muted font-normal">(shown on event page and registration)</span></p>
          {scheduleItems.map((item, i) => (
            <div key={i} className="bg-white rounded-sm border border-surface-border p-3 space-y-2">
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
                <Button type="button" variant="ghost" size="sm" iconOnly label="Remove" className="shrink-0 hover:!text-red-600" onClick={() => setScheduleItems(prev => prev.filter((_, j) => j !== i))}>✕</Button>
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
        <div className="space-y-2 bg-surface-container rounded-sm px-4 py-3">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Registration Questions <span className="normal-case text-ink-muted font-normal">(shown on registration form)</span></p>
          {customQuestions.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={q.label}
                onChange={e => setCustomQuestions(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                placeholder="e.g. Interested in bringing a guest?"
                className="input flex-1"
              />
              <label className="flex items-center gap-1 text-xs text-ink-muted shrink-0 cursor-pointer">
                <input type="checkbox" checked={q.required}
                  onChange={e => setCustomQuestions(prev => prev.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))}
                  className="accent-fairway-600" />
                Required
              </label>
              <Button type="button" variant="ghost" size="sm" iconOnly label="Remove" className="shrink-0 hover:!text-red-600" onClick={() => setCustomQuestions(prev => prev.filter((_, j) => j !== i))}>✕</Button>
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
        <div className="bg-surface-container rounded-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-ink">Number of Flights</div>
              <div className="text-xs text-ink-muted mt-0.5">Flight A = highest/best players. "No flights" = single field.</div>
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
        <div className="bg-surface-container rounded-sm px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">Shotgun Start?</div>
            <div className="text-xs text-ink-muted mt-0.5">All groups tee off simultaneously from different holes</div>
          </div>
          <button
            type="button"
            onClick={() => setShotgunStart(v => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${shotgunStart ? 'bg-fairway-600' : 'bg-surface-highest'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${shotgunStart ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Holes Played toggle */}
        <div className="bg-surface-container rounded-sm px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">Holes Played</div>
            <div className="text-xs text-ink-muted mt-0.5">Defaults to 18. Select 9 for a nine-hole event.</div>
          </div>
          <div className="flex rounded-sm border border-surface-highest overflow-hidden text-sm font-semibold">
            {[18, 9].map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setHolesPlayed(h)}
                className={`px-4 py-1.5 transition-colors ${holesPlayed === h ? 'bg-fairway-700 text-white' : 'bg-white text-ink hover:bg-surface-high'}`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Use Handicaps toggle */}
        <div className="bg-surface-container rounded-sm px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">Use Handicaps</div>
            <div className="text-xs text-ink-muted mt-0.5">When off, handicap index is not required when adding players.</div>
          </div>
          <button
            type="button"
            onClick={() => setUseHandicaps(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useHandicaps ? 'bg-fairway-600' : 'bg-surface-highest'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${useHandicaps ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Scoring Formats */}
        <div>
          <label className="label">Scoring Formats</label>
          <div className="bg-surface-container rounded-sm px-4 py-3 space-y-3">
            {EDIT_FORMAT_OPTIONS.map(group => (
              <div key={group.group}>
                <div className="text-xs text-ink-muted font-medium uppercase tracking-wide mb-1.5">{group.group}</div>
                <div className="space-y-2">
                  {group.options.map(opt => {
                    const isPerFlightEligible = PER_FLIGHT_FORMAT_KEYS.has(opt.value)
                    const fmtScope = formatScope[opt.value] ?? 'flight'
                    const flightLetters = Array.from({ length: numFlights }, (_, i) => String.fromCharCode(65 + i))
                    return (
                      <div key={opt.value}>
                        <div className="flex items-center gap-2.5">
                          <input type="checkbox" checked={formats.has(opt.value)} onChange={() => toggleFormat(opt.value)} className="accent-fairway-600 w-4 h-4 shrink-0 cursor-pointer" />
                          <span className="text-sm text-ink cursor-pointer" onClick={() => toggleFormat(opt.value)}>{opt.label}</span>
                          {opt.tip && (
                            <span className="relative group/tip shrink-0">
                              <span className="text-ink-muted hover:text-fairway-600 cursor-default text-xs font-bold select-none">ⓘ</span>
                              <span className="absolute left-5 top-1/2 -translate-y-1/2 z-50 hidden group-hover/tip:block w-64 bg-ink text-white text-xs rounded-sm px-3 py-2 leading-relaxed shadow-xl pointer-events-none">
                                {opt.tip}
                              </span>
                            </span>
                          )}
                          {formats.has(opt.value) && (
                            <div className="ml-auto flex items-center gap-1.5 shrink-0">
                              <span className="text-xs text-ink-muted">Places to pay:</span>
                              <select
                                value={payoutPlaces[opt.value] ?? 1}
                                onChange={e => setPayoutPlaces(prev => ({ ...prev, [opt.value]: Number(e.target.value) }))}
                                className="text-xs border border-surface-highest rounded px-1.5 py-0.5 bg-white"
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
                              <span className="text-xs text-ink">Whole group</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" checked={fmtScope === 'flight'}
                                onChange={() => setFormatScope(prev => ({ ...prev, [opt.value]: 'flight' }))}
                                className="accent-fairway-600" />
                              <span className="text-xs text-ink">Per flight ({flightLetters.join(', ')})</span>
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
          <div className="space-y-3 bg-surface-container rounded-sm px-4 py-3">
            {PER_FLIGHT_GAMES.map(opt => {
              const checked = sideGames.has(opt.key)
              const scope = gameScope[opt.key] ?? 'flight'
              const flightLetters = Array.from({ length: numFlights }, (_, i) => String.fromCharCode(65 + i))
              const isPerFlight = PER_FLIGHT_GAMES.some(g => g.key === opt.key)
              const buyIn = sideGameBuyIns[opt.key] ?? {}
              return (
                <div key={opt.key}>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={() => toggleSideGame(opt.key)} className="accent-fairway-600 w-4 h-4" />
                    <span className="text-sm text-ink">{opt.label}</span>
                  </label>
                  {checked && isPerFlight && numFlights > 0 && (
                    <div className="ml-6 mt-1.5 flex gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" checked={scope === 'flight'}
                          onChange={() => setGameScope(prev => ({ ...prev, [opt.key]: 'flight' }))}
                          className="accent-fairway-600" />
                        <span className="text-xs text-ink">Per flight ({flightLetters.join(', ')})</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" checked={scope === 'group'}
                          onChange={() => setGameScope(prev => ({ ...prev, [opt.key]: 'group' }))}
                          className="accent-fairway-600" />
                        <span className="text-xs text-ink">Whole group</span>
                      </label>
                    </div>
                  )}
                  {checked && (
                    <div className="ml-6 mt-1.5 flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={buyIn.enabled ?? false}
                          onChange={() => toggleBuyIn(opt.key)}
                          className="accent-fairway-600 w-4 h-4"
                        />
                        <span className="text-xs text-ink">Separate buy-in</span>
                      </label>
                      <span className="text-xs text-ink-muted italic">
                        {buyIn.enabled
                          ? '$ per entrant is set in the Payouts tab'
                          : 'Included in pot contribution ($)'}
                      </span>
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
                    className="flex-1 border border-surface-highest rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fairway-500"
                  />
                  <Button type="button" variant="ghost" size="sm" iconOnly label="Remove" className="shrink-0 hover:!text-red-600" onClick={() => setCustomCompetitions(prev => prev.filter((_, j) => j !== i))}>✕</Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => setCustomCompetitions(prev => [...prev, ''])}>+ Add custom competition</Button>
          </div>
        </div>

        {!shotgunStart && <Input label="Tee Interval (min)" type="number" min="1" max="60" value={interval} onChange={e => setInterval(e.target.value)} />}

        {/* Payout Basis */}
        <div>
          <label className="label">Payout Pot Based On</label>
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="editPayoutBasis" value="per_player" checked={payoutBasis === 'per_player'} onChange={() => setPayoutBasis('per_player')} className="accent-fairway-600" />
              <span className="text-sm text-ink">Attendance (pot contribution × players)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="editPayoutBasis" value="fixed" checked={payoutBasis === 'fixed'} onChange={() => setPayoutBasis('fixed')} className="accent-fairway-600" />
              <span className="text-sm text-ink">Fixed total</span>
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
        <p className="text-sm text-ink">
          Are you sure you want to delete <strong>Event #{event?.event_number}</strong>?
          This will permanently remove all scores, pairings, and side game data for this event.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-sm px-4 py-3 text-sm text-red-700">
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
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
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
        <p className="text-xs font-semibold text-ink mb-1">Group Codes (no login needed)</p>
        <p className="text-xs text-ink-muted">Assign players to groups first, then set codes here.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-ink">Group Codes (no login needed)</p>
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
              <div className="shrink-0 text-xs font-bold text-ink-muted w-16">Group {g}</div>
              <input
                type="text"
                value={code}
                onChange={e => setCode(g, e.target.value)}
                placeholder="—"
                maxLength={8}
                className="input text-sm w-28 uppercase tracking-widest font-bold text-center"
              />
              <div className="text-xs text-ink-muted truncate flex-1" title={players}>{players}</div>
              <Button size="sm" variant="secondary" onClick={() => setCode(g, makeCode())}>↺</Button>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-ink-muted mb-1.5">
        Share the scorecard link + each group's code. Players enter their code to access scoring — no account needed.
      </p>
      <div className="flex items-center gap-2">
        <input readOnly value={scorecardUrl} className="input text-xs flex-1 bg-surface-container" onFocus={e => e.target.select()} />
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
    pending:   'bg-status-upcoming-bg text-status-upcoming-text',
    confirmed: 'bg-status-active-bg text-status-active-text',
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
          <p className="text-sm font-semibold text-ink">
            {reg.first_name} {reg.last_name}
            {reg.flight && <span className="ml-2 text-xs text-ink-muted">Flight {reg.flight}</span>}
          </p>
        </div>
        {reg.email && <p className="text-xs text-ink-muted">{reg.email}</p>}
        {reg.notes && (
          <p className="text-xs text-ink-muted italic">
            "{reg.notes}"
          </p>
        )}
        <p className="text-xs text-ink-muted">
          {new Date(reg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </p>
        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {reg.status === 'pending' && (
            <>
              <Button size="sm" variant="secondary" onClick={() => addToRoster(reg)}>
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
      <RegistrationCard
        url={regUrl}
        onCopy={() => { navigator.clipboard.writeText(regUrl); toast.success('Link copied!') }}
        pendingCount={loading ? null : pending.length}
        notice={!event.venmo_handle && !event.paypal_link && !event.zelle_handle
          ? "No payment links set — players won't see a payment button after registering. Add a Venmo handle, Zelle, or PayPal link in Event Settings."
          : null}
      >
        <div className="divide-y divide-surface-border">{pending.map(r => <RegRow key={r.id} reg={r} />)}</div>
      </RegistrationCard>

      {!loading && (
        <>
          {confirmed.length > 0 && (
            <Card>
              <button
                onClick={() => setConfirmedExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-dim transition-colors"
              >
                <span className="text-sm font-semibold text-ink">Confirmed ({confirmed.length})</span>
                <span className="text-ink-muted text-xs">{confirmedExpanded ? '▲ Hide' : '▼ Show'}</span>
              </button>
              {confirmedExpanded && (
                <div className="divide-y divide-surface-border px-4 pb-2">{confirmed.map(r => <RegRow key={r.id} reg={r} />)}</div>
              )}
            </Card>
          )}

          {cancelled.length > 0 && (
            <Card>
              <CardHeader title={`Cancelled (${cancelled.length})`} />
              <div className="divide-y divide-surface-border px-4">{cancelled.map(r => <RegRow key={r.id} reg={r} />)}</div>
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
                <div className="divide-y divide-surface-border px-4 pb-2">
                  {withNotes.map(reg => {
                    const { guest, notes } = parseNotes(reg.notes)
                    const timestamp = new Date(reg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                    return (
                      <div key={reg.id} className="py-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-ink">{reg.first_name} {reg.last_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[reg.status]}`}>{reg.status}</span>
                          <span className="text-xs text-ink-muted ml-auto">{timestamp}</span>
                        </div>
                        {guest && (
                          <div className="rounded-sm border border-surface-border bg-status-upcoming-bg px-3 py-2 space-y-0.5">
                            <p className="text-xs font-semibold text-status-upcoming-text uppercase tracking-wide">Guest Request</p>
                            <p className="text-sm font-medium text-ink">{guest.name}</p>
                            {guest.email && <p className="text-xs text-ink-muted">{guest.email}</p>}
                            {guest.ghin && <p className="text-xs text-ink-muted">GHIN: {guest.ghin}</p>}
                          </div>
                        )}
                        {notes && (
                          <p className="text-xs text-ink-muted italic">"{notes}"</p>
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

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
            <h3 className="text-sm font-semibold text-ink">Team Play</h3>
            {tglLocked && (
              <span className="text-xs bg-status-active-bg text-status-active-text font-semibold px-2 py-0.5 rounded-full">
                Locked
              </span>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
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
        <p className="text-sm text-ink-muted italic">No teams yet. Create up to 4 teams for this league.</p>
      )}

      {/* Team cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {tglTeams.map(team => {
          const members = tglMembers.filter(m => m.team_id === team.id)
          const memberIds = new Set(members.map(m => m.player_id))
          const selected = tglSelections.filter(s => s.team_id === team.id && memberIds.has(s.player_id))
          const eventPoints = eventResults?.teamResults?.find(r => r.team.id === team.id)?.teamPoints ?? null

          return (
            <div key={team.id} className="border border-surface-border rounded-sm overflow-hidden">
              {/* Team header bar */}
              <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: team.color + '22', borderBottom: `3px solid ${team.color}` }}>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: team.color }} />
                  <span className="font-semibold text-ink text-sm">{team.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {eventPoints !== null && (
                    <span className="text-xs font-medium text-ink bg-white rounded-full px-2 py-0.5 border">
                      {eventPoints % 1 === 0 ? eventPoints : eventPoints.toFixed(1)} pts
                    </span>
                  )}
                  {!tglLocked && (
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedTeam(team); setShowMemberModal(true) }}>Roster</Button>
                  )}
                  {!tglLocked && (
                    <Button variant="ghost" size="sm" iconOnly label="Delete team" className="hover:!text-red-600" onClick={() => deleteTeam(team.id)}>✕</Button>
                  )}
                </div>
              </div>

              {/* Event selections */}
              <div className="p-3">
                <p className="text-xs font-medium text-ink-muted mb-2">Playing this event ({selected.length}/2):</p>
                {members.length === 0 ? (
                  <p className="text-xs text-ink-muted italic">No roster members yet.</p>
                ) : (
                  <div className="space-y-1">
                    {members.map(m => {
                      const isSelected = selected.some(s => s.player_id === m.player_id)
                      const conflictSel = !isSelected ? tglSelections.find(s => s.player_id === m.player_id && s.team_id !== team.id) : null
                      const conflictTeam = conflictSel ? tglTeams.find(t => t.id === conflictSel.team_id) : null
                      const onAnotherTeam = !!conflictSel
                      return (
                        <div key={m.player_id} className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${onAnotherTeam ? 'bg-status-upcoming-bg' : 'hover:bg-surface-dim'}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={tglLocked || (!isSelected && selected.length >= 2 && !onAnotherTeam)}
                            onChange={() => !tglLocked && toggleEventSelection(team.id, m.player_id)}
                            className="rounded text-status-active-text cursor-pointer"
                          />
                          <span className={isSelected ? 'font-medium text-ink' : onAnotherTeam ? 'text-status-upcoming-text' : 'text-ink'}>
                            {m.player?.first_name} {m.player?.last_name}
                          </span>
                          {onAnotherTeam && (
                            <span className="ml-auto text-xs text-status-upcoming-text font-medium">
                              on {conflictTeam?.name ?? 'another team'} —{' '}
                              <button
                                className="underline hover:text-ink"
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
                              <span className="ml-auto text-xs text-ink-muted">
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
        <div className="border border-surface-border rounded-sm overflow-hidden">
          <div className="bg-surface-container px-4 py-2 border-b border-surface-border">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-widest">Event Team Play Scores</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-muted border-b border-surface-border">
                <th className="text-left px-4 py-2">Rank</th>
                <th className="text-left px-4 py-2">Team</th>
                <th className="text-left px-4 py-2">Players</th>
                <th className="text-right px-4 py-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {eventResults.teamResults.map(tr => (
                <tr key={tr.team.id} className="border-b border-surface-border last:border-0">
                  <td className="px-4 py-2 font-semibold text-ink">#{tr.rank}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tr.team.color }} />
                      <span className="font-medium">{tr.team.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-ink text-xs">
                    {tr.selectedPlayers.map(p => `${p.name} (${p.points % 1 === 0 ? p.points : p.points.toFixed(1)})`).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-ink">
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
              <label className="block text-sm font-medium text-ink mb-1">Team Color</label>
              <input
                type="color"
                value={newTeamColor}
                onChange={e => setNewTeamColor(e.target.value)}
                className="h-10 w-20 rounded cursor-pointer border border-surface-highest"
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
          <p className="text-sm text-ink-muted italic">No players registered for this event yet.</p>
        )}
        {allEventPlayers.map(ep => {
          const isMember = memberIds.has(ep.player_id)
          return (
            <label key={ep.player_id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-surface-dim cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={isMember}
                onChange={() => toggleMember(ep.player_id)}
                className="rounded text-status-active-text"
              />
              <span className={isMember ? 'font-medium text-ink' : 'text-ink'}>
                {ep.player?.first_name} {ep.player?.last_name}
              </span>
              <span className="ml-auto text-xs text-ink-muted">{ep.flight ? `Flight ${ep.flight}` : ''}</span>
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

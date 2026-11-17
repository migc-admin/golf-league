/**
 * Live Leaderboard (public event page)
 * Auto-updates via Supabase Realtime on scores changes.
 * Phone first: sticky header with the tab strip, content straight underneath.
 * From 900px wide: wider header, two columns with an "At a glance" rail.
 * Layout only — every number comes from the scoring engines, unchanged.
 */

import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { computeLeaderboards, computeStableford, computeBlindPartners, blindPartnersMode, getStrokeIndexForTee } from '../lib/engines/scoring'
import { computeAllSkins, computeSuperSkins } from '../lib/engines/skins'
import { computeMatchPoints, computeTeamMatchPoints } from '../lib/engines/matchPoints'
import { computePayouts } from '../lib/engines/payouts'
import { computeTGLEventResults, assignTGLPoints } from '../lib/engines/tgl'
import { useFeatures, useOrg } from '../lib/OrgContext'
import { useSubdomainOrg } from '../lib/SubdomainContext'
import SegmentedToggle from '../components/ui/SegmentedToggle'
import { matchChip, skinsHoleRows, holeRange, payoutTag, finishLabel, toParText } from '../lib/leaderboardView'

const ALL_TABS = ['18-Hole', 'Front 9', 'Back 9', 'Low Gross', 'Gross Front 9', 'Gross Back 9', 'Stableford', 'Stableford Gross', 'Nassau', 'Scramble', 'Match Points', 'Team Match', 'Skins', 'Super Skins', 'Low Putts', 'Blind Partners', 'Team Play', 'Payouts']

const TAB_LABEL = {
  '18-Hole': '18-hole', 'Low Gross': 'Low gross', 'Gross Front 9': 'Gross front 9', 'Gross Back 9': 'Gross back 9',
  'Stableford Gross': 'Stableford gross', 'Match Points': 'Match play', 'Team Match': 'Team match',
  'Low Putts': 'Low putts', 'Super Skins': 'Super skins', 'Blind Partners': 'Blind partners', 'Team Play': 'Team play',
}
const tabLabel = tab => TAB_LABEL[tab] ?? tab

// Desktop section heading for each tab
const TAB_HEADING = {
  '18-Hole': ['18-hole leaderboard', 'Net score to par. Tap a player for their scorecard.'],
  'Front 9': ['Front 9', 'Net score to par on holes 1–9.'],
  'Back 9': ['Back 9', 'Net score to par on holes 10–18.'],
  'Low Gross': ['Low gross', 'Gross score to par.'],
  'Gross Front 9': ['Gross front 9', 'Gross score to par on holes 1–9.'],
  'Gross Back 9': ['Gross back 9', 'Gross score to par on holes 10–18.'],
  'Stableford': ['Stableford', 'Net Stableford points, highest wins.'],
  'Stableford Gross': ['Stableford gross', 'Gross Stableford points, highest wins.'],
  'Nassau': ['Nassau', 'Front 9, back 9 and full 18, each its own bet.'],
  'Scramble': ['Scramble', 'Team gross score to par.'],
  'Match Points': ['Match play', 'Head-to-head net match play.'],
  'Team Match': ['Team match', 'Best ball match play by group.'],
  'Skins': ['Skins', 'Net skins. Ties carry to the next hole.'],
  'Super Skins': ['Super skins', 'Opt-in skins game.'],
  'Low Putts': ['Low putts', 'Fewest putts over 18 holes.'],
  'Blind Partners': ['Blind partners', 'Pairs drawn after the round.'],
  'Team Play': ['Team play', 'Team points from each pick’s finish.'],
  'Payouts': ['Payouts', 'Prize money by player.'],
}

// Tabs that follow the page's Flight A | B switch
const FLIGHT_TABS = ['18-Hole', 'Front 9', 'Back 9', 'Low Gross', 'Gross Front 9', 'Gross Back 9', 'Stableford', 'Stableford Gross', 'Nassau', 'Skins', 'Payouts']
const SCORED_TABS = ['18-Hole', 'Front 9', 'Back 9', 'Low Gross', 'Gross Front 9', 'Gross Back 9', 'Stableford', 'Stableford Gross', 'Nassau', 'Scramble', 'Match Points', 'Team Match', 'Low Putts', 'Skins', 'Super Skins', 'Blind Partners']

function visibleTabs(event, hasTGL = false) {
  if (!event) return ALL_TABS
  const rawFormats = event.formats ?? (event.format ? [event.format] : ['net_stroke'])
  // Normalise: strip per-flight suffix so 'net_stroke_a' matches 'net_stroke'
  const formats  = rawFormats.map(k => k.replace(/_[a-z]$/, ''))
  const sideOpts = event.side_game_options ?? []
  return ALL_TABS.filter(tab => {
    if (tab === 'Payouts')       return event.status === 'complete'
    if (tab === '18-Hole')       return formats.includes('net_stroke')
    if (tab === 'Front 9')       return formats.includes('net_stroke_front9')
    if (tab === 'Back 9')        return formats.includes('net_stroke_back9')
    if (tab === 'Low Gross')     return formats.includes('low_gross')
    if (tab === 'Gross Front 9') return formats.includes('gross_stroke_front9')
    if (tab === 'Gross Back 9')  return formats.includes('gross_stroke_back9')
    if (tab === 'Stableford')    return formats.includes('stableford')
    if (tab === 'Stableford Gross') return formats.includes('stableford_gross')
    if (tab === 'Nassau')        return formats.includes('net_stroke_nassau') || formats.includes('gross_stroke_nassau')
    if (tab === 'Scramble')      return formats.includes('scramble')
    if (tab === 'Match Points')  return formats.includes('match_points') || formats.includes('ryder_cup')
    if (tab === 'Team Match')    return formats.includes('team_match_play')
    if (tab === 'Low Putts')     return sideOpts.includes('low_putts')
    if (tab === 'Skins')          return sideOpts.some(s => s.startsWith('skins_'))
    if (tab === 'Super Skins')    return sideOpts.some(s => s === 'super_skins' || s.startsWith('super_skins_'))
    if (tab === 'Blind Partners') return sideOpts.some(s => s === 'blind_partners' || s.startsWith('blind_partners_')) && (event.side_game_entries?.blind_partner_pairs ?? []).length > 0
    if (tab === 'Team Play')      return hasTGL
    return false
  })
}

// ─── Shared look ──────────────────────────────────────────────────
const CARD = 'overflow-hidden rounded-sm border border-surface-border bg-white'
const HEAD = 'bg-surface-dim text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted'
const LEADER = 'bg-status-active-bg shadow-[inset_4px_0_0_theme(colors.fairway.700)]'
const ROW_BTN = 'w-full text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fairway-500'
const GREEN_TAG = 'bg-status-active-bg text-status-active-text'
const AMBER_TAG = 'bg-status-upcoming-bg text-status-upcoming-text'
const TAG = 'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-bold leading-none'
// Match play sides: first listed (high seed) is forest green, second (low seed) is gold
const SIDE = {
  A: { dot: 'bg-fairway-700', fill: 'bg-fairway-700 text-white', tint: 'bg-status-active-bg text-status-active-text', text: 'text-fairway-700' },
  B: { dot: 'bg-status-upcoming-text', fill: 'bg-status-upcoming-text text-white', tint: 'bg-status-upcoming-bg text-status-upcoming-text', text: 'text-status-upcoming-text' },
}
const CHIP_TONE = { winA: SIDE.A.fill, winB: SIDE.B.fill, leadA: SIDE.A.tint, leadB: SIDE.B.tint, even: 'bg-surface-high text-ink-muted' }

const fullName = p => `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim()
const fmtPts = n => (n % 1 === 0 ? `${n}` : n.toFixed(1))
const money = n => `$${Number(n).toFixed(2)}`

function Empty({ title, children }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-xs text-sm text-ink-muted">{children}</p>}
    </div>
  )
}

function CardHeader({ children, aside }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-surface-border px-4 py-3">
      <h3 className="text-[15px] font-bold text-ink">{children}</h3>
      {aside && <span className="text-xs text-ink-muted">{aside}</span>}
    </div>
  )
}

function Chevron({ open, className = '' }) {
  return (
    <svg className={`h-4 w-4 text-ink-muted transition-transform ${open ? 'rotate-180' : ''} ${className}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  )
}

function StatusPill({ status }) {
  if (status === 'complete') return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-status-active-bg px-2.5 py-1 text-xs font-semibold text-status-active-text">
      <span className="h-1.5 w-1.5 rounded-full bg-fairway-700" aria-hidden="true" />Final
    </span>
  )
  if (status === 'active') return <span className="inline-flex items-center rounded-full bg-status-active-bg px-2.5 py-1 text-xs font-semibold text-status-active-text">Live</span>
  if (status === 'upcoming') return <span className="inline-flex items-center rounded-full bg-status-upcoming-bg px-2.5 py-1 text-xs font-semibold text-status-upcoming-text">Upcoming</span>
  return <span className="inline-flex items-center rounded-full bg-surface-high px-2.5 py-1 text-xs font-semibold text-ink-muted">{status}</span>
}

function LeagueLogo({ url, name }) {
  const initials = (name ?? '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()
  const size = 'h-10 w-10 min-[900px]:h-14 min-[900px]:w-14'
  if (url) return <img src={url} alt={name ?? ''} className={`${size} shrink-0 rounded-full border border-surface-border bg-white object-contain`} />
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-fairway-700 text-xs font-bold text-white min-[900px]:text-sm`} aria-hidden="true">
      {initials || 'G'}
    </span>
  )
}

export default function Leaderboard() {
  const { orgSlug, leagueSlug, eventSlug } = useParams()
  const subdomainOrg = useSubdomainOrg()
  const org          = useOrg()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const directEventId = searchParams.get('eid')
  const { user, isAdmin } = useAuth()
  const hasFeature = useFeatures()
  const homeLink = isAdmin ? '/admin' : user ? '/home' : null
  const fromScorecard = location.state?.from === 'scorecard'
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
  const [logoUrl,       setLogoUrl]       = useState(null)
  const [copied,        setCopied]        = useState(false)

  const subRef   = useRef(null)
  const stripRef = useRef(null)
  const tabRefs  = useRef({})
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
          .select('*, course:courses(*), league:leagues(name, slug), imported_skins(*)')
          .eq('id', directEventId)
          .single()
        ev = data
      } else {
        const { data: league } = await supabase.from('leagues').select('id, name, slug').eq('slug', leagueSlug).single()
        if (!league) { setLoading(false); return }
        const { data } = await supabase
          .from('events')
          .select('*, course:courses(*), league:leagues(name, slug), imported_skins(*)')
          .eq('league_id', league.id)
          .eq('slug', eventSlug)
          .single()
        ev = data
      }

      if (!ev) { setLoading(false); return }

      const eventId = ev.id

      const [{ data: eps }, { data: sg }, { data: mp }] = await Promise.all([
        supabase.from('event_players').select('*, player:players(id, first_name, last_name, intended_role)').eq('event_id', eventId),
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

      // League logo from league settings; the club's logo only when the league has none
      const leagueId = ev.league_id
      supabase.from('leagues').select('org_id, logo_url').eq('id', leagueId).single().then(({ data: lg }) => {
        if (lg?.logo_url) { setLogoUrl(lg.logo_url); return }
        if (org?.logo_url) { setLogoUrl(org.logo_url); return }
        if (lg?.org_id) {
          supabase.from('organizations').select('logo_url').eq('id', lg.org_id).single().then(({ data: o }) => {
            if (o?.logo_url) setLogoUrl(o.logo_url)
          })
        }
      })

      // Load TGL data non-blocking
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

  // Keep the active tab in view in the sideways-scrolling strip (on load and on tap)
  useEffect(() => {
    const strip = stripRef.current
    const el = tabRefs.current[activeTab]
    if (!strip || !el) return
    const target = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2
    strip.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [activeTab, loading, tabs.length])

  if (loading) return <LeaderboardSkeleton />
  if (!event)  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <p className="text-ink-muted">Event not found.</p>
    </div>
  )

  const leaderboards    = course ? computeLeaderboards(eventPlayers, allScores, course)              : null
  const skinsResults    = course ? computeAllSkins(eventPlayers, allScores, course)                  : null
  const stablefordData  = course ? computeStableford(eventPlayers, allScores, course)                : null
  const stablefordGrossData = course ? computeStableford(eventPlayers, allScores, course, true)      : null
  const blindPartnersData = course ? computeBlindPartners(event, eventPlayers, allScores, course)    : null
  const superSkinsResult  = course ? computeSuperSkins(event, eventPlayers, allScores, course)       : null
  const matchData       = course ? computeMatchPoints(eventPlayers, allScores, course, matchPairings, event?.match_rules) : null
  const teamMatchData   = course ? computeTeamMatchPoints(eventPlayers, allScores, course, event?.team_match_config ?? null) : null

  const tglData = (() => {
    if (!leaderboards || !tglTeams.length || !tglSelections.length) return null
    try {
      const epMap = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep]))
      const attachPlayer = r => ({ ...r, player: epMap[r.player_id]?.player ?? null })
      // Combine finished + in-progress rounds so standings update live during the round,
      // not just once every player has posted all 18 holes.
      const byNet18 = (a, b) => a.net18 - b.net18 || a.holesCompleted - b.holesCompleted
      const rerank = arr => {
        const sorted = [...arr].sort(byNet18)
        return sorted.map((p, i) => ({
          ...p,
          rank: i === 0 || sorted[i - 1].net18 !== p.net18 ? i + 1 : sorted[i - 1].rank,
        }))
      }
      const rankedA = rerank([...(leaderboards.full.A ?? []), ...(leaderboards.full.AInProgress ?? [])]).map(attachPlayer)
      const rankedB = rerank([...(leaderboards.full.B ?? []), ...(leaderboards.full.BInProgress ?? [])]).map(attachPlayer)
      if (!rankedA.length && !rankedB.length) return null
      const hasFlights = eventPlayers.some(ep => ep.flight === 'A' || ep.flight === 'B')
      const enrolledA = hasFlights ? eventPlayers.filter(ep => ep.flight === 'A').length : eventPlayers.length
      const enrolledB = eventPlayers.filter(ep => ep.flight === 'B').length
      const pointsA = rankedA.length ? assignTGLPoints(rankedA, Math.max(rankedA.length, enrolledA)) : {}
      const pointsB = rankedB.length ? assignTGLPoints(rankedB, Math.max(rankedB.length, enrolledB)) : {}
      const combinedPoints = { ...pointsA, ...pointsB }
      const allRanked = [...rankedA, ...rankedB]
      return computeTGLEventResults(allRanked, tglSelections, tglTeams, tglMembers, combinedPoints)
    } catch { return null }
  })()

  const playerMap  = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep.player]))
  const flightById = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep.flight ?? null]))
  const flightOf   = id => flightById[id] ?? null
  // Derive flight letters from player assignments first, fall back to event.num_flights config
  const assignedFlights = [...new Set(
    eventPlayers.filter(ep => !ep.is_guest && ep.flight).map(ep => ep.flight)
  )].sort()
  const numFlightsConfig = event?.num_flights ?? (event?.use_flights ? 2 : 0)
  const flightLetters = assignedFlights.length > 0
    ? assignedFlights
    : numFlightsConfig > 0
      ? Array.from({ length: numFlightsConfig }, (_, i) => String.fromCharCode(65 + i))
      : []
  const hasFlights = flightLetters.length > 0
  const nonGuestPlayers = eventPlayers.filter(ep => !ep.is_guest)
  const allGrouped = nonGuestPlayers.length > 0 && nonGuestPlayers.every(ep => ep.group_number)

  const pageTitle = event
    ? `${event.league?.name ?? ''} — ${event.name ?? `Event #${event.event_number}`} Leaderboard | Scorify Golf`
    : 'Live Leaderboard | Scorify Golf'

  const pairingsUrl = subdomainOrg
    ? `/${event.league?.slug}/${event.slug}/schedule`
    : `/${orgSlug}/${event.league?.slug}/${event.slug}/schedule`
  const title = event.course?.name ?? event.name ?? `Event #${event.event_number}`
  const showFlight = hasFlights && FLIGHT_TABS.includes(activeTab)
  const [heading, caption] = TAB_HEADING[activeTab] ?? [tabLabel(activeTab), '']
  const skinsFlight = hasFlights && skinsResults?.[activeFlight] ? activeFlight : 'A'

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked: nothing to do */ }
  }
  const go = (tab, flight) => { setActiveTab(tab); if (flight) setActiveFlight(flight) }

  const glance = allGrouped && leaderboards
    ? atAGlance({ tabs, flightLetters, hasFlights, leaderboards, matchData, event, skinsResults, tglData, playerMap })
    : []

  return (
    <>
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={event ? `Live leaderboard for ${event.name ?? `Event #${event.event_number}`} — ${event.league?.name ?? ''} at ${event.course?.name ?? ''}. Powered by Scorify Golf.` : 'Live golf event leaderboard powered by Scorify Golf.'} />
      <meta property="og:title" content={pageTitle} />
      <meta name="robots" content="noindex" />
    </Helmet>
    <div className="leaderboard-shell min-h-screen bg-surface font-sans">
      {/* Back nav — only for scorers and signed-in members */}
      {(fromScorecard || homeLink) && (
        <div className="mx-auto flex max-w-[1080px] items-center justify-between px-4 min-[900px]:px-6">
          <button type="button" onClick={() => navigate(-1)} className="flex min-h-[44px] items-center text-sm font-medium text-ink-muted hover:text-ink">
            ← {fromScorecard ? 'Back to Scoring' : 'Back'}
          </button>
          {homeLink && <Link to={homeLink} className="flex min-h-[44px] items-center text-sm font-medium text-ink-muted hover:text-ink">Home</Link>}
        </div>
      )}

      {/* Header + tabs: pinned on phones, part of the page on desktop */}
      <header className="sticky top-0 z-20 border-b border-surface-border bg-white min-[900px]:static">
        <div className="mx-auto max-w-[1080px] px-4 pt-3 min-[900px]:px-6 min-[900px]:pt-7">
          <div className="flex items-start gap-3 min-[900px]:items-center min-[900px]:gap-4">
            <LeagueLogo url={logoUrl} name={event.league?.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold uppercase tracking-[0.06em] text-fairway-700 min-[900px]:text-xs">
                {event.league?.name} · Event #{event.event_number}
              </p>
              <h1 className="truncate text-[17px] font-bold leading-tight text-ink min-[900px]:mt-0.5 min-[900px]:text-[28px]">{title}</h1>
              <p className="truncate text-xs text-ink-muted min-[900px]:mt-1 min-[900px]:text-sm">
                {shortDay(event.event_date)} · {eventPlayers.length} player{eventPlayers.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-3">
              <StatusPill status={event.status} />
              <button
                type="button" onClick={copyLink}
                className="min-h-[44px] rounded-sm border border-surface-highest bg-white px-3 text-sm font-semibold text-ink hover:bg-surface-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 min-[900px]:hidden"
              >
                {copied ? 'Copied' : 'Share'}
              </button>
              <Link to={pairingsUrl} className="hidden min-h-[44px] items-center rounded-sm border border-surface-highest bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-dim min-[900px]:inline-flex">
                Pairings &amp; tee times
              </Link>
            </div>
          </div>
        </div>

        {/* Tab strip — scrolls sideways; the fade hints at more tabs */}
        <div className="relative mx-auto mt-2 max-w-[1080px] min-[900px]:mt-5">
          <div ref={stripRef} role="tablist" aria-label="Leaderboard sections" className="flex overflow-x-auto px-1 [scrollbar-width:none] min-[900px]:px-3 [&::-webkit-scrollbar]:hidden">
            {tabs.map(tab => {
              const on = activeTab === tab
              return (
                <button
                  key={tab}
                  ref={el => { tabRefs.current[tab] = el }}
                  type="button" role="tab" aria-selected={on}
                  onClick={() => setActiveTab(tab)}
                  className={`min-h-[44px] flex-none whitespace-nowrap border-b-[3px] px-3 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fairway-500 ${
                    on ? 'border-fairway-700 text-fairway-700' : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  {tabLabel(tab)}
                </button>
              )
            })}
            <span className="w-8 flex-none" aria-hidden="true" />
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" aria-hidden="true" />
        </div>
      </header>

      <div className="mx-auto max-w-[1080px] px-4 py-4 min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_300px] min-[900px]:items-start min-[900px]:gap-6 min-[900px]:px-6 min-[900px]:py-6">
        <main className="min-w-0 space-y-4">
          {/* Desktop heading + the flight switch (the switch alone on phones) */}
          <div className={`${showFlight ? 'flex' : 'hidden min-[900px]:flex'} flex-col gap-3 min-[900px]:flex-row min-[900px]:items-end min-[900px]:justify-between`}>
            <div className="hidden min-w-0 min-[900px]:block">
              <h2 className="text-xl font-bold text-ink">{heading}</h2>
              {caption && <p className="mt-0.5 text-sm text-ink-muted">{caption}</p>}
            </div>
            {showFlight && (
              <SegmentedToggle
                options={flightLetters.map(f => ({ value: f, label: `Flight ${f}` }))}
                value={activeFlight}
                onChange={setActiveFlight}
                label="Flight"
                className="w-full shrink-0 [&>button]:flex-1 min-[900px]:w-auto min-[900px]:[&>button]:min-w-[110px]"
              />
            )}
          </div>

          {/* Gate: require all non-guest players to have a group before showing scored tabs */}
          {!allGrouped && SCORED_TABS.includes(activeTab) && (
            <div className={CARD}>
              <Empty title="Pairings not yet finalized">The leaderboard will appear once every player has been assigned to a group.</Empty>
            </div>
          )}
          {leaderboards && allGrouped && (
            <>
              {activeTab === '18-Hole' && (
                <NetLeaderboard
                  complete={leaderboards.full[activeFlight]}
                  inProgress={leaderboards.full[`${activeFlight}InProgress`]}
                  flight={activeFlight}
                  vsParKey="netVsPar" grossKey="gross18" netKey="net18" handicapKey="course_handicap"
                  progressHolesKey="holesCompleted" maxHoles={18}
                  allScores={allScores} course={course} eventPlayers={eventPlayers}
                />
              )}
              {activeTab === 'Front 9' && (
                <NetLeaderboard
                  complete={leaderboards.front9[activeFlight]}
                  inProgress={leaderboards.front9[`${activeFlight}InProgress`]}
                  flight={activeFlight} vsLabel="Out"
                  vsParKey="f9VsPar" grossKey="grossF9" netKey="netF9" handicapKey="f9Handicap"
                  progressHolesKey="f9Holes" maxHoles={9}
                  allScores={allScores} course={course} eventPlayers={eventPlayers}
                />
              )}
              {activeTab === 'Back 9' && (
                <NetLeaderboard
                  complete={leaderboards.back9[activeFlight]}
                  inProgress={leaderboards.back9[`${activeFlight}InProgress`]}
                  flight={activeFlight} vsLabel="In"
                  vsParKey="b9VsPar" grossKey="grossB9" netKey="netB9" handicapKey="b9Handicap"
                  progressHolesKey="b9Holes" maxHoles={9}
                  allScores={allScores} course={course} eventPlayers={eventPlayers}
                />
              )}
              {activeTab === 'Low Gross' && (
                <NetLeaderboard
                  complete={leaderboards.grossFull[activeFlight]}
                  inProgress={leaderboards.grossFull[`${activeFlight}InProgress`]}
                  flight={activeFlight}
                  vsParKey="grossVsPar" grossKey="gross18" netKey="gross18" handicapKey="course_handicap"
                  progressHolesKey="holesCompleted" maxHoles={18}
                  allScores={allScores} course={course} eventPlayers={eventPlayers}
                />
              )}
              {activeTab === 'Gross Front 9' && (
                <NetLeaderboard
                  complete={leaderboards.grossFront9[activeFlight]}
                  inProgress={leaderboards.grossFront9[`${activeFlight}InProgress`]}
                  flight={activeFlight} vsLabel="Out"
                  vsParKey="grossF9VsPar" grossKey="grossF9" netKey="grossF9" handicapKey="f9Handicap"
                  progressHolesKey="f9Holes" maxHoles={9}
                  allScores={allScores} course={course} eventPlayers={eventPlayers}
                />
              )}
              {activeTab === 'Gross Back 9' && (
                <NetLeaderboard
                  complete={leaderboards.grossBack9[activeFlight]}
                  inProgress={leaderboards.grossBack9[`${activeFlight}InProgress`]}
                  flight={activeFlight} vsLabel="In"
                  vsParKey="grossB9VsPar" grossKey="grossB9" netKey="grossB9" handicapKey="b9Handicap"
                  progressHolesKey="b9Holes" maxHoles={9}
                  allScores={allScores} course={course} eventPlayers={eventPlayers}
                />
              )}
              {activeTab === 'Low Putts' && (
                <PuttLeaderboard data={leaderboards.putts} allScores={allScores} course={course} flightOf={flightOf} hasFlights={hasFlights} />
              )}
              {activeTab === 'Stableford' && stablefordData && (
                <StablefordLeaderboard data={stablefordData} activeFlight={activeFlight} allScores={allScores} course={course} />
              )}
              {activeTab === 'Stableford Gross' && stablefordGrossData && (
                <StablefordLeaderboard data={stablefordGrossData} activeFlight={activeFlight} allScores={allScores} course={course} />
              )}
              {activeTab === 'Nassau' && leaderboards && (
                <NassauBoard leaderboards={leaderboards} event={event} activeFlight={activeFlight} />
              )}
              {activeTab === 'Match Points' && matchData && (
                <MatchPointsBoard matchData={matchData} event={event} />
              )}
              {activeTab === 'Team Match' && teamMatchData && (
                <TeamMatchBoard teamMatchData={teamMatchData} teamAName={teamMatchData.teamAName} teamBName={teamMatchData.teamBName} event={event} />
              )}
              {activeTab === 'Skins' && skinsResults && (
                <SkinsView result={skinsResults[skinsFlight]} title={hasFlights ? `Skins won · Flight ${skinsFlight}` : 'Skins won'} playerMap={playerMap} />
              )}
              {activeTab === 'Super Skins' && (
                <SuperSkinsBoard event={event} eventPlayers={eventPlayers} allScores={allScores} course={course} playerMap={playerMap} />
              )}
              {activeTab === 'Blind Partners' && (
                <BlindPartnersLeaderboard event={event} eventPlayers={eventPlayers} allScores={allScores} course={course} />
              )}
              {activeTab === 'Scramble' && (
                <ScrambleLeaderboard eventPlayers={eventPlayers} allScores={allScores} course={course} />
              )}
              {activeTab === 'Payouts' && (
            <PayoutsBoard
              event={event}
              eventPlayers={eventPlayers}
              leaderboards={leaderboards}
              sideGames={sideGames}
              skinsResults={skinsResults}
              stablefordData={stablefordData}
              stablefordGrossData={stablefordGrossData}
              blindPartnersData={blindPartnersData}
              superSkinsResult={superSkinsResult}
              playerMap={playerMap}
              flight={activeFlight}
              hasFlights={hasFlights}
              flightOf={flightOf}
            />
              )}
              {activeTab === 'Team Play' && (
                <TGLBoard tglData={tglData} locked={tglLocked} flightOf={flightOf} hasFlights={hasFlights} />
              )}
            </>
          )}

          <div className="flex justify-center min-[900px]:hidden">
            <Link to={pairingsUrl} className="inline-flex min-h-[44px] items-center px-3 text-sm font-semibold text-fairway-700 hover:underline">
              Pairings &amp; tee times →
            </Link>
          </div>
        </main>

        {/* Right rail — desktop only */}
        <aside className="hidden space-y-4 min-[900px]:sticky min-[900px]:top-6 min-[900px]:block">
          {glance.length > 0 && (
            <div className={CARD}>
              <CardHeader>At a glance</CardHeader>
              <ul className="divide-y divide-surface-border">
                {glance.map(g => (
                  <li key={g.key}>
                    <button type="button" onClick={() => go(g.tab, g.flight)} className={`${ROW_BTN} block min-h-[44px] px-4 py-3 hover:bg-surface-dim`}>
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{g.label}</span>
                      <span className="mt-0.5 flex items-baseline justify-between gap-2">
                        <span className="min-w-0 break-words text-sm font-bold text-ink">{g.value}</span>
                        {g.aside && <span className="shrink-0 text-sm font-semibold tabular-nums text-fairway-700">{g.aside}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={`${CARD} p-4`}>
            <h3 className="text-[15px] font-bold text-ink">Share</h3>
            <p className="mt-1 text-sm text-ink-muted">Send the live leaderboard to your group.</p>
            <button
              type="button" onClick={copyLink}
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-sm bg-fairway-700 px-4 text-sm font-semibold text-white hover:bg-fairway-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 focus-visible:ring-offset-2"
            >
              {copied ? 'Link copied' : 'Copy leaderboard link'}
            </button>
          </div>
        </aside>
      </div>
    </div>
    </>
  )
}

// ─── At a glance (desktop rail) ───────────────────────────────────
// Only the games this event has; each item opens its tab (and flight).
function atAGlance({ tabs, flightLetters, hasFlights, leaderboards, matchData, event, skinsResults, tglData, playerMap }) {
  const items = []
  const flights = hasFlights ? flightLetters : ['A']
  const tiedName = (names) => (names.length === 1 ? names[0] : `${names.length} tied`)
  if (tabs.includes('18-Hole')) {
    for (const f of flights) {
      const list = [...(leaderboards.full[f] ?? []), ...(leaderboards.full[`${f}InProgress`] ?? [])].filter(p => p.netVsPar != null)
      if (!list.length) continue
      const best = Math.min(...list.map(p => p.netVsPar))
      const top = list.filter(p => p.netVsPar === best)
      items.push({ key: `net-${f}`, tab: '18-Hole', flight: f, label: hasFlights ? `Net leader · Flight ${f}` : 'Net leader', value: tiedName(top.map(p => fullName(p.player))), aside: toParText(best) })
    }
  }
  if (tabs.includes('Match Points') && matchData?.pairings?.length && matchData.hasTeams) {
    const names = event?.ryder_cup_teams ?? {}
    const a = names.a?.trim() || 'Team A'
    const b = names.b?.trim() || 'Team B'
    items.push({ key: 'match', tab: 'Match Points', label: 'Match play', value: `${a} ${fmtPts(matchData.teamPoints.A)} – ${fmtPts(matchData.teamPoints.B)} ${b}` })
  }
  if (tabs.includes('Skins') && skinsResults) {
    for (const f of flights) {
      const counts = Object.entries(skinsResults[f]?.playerSkins ?? {}).filter(([, n]) => n > 0)
      if (!counts.length) continue
      const most = Math.max(...counts.map(([, n]) => n))
      const who = counts.filter(([, n]) => n === most).map(([pid]) => fullName(playerMap[pid]))
      items.push({ key: `skins-${f}`, tab: 'Skins', flight: f, label: hasFlights ? `Most skins · Flight ${f}` : 'Most skins', value: tiedName(who), aside: `${most} skin${most === 1 ? '' : 's'}` })
    }
  }
  if (tabs.includes('Low Putts') && leaderboards.putts?.length) {
    const best = Math.min(...leaderboards.putts.map(p => p.totalPutts))
    const top = leaderboards.putts.filter(p => p.totalPutts === best)
    items.push({ key: 'putts', tab: 'Low Putts', label: 'Low putts', value: tiedName(top.map(p => fullName(p.player))), aside: `${best}` })
  }
  if (tabs.includes('Team Play') && tglData?.teamResults?.length) {
    const t = tglData.teamResults[0]
    items.push({ key: 'tgl', tab: 'Team Play', label: 'Team play leader', value: t.team.name, aside: `${fmtPts(t.teamPoints)} pts` })
  }
  return items
}

// ─── Scramble Leaderboard ─────────────────────────────────────────
function ScrambleLeaderboard({ eventPlayers, allScores, course }) {
  const parPerHole = course?.par_per_hole ?? Array(18).fill(4)

  // Build groups
  const groupMap = {}
  for (const ep of eventPlayers) {
    const g = ep.group_number
    if (!g) continue
    if (!groupMap[g]) groupMap[g] = []
    groupMap[g].push(ep)
  }

  const groups = Object.entries(groupMap).map(([gNum, players]) => {
    // All players share the same score in scramble — use first player's scores
    const pid = players[0]?.player_id
    const playerScores = allScores.filter(s => s.player_id === pid)
    const holesPlayed = playerScores.length
    const totalGross = playerScores.reduce((s, sc) => s + (sc.gross_score ?? 0), 0)
    const holesParSum = parPerHole.slice(0, holesPlayed).reduce((s, p) => s + p, 0)
    const grossVsPar = holesPlayed > 0 ? totalGross - holesParSum : null
    const teamName = players.map(ep => ep.player?.last_name ?? '?').join(' / ')
    return { groupNum: Number(gNum), players, totalGross: holesPlayed > 0 ? totalGross : null, holesPlayed, grossVsPar, teamName }
  })

  const withScores = groups.filter(g => g.totalGross != null)
  const noScores   = groups.filter(g => g.totalGross == null)

  withScores.sort((a, b) => (a.totalGross ?? 999) - (b.totalGross ?? 999))

  // Assign ranks with tie handling
  const ranked = withScores.map((g, _, arr) => {
    const rank = arr.filter(x => (x.totalGross ?? 999) < (g.totalGross ?? 999)).length + 1
    const tied = arr.filter(x => x.totalGross === g.totalGross).length > 1
    return { ...g, rank, rankLabel: tied ? `T${rank}` : `${rank}` }
  })

  const all = [...ranked, ...noScores.map(g => ({ ...g, rankLabel: '—' }))]

  if (!all.length) return <div className={CARD}><Empty title="No groups assigned yet" /></div>

  const COLS = 'grid grid-cols-[2.25rem_minmax(0,1fr)_3.75rem_2.25rem] gap-x-2'
  return (
    <div className={CARD}>
      <div className={`${COLS} ${HEAD} px-4 py-2.5`}>
        <span>Pos</span><span>Team</span><span className="text-right">To par</span><span className="text-right">Thru</span>
      </div>
      <ul className="divide-y divide-surface-border">
        {all.map(g => {
          const vs = g.grossVsPar
          return (
            <li key={g.groupNum} className={`${COLS} items-center px-4 py-3 ${g.rank === 1 ? LEADER : ''}`}>
              <span className="text-sm font-semibold tabular-nums text-ink-muted">{g.rankLabel}</span>
              <span className="min-w-0">
                <span className="block break-words text-[15px] font-bold text-ink">{g.teamName}</span>
                <span className="block break-words text-xs text-ink-muted">{g.players.map(ep => fullName(ep.player)).join(', ')}</span>
              </span>
              <span className={`text-right text-xl font-bold tabular-nums ${vs == null ? 'text-ink-muted' : vs <= 0 ? 'text-fairway-700' : 'text-ink'}`}>{toParText(vs)}</span>
              <span className="text-right text-sm tabular-nums text-ink-muted">{g.holesPlayed === 18 ? 'F' : g.holesPlayed || '—'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Net Leaderboard ──────────────────────────────────────────────
// Phone: Pos | Player (CH · Gross · Net underneath) | To par | Thru.
// Desktop: Pos | Player | CH | Gross | Net | To par | Thru.
const SCORE_COLS = 'grid grid-cols-[2.25rem_minmax(0,1fr)_3.75rem_2.25rem] gap-x-2 min-[900px]:grid-cols-[3rem_minmax(0,1fr)_3.5rem_4rem_4rem_4.5rem_3rem] min-[900px]:gap-x-3'

function NetLeaderboard({ complete, inProgress, flight, vsLabel = 'To par', vsParKey = 'netVsPar', grossKey = 'gross18', netKey = 'net18', handicapKey = 'course_handicap', progressHolesKey = 'holesCompleted', maxHoles = 18, allScores = [], course = null, eventPlayers = [] }) {
  const [scorecardPlayer, setScorecardPlayer] = useState(null)

  const allComplete = complete ?? []
  const showNet = netKey !== grossKey

  // Detect no-show players: all their scores have entered_by === 'no_show'
  const noShowPlayerIds = new Set(
    [...new Set(allScores.map(s => s.player_id))].filter(pid => {
      const playerScores = allScores.filter(s => s.player_id === pid)
      return playerScores.length > 0 && playerScores.every(s => s.entered_by === 'no_show')
    })
  )

  // Merge all players and sort by score — lowest net score wins regardless of holes played
  // No-show players are separated and shown at the bottom
  const merged = [
    ...(allComplete ?? []).map(p => ({ ...p, finished: true })),
    ...(inProgress  ?? []).map(p => ({ ...p, finished: false })),
  ]
  const scoredPlayerIds = new Set(merged.map(p => p.player_id))
  const competitive = merged.filter(p => !noShowPlayerIds.has(p.player_id))
  const noShows     = merged.filter(p => noShowPlayerIds.has(p.player_id))
  const hasFlightData = eventPlayers.some(ep => !ep.is_guest && (ep.flight === 'A' || ep.flight === 'B'))
  const notStarted  = eventPlayers
    .filter(ep => {
      if (ep.is_guest) return false
      if (scoredPlayerIds.has(ep.player_id)) return false
      if (noShowPlayerIds.has(ep.player_id)) return false
      if (hasFlightData) return ep.flight === flight
      return true
    })
    .map(ep => ({ ...ep, player: ep.player }))
    .sort((a, b) => (a.course_handicap ?? 999) - (b.course_handicap ?? 999))

  competitive.sort((a, b) => {
    const aVs = a[vsParKey] ?? 999
    const bVs = b[vsParKey] ?? 999
    return aVs - bVs
  })

  // Assign display ranks across competitive list only (ties share rank)
  const withRanks = competitive.map((p, _, arr) => {
    const vs = p[vsParKey]
    const rank = arr.filter(x => (x[vsParKey] ?? 999) < (vs ?? 999)).length + 1
    const tied = arr.filter(x => x[vsParKey] === vs).length > 1
    return { ...p, mergedRank: rank, mergedRankLabel: tied ? `T${rank}` : `${rank}` }
  })

  if (!withRanks.length && !noShows.length && !notStarted.length) {
    return <div className={CARD}><Empty title="No scores yet" /></div>
  }

  const desk = 'hidden text-right text-sm tabular-nums text-ink min-[900px]:block'
  return (
    <div className={CARD}>
      <div className={`${SCORE_COLS} ${HEAD} items-center px-4 py-2.5`}>
        <span>Pos</span><span>Player</span>
        <span className="hidden text-right min-[900px]:block">CH</span>
        <span className="hidden text-right min-[900px]:block">Gross</span>
        <span className="hidden text-right min-[900px]:block">Net</span>
        <span className="text-right">{vsLabel}</span>
        <span className="text-right">Thru</span>
      </div>

      <ul className="divide-y divide-surface-border">
        {withRanks.map(p => {
          const holesThru = p.finished
            ? (p.holesCompleted ?? p.f9Holes ?? p.b9Holes ?? 18)
            : (p[progressHolesKey] ?? 0)
          const vs = p[vsParKey]
          const ch = p[handicapKey] ?? p.course_handicap
          const gross = p[grossKey] ?? '—'
          const net = showNet ? (p[netKey] ?? '—') : '—'
          const isFirst = p.mergedRank === 1
          return (
            <li key={p.player_id}>
              <button
                type="button"
                onClick={() => course && setScorecardPlayer(p)}
                aria-label={`${fullName(p.player)}, ${toParText(vs)}. Open scorecard`}
                className={`${SCORE_COLS} ${ROW_BTN} min-h-[60px] items-center px-4 py-3 ${isFirst ? LEADER : 'bg-white hover:bg-surface-dim'}`}
              >
                <span className="text-sm font-semibold tabular-nums text-ink-muted">{p.mergedRankLabel}</span>
                <span className="min-w-0">
                  <span className="block break-words text-[15px] font-bold leading-snug text-ink">{fullName(p.player)}</span>
                  <span className="block text-xs text-ink-muted min-[900px]:hidden">
                    CH {ch ?? '—'} · Gross {gross}{showNet ? ` · Net ${net}` : ''}
                  </span>
                </span>
                <span className={desk}>{ch ?? '—'}</span>
                <span className={desk}>{gross}</span>
                <span className={desk}>{net}</span>
                <span className={`text-right text-xl font-bold tabular-nums ${vs == null ? 'text-ink-muted' : vs <= 0 ? 'text-fairway-700' : 'text-ink'}`}>
                  {toParText(vs)}
                </span>
                <span className="text-right text-sm font-medium tabular-nums text-ink-muted">
                  {p.finished && holesThru === maxHoles ? 'F' : holesThru || '—'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* No-show players — shown at bottom, outside competitive rankings */}
      {noShows.length > 0 && (
        <>
          <div className={`px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${AMBER_TAG}`}>No show</div>
          <ul className="divide-y divide-surface-border">
            {noShows.map(p => (
              <li key={p.player_id} className={`${SCORE_COLS} items-center px-4 py-3 text-ink-muted`}>
                <span className="text-sm font-semibold">—</span>
                <span className="min-w-0">
                  <span className="block break-words text-[15px] font-semibold text-ink-muted">{fullName(p.player)}</span>
                  <span className="block text-xs text-status-upcoming-text">No show</span>
                </span>
                <span className="hidden min-[900px]:block" /><span className="hidden min-[900px]:block" /><span className="hidden min-[900px]:block" />
                <span className="text-right text-sm">—</span>
                <span className="text-right text-sm">—</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {notStarted.length > 0 && (
        <>
          <div className={`${HEAD} border-t border-surface-border px-4 py-1.5`}>Not started</div>
          <ul className="divide-y divide-surface-border">
            {notStarted.map(ep => (
              <li key={ep.player_id} className={`${SCORE_COLS} items-center px-4 py-3`}>
                <span className="text-sm font-semibold text-ink-muted">—</span>
                <span className="min-w-0">
                  <span className="block break-words text-[15px] font-semibold text-ink-muted">{fullName(ep.player)}</span>
                  <span className="block text-xs text-ink-muted min-[900px]:hidden">CH {ep.course_handicap ?? '—'}</span>
                </span>
                <span className="hidden text-right text-sm tabular-nums text-ink-muted min-[900px]:block">{ep.course_handicap ?? '—'}</span>
                <span className="hidden min-[900px]:block" /><span className="hidden min-[900px]:block" />
                <span className="text-right text-sm text-ink-muted">—</span>
                <span className="text-right text-sm text-ink-muted">—</span>
              </li>
            ))}
          </ul>
        </>
      )}
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
const PUTTS_PAGE = 10

function PuttLeaderboard({ data, allScores = [], course = null, flightOf, hasFlights }) {
  const [scorecardPlayer, setScorecardPlayer] = useState(null)
  const [showAll, setShowAll] = useState(false)
  if (!data?.length) return <div className={CARD}><Empty title="No complete rounds yet" /></div>

  // Assign ranks with tie detection (lowest putts = best)
  const ranked = data.map((p, i, arr) => {
    const tiedWith = arr.filter(x => x.totalPutts === p.totalPutts)
    const rank = arr.filter(x => x.totalPutts < p.totalPutts).length + 1
    const rankLabel = tiedWith.length > 1 ? `T${rank}` : `${rank}`
    return { ...p, rank, rankLabel }
  })
  const visible = showAll ? ranked : ranked.slice(0, PUTTS_PAGE)
  const COLS = 'grid grid-cols-[2.25rem_minmax(0,1fr)_3.5rem] gap-x-2'

  return (
    <div className={CARD}>
      <div className={`${COLS} ${HEAD} px-4 py-2.5`}>
        <span>Pos</span><span>Player</span><span className="text-right">Putts</span>
      </div>
      <ul className="divide-y divide-surface-border">
        {visible.map(p => {
          const fl = p.flight ?? flightOf(p.player_id)
          return (
            <li key={p.player_id}>
              <button
                type="button"
                onClick={() => course && setScorecardPlayer(p)}
                className={`${COLS} ${ROW_BTN} min-h-[52px] items-center px-4 py-3 ${p.rank === 1 ? LEADER : 'bg-white hover:bg-surface-dim'}`}
              >
                <span className="text-sm font-semibold tabular-nums text-ink-muted">{p.rankLabel}</span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="break-words text-[15px] font-bold text-ink">{fullName(p.player)}</span>
                  {hasFlights && fl && <span className={`${TAG} ${fl === 'A' ? GREEN_TAG : 'bg-surface-high text-ink-muted'}`}>{fl}</span>}
                </span>
                <span className="text-right text-xl font-bold tabular-nums text-ink">{p.totalPutts}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {ranked.length > PUTTS_PAGE && (
        <div className="border-t border-surface-border px-4 py-1 text-center">
          <button
            type="button" onClick={() => setShowAll(s => !s)} aria-expanded={showAll}
            className="min-h-[44px] rounded-sm px-4 text-sm font-semibold text-fairway-700 hover:bg-surface-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500"
          >
            {showAll ? 'Show fewer' : `Show all ${ranked.length}`}
          </button>
        </div>
      )}
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

// ─── Skins (shared by Skins and Super Skins) ──────────────────────
function SkinsView({ result, title, playerMap }) {
  if (!result) return <div className={CARD}><Empty title="No skins yet" /></div>
  const totals = Object.entries(result.playerSkins).filter(([, c]) => c > 0).sort(([, a], [, b]) => b - a)
  const rows = skinsHoleRows(result.holes)
  const nameOf = pid => (playerMap[pid] ? fullName(playerMap[pid]) : pid)

  return (
    <div className="space-y-4">
      {result.carryoverToNext && (
        <div className={`rounded-sm border border-surface-border px-4 py-3 text-sm font-medium ${AMBER_TAG}`}>
          {result.carryoverAmount} skin{result.carryoverAmount !== 1 ? 's' : ''} carry to the next event (no winner this round)
        </div>
      )}
      <div className="grid gap-4 min-[900px]:grid-cols-2 min-[900px]:items-start">
        {totals.length > 0 && (
          <div className={CARD}>
            <CardHeader>{title}</CardHeader>
            <ul className="divide-y divide-surface-border">
              {totals.map(([pid, count]) => (
                <li key={pid} className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0 break-words text-[15px] font-semibold text-ink">{nameOf(pid)}</span>
                  <span className="shrink-0 text-[15px] font-bold tabular-nums text-fairway-700">{count} skin{count !== 1 ? 's' : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className={CARD}>
          <CardHeader>Hole by hole</CardHeader>
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">No holes complete yet.</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {rows.map(r => r.type === 'tied' ? (
                <li key={`t${r.from}`} className="flex min-h-[48px] items-center gap-3 bg-status-upcoming-bg/60 px-4 py-3">
                  <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-ink-muted">{holeRange(r.from, r.to)}</span>
                  <span className="min-w-0 flex-1 text-sm text-ink-muted">Tied · carry</span>
                  <span className={`${TAG} ${AMBER_TAG}`}>{r.carried} carried</span>
                </li>
              ) : (
                <li key={`w${r.hole}`} className="flex min-h-[48px] items-center gap-3 px-4 py-3">
                  <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-ink-muted">{r.hole}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[15px] font-bold text-ink">{nameOf(r.winner)}</span>
                    {r.parts.length > 0 && (
                      <span className="block text-xs text-ink-muted">
                        {r.parts.map((part, i) => <span key={i} className="whitespace-nowrap">{i > 0 ? ' + ' : ''}{part}</span>)}
                      </span>
                    )}
                  </span>
                  <span className={`${TAG} ${GREEN_TAG}`}>{r.skinsWon} skin{r.skinsWon !== 1 ? 's' : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Super Skins Leaderboard ──────────────────────────────────────
function SuperSkinsBoard({ event, eventPlayers, allScores, course, playerMap }) {
  const [flight, setFlight] = useState('A')
  const allResults = computeSuperSkins(event, eventPlayers, allScores, course)

  if (!allResults) return <div className={CARD}><Empty title="No players have opted in to Super Skins yet" /></div>

  // Only show the flight toggle when Super Skins is actually scoped per flight
  // (independent pot per flight) — not merely because the event has flights.
  const perFlight = (event?.side_game_options ?? []).some(s => /^super_skins_[a-z]$/.test(s))
  const showFlightToggle = perFlight && (allResults.A.entrantCount > 0) && (allResults.B.entrantCount > 0)
  const activeFlight = showFlightToggle ? flight : (allResults.A.entrantCount > 0 ? 'A' : 'B')
  const result = allResults[activeFlight]

  return (
    <div className="space-y-4">
      {showFlightToggle && (
        <SegmentedToggle
          options={['A', 'B'].map(f => ({ value: f, label: `Flight ${f}` }))}
          value={activeFlight} onChange={setFlight} label="Super skins flight"
          className="w-full [&>button]:flex-1 min-[900px]:w-auto"
        />
      )}
      <SkinsView result={result} title={showFlightToggle ? `Skins won · Flight ${activeFlight}` : 'Skins won'} playerMap={playerMap} />
    </div>
  )
}

// ─── Blind Partners Leaderboard ───────────────────────────────────
function BlindPartnersLeaderboard({ event, eventPlayers, allScores, course }) {
  const pairs   = event?.side_game_entries?.blind_partner_pairs ?? []
  const parPerHole = course?.par_per_hole ?? []

  function playerName(id) {
    const ep = eventPlayers.find(e => e.player_id === id)
    const p  = ep?.player ?? {}
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
  }

  const ranked = computeBlindPartners(event, eventPlayers, allScores, course)
  const isStableford = blindPartnersMode(event) === 'stableford'

  // Tied pairs share a rank — label them T2 etc. (same convention as the net board)
  const rankLabel = (pair) =>
    ranked.filter(x => x.rank === pair.rank).length > 1 ? `T${pair.rank}` : `${pair.rank}`

  if (pairs.length === 0) return <div className={CARD}><Empty title="No pairs drawn yet" /></div>

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-muted">
        {isStableford
          ? 'Combined Stableford points per pair — highest wins.'
          : 'Combined net score per pair — lowest wins.'}
      </p>
      <div className={CARD}>
        <ul className="divide-y divide-surface-border">
          {ranked.map(pair => {
            const parTotal = parPerHole.reduce((a, b) => a + b, 0) * 2
            const color = isStableford || pair.combinedScore <= parTotal ? 'text-fairway-700' : 'text-ink'
            return (
              <li key={pair.idx} className={`flex items-center justify-between gap-3 px-4 py-3 ${pair.rank === 1 ? LEADER : ''}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-7 shrink-0 text-sm font-semibold text-ink-muted">{rankLabel(pair)}</span>
                  <div className="min-w-0">
                    <div className="break-words text-[15px] font-bold text-ink">{playerName(pair.p1)}</div>
                    {pair.p2
                      ? <div className="break-words text-[15px] font-bold text-ink">{playerName(pair.p2)}</div>
                      : pair.oddConfig?.type === 'ghost'
                        ? <div className="text-xs italic text-status-upcoming-text">Ghost ({pair.oddConfig.score ?? '?'} {isStableford ? 'pts' : 'net'})</div>
                        : pair.oddConfig?.type === 'blind' && pair.oddConfig.player_id
                          ? <div className="text-xs italic text-status-upcoming-text">{playerName(pair.oddConfig.player_id)}'s score</div>
                          : <div className="text-xs italic text-ink-muted">no partner assigned</div>
                    }
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-xl font-bold tabular-nums ${color}`}>{pair.combinedScore}</div>
                  <div className="text-xs text-ink-muted">{pair.holesPlayed} holes</div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

// ─── Stableford Leaderboard ───────────────────────────────────────
function StablefordLeaderboard({ data, activeFlight, allScores = [], course = null }) {
  const [scorecardPlayer, setScorecardPlayer] = useState(null)
  const list = data[activeFlight] ?? []

  // Tied players share a rank — label them T3 etc. (same convention as the net board)
  const rankLabel = (p) =>
    list.filter(x => x.rank === p.rank).length > 1 ? `T${p.rank}` : `${p.rank}`

  if (!list.length) return <div className={CARD}><Empty title={`No scores yet for Flight ${activeFlight}`} /></div>

  const COLS = 'grid grid-cols-[2.25rem_minmax(0,1fr)_3.5rem] gap-x-2'
  return (
    <div className="space-y-3">
      <div className={CARD}>
        <div className={`${COLS} ${HEAD} px-4 py-2.5`}>
          <span>Pos</span><span>Player</span><span className="text-right">Pts</span>
        </div>
        <ul className="divide-y divide-surface-border">
          {list.map(p => (
            <li key={p.player_id}>
              <button
                type="button"
                onClick={() => course && setScorecardPlayer(p)}
                className={`${COLS} ${ROW_BTN} min-h-[60px] items-center px-4 py-3 ${p.rank === 1 ? LEADER : 'bg-white hover:bg-surface-dim'}`}
              >
                <span className="text-sm font-semibold tabular-nums text-ink-muted">{rankLabel(p)}</span>
                <span className="min-w-0">
                  <span className="block break-words text-[15px] font-bold text-ink">{fullName(p.player)}</span>
                  <span className="block text-xs text-ink-muted">CH {p.course_handicap} · {p.holesPlayed} holes</span>
                </span>
                <span className="text-right text-xl font-bold tabular-nums text-fairway-700">{p.totalPoints}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-center text-xs text-ink-muted">Eagle=4 · Birdie=3 · Par=2 · Bogey=1 · DBL+=0 (net)</p>
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

// ─── Nassau Board ─────────────────────────────────────────────────
// Nassau is three independent bets (Front 9, Back 9, Full 18) reusing the
// same leaderboards already computed for those tabs — no separate scoring
// engine needed. Shows the current leader(s) of each bet, net and/or gross
// depending on which variant(s) were selected for the event.
function NassauBoard({ leaderboards, event, activeFlight }) {
  const formats = (event.formats ?? (event.format ? [event.format] : [])).map(k => k.replace(/_[a-z]$/, ''))
  const variants = []
  if (formats.includes('net_stroke_nassau'))   variants.push({ key: 'net',   label: 'Net' })
  if (formats.includes('gross_stroke_nassau')) variants.push({ key: 'gross', label: 'Gross' })
  if (!variants.length) variants.push({ key: 'net', label: 'Net' })

  const betsFor = (variantKey) => ([
    { label: 'Front 9', list: (variantKey === 'gross' ? leaderboards.grossFront9 : leaderboards.front9)[activeFlight] ?? [], scoreKey: variantKey === 'gross' ? 'grossF9' : 'netF9' },
    { label: 'Back 9',  list: (variantKey === 'gross' ? leaderboards.grossBack9  : leaderboards.back9)[activeFlight]  ?? [], scoreKey: variantKey === 'gross' ? 'grossB9' : 'netB9' },
    { label: 'Full 18', list: (variantKey === 'gross' ? leaderboards.grossFull   : leaderboards.full)[activeFlight]   ?? [], scoreKey: variantKey === 'gross' ? 'gross18' : 'net18' },
  ])

  const anyScores = variants.some(v => betsFor(v.key).some(b => b.list.length > 0))
  if (!anyScores) return <div className={CARD}><Empty title={`No Nassau scores yet for Flight ${activeFlight}`} /></div>

  return (
    <div className="space-y-5">
      {variants.map(v => (
        <div key={v.key}>
          {variants.length > 1 && (
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{v.label}</h3>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {betsFor(v.key).map(bet => (
              <div key={bet.label} className={CARD}>
                <div className={`${HEAD} px-3 py-2`}>{bet.label}</div>
                {bet.list.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-ink-muted">No scores yet</div>
                ) : (
                  bet.list.filter(p => p.rank === 1).map(p => (
                    <div key={p.player_id} className="border-b border-surface-border px-3 py-2.5 last:border-0">
                      <div className="text-sm font-bold leading-tight text-ink">{fullName(p.player)}</div>
                      <div className="mt-0.5 text-xs text-ink-muted">{p[bet.scoreKey]} · leader</div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-center text-xs text-ink-muted">Three independent bets — Front 9, Back 9, Full 18 — each scored and paid separately.</p>
    </div>
  )
}

// ─── Match play pieces (shared by Match play and Team match) ──────
function MatchScoreCard({ labelA, labelB, a, b, complete, caption = 'Matches won' }) {
  const leader = a > b ? labelA : b > a ? labelB : null
  const verdict = leader ? `${leader} ${complete ? 'wins' : 'leads'}` : 'All square'
  return (
    <div className={`${CARD} grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-4`}>
      <div className="min-w-0">
        <p className="break-words text-sm font-bold text-fairway-700">{labelA}</p>
        <p className="text-[40px] font-bold leading-none tabular-nums text-fairway-700">{fmtPts(a)}</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-ink-muted">{caption}</p>
        <p className="text-sm font-bold text-ink">{verdict}</p>
      </div>
      <div className="min-w-0 text-right">
        <p className="break-words text-sm font-bold text-status-upcoming-text">{labelB}</p>
        <p className="text-[40px] font-bold leading-none tabular-nums text-status-upcoming-text">{fmtPts(b)}</p>
      </div>
    </div>
  )
}

/**
 * One match: phone stacks side A (green dot) over side B (gold dot) with the result chip on the
 * right; desktop puts the two sides either side of the chip. The whole row toggles the detail.
 */
function MatchRow({ m, nameA, nameB, tagA = 0, tagB = 0, open, onToggle, children }) {
  const chip = matchChip(m)
  const decided = m.winner === 'A' || m.winner === 'B'
  const lead = decided ? m.winner : m.holesPlayed > 0 && m.winner == null ? (m.upBy > 0 ? 'A' : m.upBy < 0 ? 'B' : null) : null
  const inProgress = m.winner == null && m.holesPlayed > 0 && !m.needsWinner
  const nameCls = side => decided
    ? (m.winner === side ? 'font-bold text-ink' : 'font-medium text-ink-muted')
    : lead === side ? 'font-bold text-ink' : 'font-semibold text-ink'
  const Side = ({ side, name, tag, className }) => (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${SIDE[side].dot}`} aria-hidden="true" />
      <span className={`min-w-0 break-words text-[15px] leading-snug ${nameCls(side)}`}>{name}</span>
      {tag > 0 && <span className={`${TAG} ${GREEN_TAG} shrink-0`} title={`Receives ${tag} stroke${tag === 1 ? '' : 's'}`}>+{tag}</span>}
    </span>
  )
  return (
    <li>
      <button
        type="button" onClick={onToggle} aria-expanded={open}
        className={`${ROW_BTN} grid min-h-[64px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-surface-dim min-[900px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]`}
      >
        <Side side="A" name={nameA} tag={tagA} className="col-start-1 row-start-1 min-[900px]:justify-end" />
        <Side side="B" name={nameB} tag={tagB} className="col-start-1 row-start-2 min-[900px]:col-start-3 min-[900px]:row-start-1" />
        <span className="col-start-2 row-span-2 row-start-1 flex flex-col items-end gap-0.5 min-[900px]:row-span-1 min-[900px]:items-center">
          <span className={`inline-flex min-w-[56px] justify-center rounded-sm px-2.5 py-1 text-sm font-bold ${CHIP_TONE[chip.tone]}`}>{chip.text}</span>
          {inProgress && <span className="text-[11px] text-ink-muted">Thru {m.holesPlayed}</span>}
        </span>
        <Chevron open={open} className="col-start-3 row-span-2 row-start-1 min-[900px]:col-start-4 min-[900px]:row-span-1" />
      </button>
      {open && <div className="border-t border-surface-border bg-surface px-4 py-4">{children}</div>}
    </li>
  )
}

/** 2 rows × 9 holes: green W = side A won, gold W = side B won, grey dash = halved, dashed = not played. */
function HoleGrid({ holes, labelA, labelB }) {
  return (
    <div className="min-[900px]:mx-auto min-[900px]:max-w-[420px]">
      <div className="grid grid-cols-9 gap-x-1 gap-y-2">
        {holes.map(h => {
          const played = h.status === 'played'
          const cls = !played ? 'border border-dashed border-surface-outline bg-white'
            : h.result === 'A' ? SIDE.A.fill
            : h.result === 'B' ? SIDE.B.fill
            : 'bg-surface-high text-ink-muted'
          const mark = !played ? '' : h.result === 'A' || h.result === 'B' ? 'W' : '–'
          const who = !played ? 'not played' : h.result === 'A' ? `${labelA} won` : h.result === 'B' ? `${labelB} won` : 'halved'
          return (
            <div key={h.hole} className="flex flex-col items-center gap-1">
              <span className="text-[11px] tabular-nums text-ink-muted">{h.hole}</span>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${cls}`} title={`Hole ${h.hole}: ${who}`} aria-label={`Hole ${h.hole}: ${who}`}>{mark}</span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-ink-muted">Green = {labelA} won · Gold = {labelB} won · Grey = halved</p>
    </div>
  )
}

function useToggleSet() {
  const [open, setOpen] = useState(() => new Set())
  const toggle = id => setOpen(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  return [open, toggle]
}

// ─── Match Points Board ───────────────────────────────────────────
function MatchPointsBoard({ matchData, event }) {
  const { pairings, teamPoints, hasTeams } = matchData
  const [expanded, toggle] = useToggleSet()
  const teamNames = event?.ryder_cup_teams ?? {}
  // Optional labels set by the admin (Match Pairings → Team Names). Never default to
  // "Flight A/B", since a match side is not the same as a scoring flight.
  const labelA = teamNames.a?.trim() || 'Team A'
  const labelB = teamNames.b?.trim() || 'Team B'

  if (!pairings.length) return (
    <div className={CARD}><Empty title="No match play pairings set up yet">An admin can assign pairings in the event settings.</Empty></div>
  )

  // Keyed off every individual pairing being decided (winner set), not event.status —
  // the round can still be "Live" while every match has already closed out.
  const isComplete = pairings.every(p => p.winner != null)
  const started = pairings.some(p => p.holesPlayed > 0)

  return (
    <div className="space-y-4">
      {hasTeams && started && (
        <MatchScoreCard labelA={labelA} labelB={labelB} a={teamPoints.A} b={teamPoints.B} complete={isComplete} />
      )}
      <ul className={`${CARD} divide-y divide-surface-border`}>
        {pairings.map((pair, idx) => (
          <MatchRow
            key={pair.pairingId ?? idx}
            m={pair}
            nameA={fullName(pair.playerA.player)}
            nameB={fullName(pair.playerB.player)}
            tagA={pair.relHandicapA}
            tagB={pair.relHandicapB}
            open={expanded.has(idx)}
            onToggle={() => toggle(idx)}
          >
            <p className="mb-3 text-xs font-semibold text-ink-muted">
              Match {pair.groupNumber ?? idx + 1}{pair.tiebreak || pair.needsWinner ? ` · ${pair.matchStatus}` : ''}
            </p>
            {pair.holesPlayed > 0
              ? <HoleGrid holes={pair.holes} labelA={labelA} labelB={labelB} />
              : <p className="text-sm text-ink-muted">Not started yet.</p>}
          </MatchRow>
        ))}
      </ul>
      <p className="text-center text-xs text-ink-muted">Tap a match for hole by hole · +N = strokes received</p>
    </div>
  )
}

// ─── Team Match Board ─────────────────────────────────────────────
function TeamMatchBoard({ teamMatchData, teamAName = 'Team A', teamBName = 'Team B', event }) {
  const { groupMatches, totalA, totalB } = teamMatchData
  const [expanded, toggle] = useToggleSet()

  if (!groupMatches.length) return (
    <div className={CARD}><Empty title="No team match results yet">Assign players to teams in the Team Play tab on the event admin page.</Empty></div>
  )

  return (
    <div className="space-y-4">
      {totalA + totalB > 0 && (
        <MatchScoreCard
          labelA={teamAName} labelB={teamBName} a={totalA} b={totalB}
          complete={event?.status === 'complete'}
          caption={event?.status === 'complete' ? 'Matches won' : 'Matches in progress'}
        />
      )}
      <ul className={`${CARD} divide-y divide-surface-border`}>
        {groupMatches.map((match, idx) => (
          <MatchRow
            key={idx}
            m={match}
            nameA={match.teamA.map(ep => ep.player?.last_name).filter(Boolean).join(' + ')}
            nameB={match.teamB.map(ep => ep.player?.last_name).filter(Boolean).join(' + ')}
            open={expanded.has(idx)}
            onToggle={() => toggle(idx)}
          >
            <p className="mb-3 text-xs font-semibold text-ink-muted">Group {match.groupNumber} · Best ball</p>
            <div className="mb-3 grid grid-cols-2 gap-3">
              {[['A', teamAName, match.teamA], ['B', teamBName, match.teamB]].map(([side, label, team]) => (
                <div key={side} className="min-w-0">
                  <p className={`text-xs font-bold ${SIDE[side].text}`}>{label}</p>
                  {team.map(ep => (
                    <p key={ep.player_id} className="flex flex-wrap items-center gap-1.5 text-sm text-ink">
                      {fullName(ep.player)}
                      {match.relCH[ep.player_id] > 0 && <span className={`${TAG} ${GREEN_TAG}`}>+{match.relCH[ep.player_id]}</span>}
                    </p>
                  ))}
                </div>
              ))}
            </div>
            {match.holesPlayed > 0 && (
              <>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Best ball by hole</p>
                <div className="flex flex-wrap gap-1.5">
                  {match.holes.filter(h => h.status === 'played').map(h => {
                    const tone = h.result === 'A' ? SIDE.A.tint : h.result === 'B' ? SIDE.B.tint : 'bg-surface-high text-ink-muted'
                    const contributor = h.result === 'A' ? h.contributorA : h.result === 'B' ? h.contributorB : null
                    const initials = contributor
                      ? `${contributor.player?.first_name?.[0] ?? ''}${contributor.player?.last_name?.[0] ?? ''}`
                      : '½'
                    return (
                      <span key={h.hole} className={`rounded-sm px-2 py-1 text-xs font-bold ${tone}`} title={contributor ? fullName(contributor.player) : 'Halved'}>
                        #{h.hole} {initials}
                      </span>
                    )
                  })}
                </div>
              </>
            )}
          </MatchRow>
        ))}
      </ul>
      <p className="text-center text-xs text-ink-muted">Tap a match for hole by hole · +N = strokes received</p>
    </div>
  )
}

// ─── Payouts Board ────────────────────────────────────────────────
function PayoutsBoard({ event, eventPlayers, leaderboards, sideGames, skinsResults, stablefordData, stablefordGrossData, blindPartnersData, superSkinsResult, playerMap, flight, hasFlights, flightOf }) {
  if (!event?.payout_config || eventPlayers.length === 0) {
    return <div className={CARD}><Empty title="No payout configuration set for this event" /></div>
  }

  const payingPlayers = eventPlayers.filter(ep => !ep.is_guest)

  const flightCounts = {
    A: payingPlayers.filter(ep => ep.flight === 'A').length,
    B: payingPlayers.filter(ep => ep.flight === 'B').length,
  }

  const { totalPot, buyInPotTotal, byCategory, byPlayer, totalAllocated } = computePayouts(
    event, payingPlayers.length, leaderboards, sideGames ?? [], skinsResults, flightCounts, {
      stablefordData, blindPartnersData, superSkinsResult, stablefordGrossData, eventPlayers: payingPlayers,
    }
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
    if (key.startsWith('stf_net_')) return 5
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

  // Players paid in the selected flight (everyone when the event has no flights), biggest first
  const rows = byPlayer
    .filter(r => !hasFlights || flightOf(r.playerId) === flight)
    .sort((a, b) => b.total - a.total)
  const totalPaid = rows.reduce((s, r) => s + r.total, 0)
  const rankOf = r => rows.filter(x => x.total > r.total + 0.001).length + 1
  const isTied = r => rows.filter(x => Math.abs(x.total - r.total) < 0.001).length > 1
  const COLS = 'grid grid-cols-[2.25rem_minmax(0,1fr)_auto] gap-x-3'

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <div className={`${COLS} ${HEAD} px-4 py-2.5`}>
          <span>Pos</span><span>Player</span><span className="text-right">Total</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-muted">No payouts{hasFlights ? ` in Flight ${flight}` : ''} yet.</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {rows.map(r => {
              const rank = rankOf(r)
              return (
                <li key={r.playerId} className={`${COLS} items-start px-4 py-3 ${rank === 1 ? LEADER : ''}`}>
                  <span className="pt-0.5 text-sm font-semibold tabular-nums text-ink-muted">{isTied(r) ? `T${rank}` : rank}</span>
                  <span className="min-w-0">
                    <span className="block break-words text-[15px] font-bold text-ink">{playerMap[r.playerId] ? fullName(playerMap[r.playerId]) : '—'}</span>
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {r.items.map((item, i) => (
                        <span key={i} className={`${TAG} ${rank === 1 ? 'bg-white text-status-active-text' : GREEN_TAG}`} title={`${item.category}: ${money(item.amount)}`}>{payoutTag(item.category)}</span>
                      ))}
                    </span>
                  </span>
                  <span className="text-right text-[17px] font-bold tabular-nums text-fairway-700">{money(r.total)}</span>
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-surface-border bg-surface-dim px-4 py-3 text-sm font-semibold text-ink">
          <span>Total paid{hasFlights ? ` · Flight ${flight}` : ''}</span>
          <span className="tabular-nums">{money(totalPaid)}</span>
        </div>
      </div>

      {/* Every prize by game — tucked away, opens in place */}
      <details className={`group ${CARD}`}>
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-[15px] font-bold text-ink">Payouts by game</span>
            <span className="block text-xs text-ink-muted">
              Pot {money(totalPot)} ({eventPlayers.length} × ${event.entry_fee}{buyInPotTotal > 0 ? ` + ${money(buyInPotTotal)} buy-ins` : ''}) · {money(totalAllocated)} allocated
            </span>
          </span>
          <Chevron open={false} className="shrink-0 group-open:rotate-180" />
        </summary>
        <ul className="divide-y divide-surface-border border-t border-surface-border">
          {sortedCategories.map(cat => {
            const winners = (cat.playerIds ?? (cat.playerId ? [cat.playerId] : []))
              .map(pid => playerMap[pid])
              .filter(Boolean)
            return (
              <li key={cat.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm text-ink">{cat.label}</span>
                  <span className="block text-xs text-ink-muted">{winners.length > 0 ? winners.map(fullName).join(' · ') : 'Unresolved'}</span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-ink">{money(cat.amount)}</span>
              </li>
            )
          })}
          {sortedCategories.length === 0 && <li className="px-4 py-4 text-sm text-ink-muted">No payouts resolved yet.</li>}
        </ul>
      </details>
    </div>
  )
}

// ─── TGL Board (Team play) ────────────────────────────────────────
function TGLBoard({ tglData, locked, flightOf, hasFlights }) {
  if (!tglData) {
    return <div className={CARD}><Empty title="No Team Play data yet">Assign team selections in the admin Team Play tab, then scores will appear here.</Empty></div>
  }

  const { teamResults, playerPoints } = tglData
  const leaderPts = Math.max(0, ...teamResults.map(t => t.teamPoints))

  return (
    <div className="space-y-4">
      {!locked && (
        <div className={`rounded-sm border border-surface-border px-4 py-3 text-sm font-medium ${AMBER_TAG}`}>
          Selections not yet submitted. Results may change until the admin locks this event.
        </div>
      )}
      <ul className={`${CARD} divide-y divide-surface-border`}>
        {teamResults.map(tr => (
          <li key={tr.team.id} className="px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-ink-muted">{tr.rank}</span>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tr.team.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 break-words text-[15px] font-bold text-ink">{tr.team.name}</span>
              <span className="shrink-0 text-right">
                <span className="text-[22px] font-bold tabular-nums text-ink">{fmtPts(tr.teamPoints)}</span>
                <span className="ml-1 text-xs text-ink-muted">pts</span>
              </span>
            </div>
            <div className="ml-8 mt-2 h-1.5 overflow-hidden rounded-full bg-surface-high" aria-hidden="true">
              <div className="h-full rounded-full" style={{ width: `${leaderPts > 0 ? Math.max(0, (tr.teamPoints / leaderPts) * 100) : 0}%`, backgroundColor: tr.team.color }} />
            </div>
            {tr.selectedPlayers.length === 0 ? (
              <p className="ml-8 mt-2 text-sm text-ink-muted">No players selected</p>
            ) : (
              <ul className="ml-8 mt-2 space-y-1">
                {tr.selectedPlayers.map(p => {
                  const fl = flightOf(p.player_id)
                  const finish = finishLabel(p.player_id, p.rank, playerPoints, flightOf)
                  return (
                    <li key={p.player_id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 break-words text-ink">
                        {p.name}
                        <span className="text-ink-muted">{hasFlights && fl ? ` · Flight ${fl}` : ''} · {finish === '—' ? 'no finish' : `Finish ${finish}`}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-ink-muted">{fmtPts(p.points)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="text-center text-xs text-ink-muted">Points: field size − finishing position + 1 · ties split equally</p>
    </div>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="h-28 animate-pulse bg-surface-high" />
      <div className="mx-auto max-w-[1080px] space-y-3 px-4 py-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-sm bg-surface-high" />)}
      </div>
    </div>
  )
}

// "Sun, Nov 15"
function shortDay(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ─── Player Scorecard Modal ───────────────────────────────────────
function PlayerScorecardModal({ player, allScores, course, onClose }) {
  const { par_per_hole: pars } = course
  const sis = getStrokeIndexForTee(course, player.tee)
  const ch = player.course_handicap ?? 0
  const playerScores = allScores.filter(s => s.player_id === player.player_id)
  const scoreMap = Object.fromEntries(playerScores.map(s => [s.hole_number, { gross: s.gross_score, putts: s.putts ?? null }]))
  const hasPutts = playerScores.some(s => s.putts != null)

  const holes = Array.from({ length: 18 }, (_, i) => {
    const h = i + 1
    const g = scoreMap[h]?.gross ?? null
    const putts = scoreMap[h]?.putts ?? null
    const si = sis[i]
    const strokes = Math.floor(ch / 18) + (si <= (ch % 18) ? 1 : 0)
    const net = g != null ? g - strokes : null
    const netVsPar = net != null ? net - pars[i] : null
    return { h, g, putts, net, netVsPar, par: pars[i], strokes }
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
  const frontPutts = frontHoles.reduce((s, h) => h.putts != null ? s + h.putts : s, 0)
  const backPutts  = backHoles.reduce((s, h) => h.putts != null ? s + h.putts : s, 0)
  const totalVsPar = holes.reduce((s, h) => h.netVsPar != null ? s + h.netVsPar : s, 0)
  const holesPlayed = playerScores.length
  const name = `${player.player?.first_name ?? ''} ${player.player?.last_name ?? ''}`.trim()
  const vsParDisplay = holesPlayed === 0 ? '—' : totalVsPar === 0 ? 'E' : `${totalVsPar > 0 ? '+' : ''}${totalVsPar}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full sm:max-w-md rounded-t-sm sm:rounded-sm shadow-2xl flex flex-col"
        style={{ maxHeight: '92dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between rounded-t-sm flex-shrink-0" style={{ background: '#1d1d1f', color: '#ffffff' }}>
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
        <div className="flex divide-x divide-surface-border flex-shrink-0">
          {[{ label: 'Front 9', holeList: frontHoles, grossTotal: frontGross, netTotal: frontNet },
            { label: 'Back 9',  holeList: backHoles,  grossTotal: backGross,  netTotal: backNet }
          ].map(({ label, holeList, grossTotal, netTotal }) => (
            <div key={label} className="flex-1">
              {/* Section label */}
              <div className="bg-surface-container px-3 py-1.5 border-b border-surface-border">
                <span className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">{label}</span>
              </div>
              {/* Column headers */}
              <div className={`grid ${hasPutts ? 'grid-cols-[1.5rem_1.5rem_2rem_2rem_2rem]' : 'grid-cols-[1.5rem_1.5rem_2rem_2rem]'} gap-0 px-3 py-1.5 border-b border-surface-border`}>
                <span className="text-[10px] font-bold text-ink-muted uppercase">Hole</span>
                <span className="text-[10px] font-bold text-ink-muted uppercase text-center">Par</span>
                <span className="text-[10px] font-bold text-ink-muted uppercase text-center">Grs</span>
                <span className="text-[10px] font-bold text-ink-muted uppercase text-center">Net</span>
                {hasPutts && <span className="text-[10px] font-bold text-ink-muted uppercase text-center">Pts</span>}
              </div>
              {/* Hole rows */}
              {holeList.map(({ h, g, putts, net, netVsPar, par, strokes }, i) => (
                <div key={h} className={`grid ${hasPutts ? 'grid-cols-[1.5rem_1.5rem_2rem_2rem_2rem]' : 'grid-cols-[1.5rem_1.5rem_2rem_2rem]'} gap-0 px-3 py-1.5 ${i % 2 === 1 ? 'bg-[rgba(27,67,50,0.025)]' : ''}`}>
                  <span className="text-xs font-semibold text-ink-muted tabular-nums">{h}</span>
                  <span className="text-xs text-ink-muted text-center tabular-nums">{par}</span>
                  <span className="text-xs font-semibold text-ink text-center tabular-nums">
                    {g ?? <span className="text-surface-highest">—</span>}
                  </span>
                  <span className={`text-xs text-center tabular-nums ${netColor(netVsPar)}`}>
                    {net != null ? net : <span className="text-surface-highest">—</span>}
                  </span>
                  {hasPutts && (
                    <span className="text-xs text-center tabular-nums text-ink">
                      {putts != null ? putts : <span className="text-surface-highest">—</span>}
                    </span>
                  )}
                </div>
              ))}
              {/* Subtotal */}
              <div className={`grid ${hasPutts ? 'grid-cols-[1.5rem_1.5rem_2rem_2rem_2rem]' : 'grid-cols-[1.5rem_1.5rem_2rem_2rem]'} gap-0 px-3 py-2 bg-[#012d1d]/5 border-t border-surface-border mt-0.5`}>
                <span className="text-[10px] font-bold text-ink-muted uppercase col-span-2">Tot</span>
                <span className="text-xs font-black text-ink text-center tabular-nums">{grossTotal || '—'}</span>
                <span className="text-xs font-black text-ink text-center tabular-nums">{netTotal || '—'}</span>
                {hasPutts && <span className="text-xs font-black text-ink text-center tabular-nums">{(label === 'Front 9' ? frontPutts : backPutts) || '—'}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Overall totals footer */}
        <div className="flex items-center justify-between px-5 py-3 rounded-b-sm flex-shrink-0" style={{ borderTop: '1px solid #ebe9e4', background: '#f4f3f0' }}>
          <div className={`grid ${hasPutts ? 'grid-cols-3' : 'grid-cols-2'} gap-6 text-center`}>
            <div>
              <div className="text-[10px] text-ink-muted uppercase tracking-wide font-bold">Gross</div>
              <div className="text-lg font-black text-ink tabular-nums">{frontGross + backGross || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-ink-muted uppercase tracking-wide font-bold">Net</div>
              <div className="text-lg font-black text-ink tabular-nums">{frontNet + backNet || '—'}</div>
            </div>
            {hasPutts && (
              <div>
                <div className="text-[10px] text-ink-muted uppercase tracking-wide font-bold">Putts</div>
                <div className="text-lg font-black text-ink tabular-nums">{frontPutts + backPutts || '—'}</div>
              </div>
            )}
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

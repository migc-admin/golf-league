/**
 * Public Event Page — multi-tab microsite layout
 * Tabs: Overview · Pairings · Leaderboard
 */

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const FORMAT_ORDER = ['net_stroke_front9', 'net_stroke_back9', 'net_stroke']
const FORMAT_LABELS = {
  net_stroke_front9: 'Net Stroke Play (Front 9)',
  net_stroke_back9:  'Net Stroke Play (Back 9)',
  net_stroke:        'Net Stroke Play',
  stableford:        'Stableford',
  match_points:      'Match Play Points',
  ryder_cup:         'Ryder Cup',
}
const FORMAT_SHORT = {
  net_stroke_front9: 'Net Stroke · Front 9',
  net_stroke_back9:  'Net Stroke · Back 9',
  net_stroke:        'Net Stroke',
  stableford:        'Stableford',
  match_points:      'Match Points',
  ryder_cup:         'Ryder Cup',
}
const SIDE_GAME_LABELS = {
  skins:        'Skins',
  skins_a:      'Skins — Flight A',
  skins_b:      'Skins — Flight B',
  long_drive:   'Long Drive',
  long_drive_a: 'Long Drive — Flight A',
  long_drive_b: 'Long Drive — Flight B',
  low_putts:    'Low Putts',
  ctp:          'Closest to Pin',
  track_putts:  'Putts Tracked',
}

const TABS = [
  { key: 'overview',    label: 'Overview'     },
  { key: 'pairings',   label: 'Pairings'     },
  { key: 'leaderboard',label: 'Leaderboard'  },
]

export default function EventPage() {
  const { orgSlug, leagueSlug, eventSlug } = useParams()
  const [searchParams] = useSearchParams()
  const directEventId = searchParams.get('eid')

  const [event,        setEvent]        = useState(null)
  const [playerCount,  setPlayerCount]  = useState(null)
  const [eventPlayers, setEventPlayers] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState('overview')

  useEffect(() => {
    async function load() {
      try {
        let ev = null
        if (directEventId) {
          const { data } = await supabase
            .from('events')
            .select('*, course:courses(name), league:leagues(name, season_year, slug, logo_url)')
            .eq('id', directEventId).single()
          ev = data
        } else {
          const { data: league } = await supabase.from('leagues').select('id').eq('slug', leagueSlug).single()
          if (!league) { setLoading(false); return }
          const { data } = await supabase
            .from('events')
            .select('*, course:courses(name), league:leagues(name, season_year, slug, logo_url)')
            .eq('league_id', league.id).eq('slug', eventSlug).single()
          ev = data
        }
        if (!ev) { setLoading(false); return }
        setEvent(ev)

        const { data: eps, count } = await supabase
          .from('event_players')
          .select('*, player:players(first_name, last_name)', { count: 'exact' })
          .eq('event_id', ev.id)
          .order('group_number').order('flight').order('adjusted_handicap_index')
        setEventPlayers(eps ?? [])
        setPlayerCount(count ?? 0)
        setLoading(false)
      } catch (err) {
        console.error('EventPage load error:', err)
        setLoading(false)
      }
    }
    load()
  }, [directEventId, leagueSlug, eventSlug])

  if (loading) return <Skeleton />
  if (!event) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0' }}>
      <p style={{ color: '#86868b' }}>Event not found.</p>
    </div>
  )

  const eid            = event.id
  const leaderboardUrl = `/${orgSlug}/${event.league?.slug ?? leagueSlug}/${event.slug}/leaderboard?eid=${eid}`
  const formats        = event.formats ?? (event.format ? [event.format] : [])
  const sideGames      = event.side_game_options ?? []
  const eventName      = event.name ?? `Event #${event.event_number}`

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f4f0' }}>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(150deg, #1a3d2e 0%, #1B4332 55%, #2d6a4f 100%)' }}>
        <div style={{ maxWidth: 768, margin: '0 auto', padding: '36px 20px 0' }}>

          {/* League identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            {event.league?.logo_url ? (
              <img src={event.league.logo_url} alt=""
                style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.25)', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#fff', flexShrink: 0 }}>
                {(event.league?.name ?? '').slice(0, 2).toUpperCase()}
              </div>
            )}
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600 }}>
              {event.league?.name}{event.league?.season_year ? ` · ${event.league.season_year}` : ''}
            </span>
          </div>

          {/* Event name */}
          <h1 style={{ color: '#fff', fontSize: 'clamp(22px, 5vw, 34px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 14 }}>
            {eventName}
          </h1>

          {/* Meta pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <HeroPill>📅 {shortDate(event.event_date)}</HeroPill>
            <HeroPill>⛳ {event.course?.name ?? 'TBD'}</HeroPill>
            <StatusBadge status={event.status} />
          </div>

          {/* Tab bar — attached to bottom of hero */}
          <div style={{ display: 'flex', gap: 2, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '11px 22px',
                  fontSize: 14,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '10px 10px 0 0',
                  transition: 'all 0.15s',
                  background: activeTab === tab.key ? '#f5f4f0' : 'transparent',
                  color:      activeTab === tab.key ? '#1B4332'  : 'rgba(255,255,255,0.6)',
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────── */}
      <div style={{ maxWidth: 768, margin: '0 auto', width: '100%', padding: '24px 20px', flex: 1 }}>

        {activeTab === 'overview' && (
          <OverviewTab
            event={event}
            formats={formats}
            sideGames={sideGames}
            playerCount={playerCount}
            leaderboardUrl={leaderboardUrl}
          />
        )}

        {activeTab === 'pairings' && (
          <GroupList eventPlayers={eventPlayers} event={event} />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardTab event={event} leaderboardUrl={leaderboardUrl} />
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: 12, color: '#c7c7cc', padding: '24px 0' }}>
        Powered by Scorify Golf
      </div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ event, formats, sideGames, playerCount, leaderboardUrl }) {
  const primaryFormat = [...formats].sort((a, b) => {
    const ai = FORMAT_ORDER.indexOf(a), bi = FORMAT_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })[0]

  const startLabel = event.shotgun_start
    ? 'Shotgun'
    : (event.start_time ? formatTime(event.start_time) : '—')

  const stats = [
    { label: 'Players', value: playerCount ?? '—' },
    { label: 'Format',  value: 'Stroke Play' },
    { label: 'Start',   value: startLabel },
  ]

  const visibleSideGames = sideGames.filter(s => s !== 'track_putts')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Additional formats (if more than one) */}
      {formats.length > 1 && (
        <Section label="Scoring Formats">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...formats].sort((a, b) => {
              const ai = FORMAT_ORDER.indexOf(a), bi = FORMAT_ORDER.indexOf(b)
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
            }).map(f => (
              <div key={f} style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f' }}>{FORMAT_LABELS[f] ?? f}</div>
            ))}
          </div>
        </Section>
      )}

      {/* Flights */}
      {event.use_flights && (
        <Section label="Flights">
          <div style={{ display: 'flex', gap: 8 }}>
            <FlightBadge flight="A" />
            <FlightBadge flight="B" />
          </div>
        </Section>
      )}

      {/* Side games */}
      {visibleSideGames.length > 0 && (
        <Section label="Side Games">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {visibleSideGames.map(s => (
              <span key={s} style={{ background: '#f0fdf4', color: '#166534', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 999, border: '1px solid #bbf7d0' }}>
                {SIDE_GAME_LABELS[s] ?? s}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Leaderboard CTA */}
      {event.status !== 'upcoming' && (
        <Link to={leaderboardUrl} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1B4332', color: '#fff', borderRadius: 14, padding: '18px 22px', textDecoration: 'none' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>View results</div>
            <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em' }}>Full Leaderboard →</div>
          </div>
          {event.status === 'active' && (
            <span style={{ background: '#4ade80', color: '#14532d', fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Live
            </span>
          )}
        </Link>
      )}
    </div>
  )
}

// ─── Leaderboard Tab ──────────────────────────────────────────────────────────
function LeaderboardTab({ event, leaderboardUrl }) {
  if (event.status === 'upcoming') {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1d1d1f', marginBottom: 6 }}>Leaderboard not yet available</div>
        <div style={{ fontSize: 14, color: '#86868b' }}>Check back once the event is underway.</div>
      </div>
    )
  }
  return (
    <Link to={leaderboardUrl}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1B4332', color: '#fff', borderRadius: 14, padding: '22px 24px', textDecoration: 'none' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Official results</div>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em' }}>Open Leaderboard ↗</div>
      </div>
      {event.status === 'active' && (
        <span style={{ background: '#4ade80', color: '#14532d', fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Live
        </span>
      )}
    </Link>
  )
}

// ─── Group List (Pairings tab) ────────────────────────────────────────────────
function GroupList({ eventPlayers, event }) {
  const [search, setSearch] = useState('')

  const groups = {}
  for (const ep of eventPlayers) {
    const g = ep.group_number ?? 0
    if (!groups[g]) groups[g] = []
    groups[g].push(ep)
  }
  const sorted    = Object.entries(groups).filter(([k]) => k !== '0').sort(([a], [b]) => parseInt(a) - parseInt(b))
  const ungrouped = groups[0] ?? []

  const q = search.toLowerCase().trim()
  const filteredSorted = q
    ? sorted.filter(([, members]) => members.some(ep => `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.toLowerCase().includes(q)))
    : sorted

  if (sorted.length === 0 && ungrouped.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>⛳</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1d1d1f', marginBottom: 6 }}>Pairings not posted yet</div>
        <div style={{ fontSize: 14, color: '#86868b' }}>Check back closer to the event.</div>
      </div>
    )
  }

  const assignedCount = eventPlayers.filter(ep => ep.group_number).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
        <input
          type="text"
          placeholder="Search players…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '11px 16px 11px 42px', fontSize: 14, borderRadius: 12, border: '1px solid #d1d5db', background: '#fff', boxSizing: 'border-box', outline: 'none' }}
        />
      </div>

      {/* Summary */}
      <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>
        {q
          ? `${filteredSorted.length} group${filteredSorted.length !== 1 ? 's' : ''} matching "${search}"`
          : `${sorted.length} groups · ${assignedCount} players`}
      </div>

      {/* Group cards */}
      {filteredSorted.map(([groupNum, members]) => {
        const teeTime   = computeTeeTime(event.start_time, event.shotgun_start ? 0 : (event.tee_time_interval_mins ?? 10), parseInt(groupNum))
        const code      = event.group_codes?.[groupNum] ?? null
        const startHole = event.shotgun_start ? (event.group_hole_assignments?.[groupNum] ?? null) : null
        return (
          <div key={groupNum} style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            {/* Header */}
            <div style={{ background: '#1B4332', color: '#fff', padding: '13px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                  {groupNum}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Group {groupNum}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{members.length} players</div>
                </div>
                {code && (
                  <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '4px 10px', marginLeft: 4 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 1 }}>Code</div>
                    <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.1em' }}>{code}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {startHole && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>Hole {startHole}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Start hole</div>
                  </div>
                )}
                {teeTime && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{teeTime}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Tee time</div>
                  </div>
                )}
              </div>
            </div>
            {/* Players */}
            {members.map((ep, idx) => (
              <div key={ep.player_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderTop: idx > 0 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  {ep.flight && <FlightBadge flight={ep.flight} small />}
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f' }}>
                    {ep.player?.first_name} {ep.player?.last_name}
                  </span>
                  {ep.is_scorekeeper && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#f0fdf4', color: '#1B4332' }}>SK</span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
                  CH {ep.course_handicap ?? ep.handicap_index ?? '—'}
                </span>
              </div>
            ))}
          </div>
        )
      })}

      {/* Ungrouped */}
      {ungrouped.length > 0 && !q && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Unassigned</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ungrouped.map(ep => (
              <div key={ep.player_id} style={{ fontSize: 14, color: '#1d1d1f', fontWeight: 500 }}>
                {ep.player?.first_name} {ep.player?.last_name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared small components ──────────────────────────────────────────────────

function Section({ label, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  )
}

function HeroPill({ children }) {
  return (
    <span style={{ background: 'rgba(255,255,255,0.13)', color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: 600, padding: '5px 13px', borderRadius: 999 }}>
      {children}
    </span>
  )
}

function StatusBadge({ status }) {
  const map = {
    upcoming: { bg: 'rgba(254,249,195,0.92)', color: '#854d0e',              label: 'Upcoming'    },
    active:   { bg: 'rgba(74,222,128,0.92)',  color: '#14532d',              label: 'In Progress' },
    complete: { bg: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.8)', label: 'Complete'   },
  }
  const { bg, color, label } = map[status] ?? { bg: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.8)', label: status }
  return (
    <span style={{ background: bg, color, fontSize: 12, fontWeight: 800, padding: '5px 12px', borderRadius: 999 }}>
      {label}
    </span>
  )
}

function FlightBadge({ flight, small }) {
  const isA = flight === 'A'
  return (
    <span style={{
      width:        small ? 22 : 'auto',
      height:       small ? 22 : 'auto',
      minWidth:     small ? 22 : 'auto',
      borderRadius: small ? '50%' : 999,
      padding:      small ? 0 : '4px 12px',
      display:      'inline-flex',
      alignItems:   'center',
      justifyContent: 'center',
      fontSize:     small ? 11 : 13,
      fontWeight:   800,
      background:   isA ? '#dbeafe' : '#ede9fe',
      color:        isA ? '#1d4ed8' : '#6d28d9',
    }}>
      {small ? flight : `Flight ${flight}`}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeTeeTime(startTime, intervalMins, groupNum) {
  if (!startTime) return null
  const [h, m] = startTime.split(':').map(Number)
  const total  = h * 60 + m + (groupNum - 1) * intervalMins
  const hh     = Math.floor(total / 60) % 24
  const mm     = total % 60
  const ampm   = hh >= 12 ? 'PM' : 'AM'
  const h12    = hh % 12 || 12
  return `${h12}:${mm.toString().padStart(2, '0')} ${ampm}`
}

function formatTime(t) {
  return computeTeeTime(t, 0, 1) ?? t
}

function shortDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function Skeleton() {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0' }}>
      <div style={{ height: 240, background: '#1B4332', opacity: 0.8 }} />
      <div style={{ maxWidth: 768, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ height: 80, borderRadius: 14, background: '#e5e7eb', animation: 'pulse 1.5s infinite' }} />)}
        </div>
        {[0,1].map(i => <div key={i} style={{ height: 60, borderRadius: 14, background: '#e5e7eb', animation: 'pulse 1.5s infinite' }} />)}
      </div>
    </div>
  )
}

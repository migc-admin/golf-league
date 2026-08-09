/**
 * Public Event Page — redesigned with split hero, cover photo, registration CTA,
 * tournament description, sponsor scroll bar, mobile optimized.
 */

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'

const FORMAT_LABELS = {
  net_stroke_front9: 'Net Stroke · Front 9',
  net_stroke_back9:  'Net Stroke · Back 9',
  net_stroke:        'Net Stroke Play',
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
}

const TABS = [
  { key: 'overview',    label: 'Overview'    },
  { key: 'pairings',   label: 'Pairings'    },
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
            .select('*, course:courses(name, address), league:leagues(name, season_year, slug, logo_url)')
            .eq('id', directEventId).single()
          ev = data
        } else {
          const { data: league } = await supabase.from('leagues').select('id').eq('slug', leagueSlug).single()
          if (!league) { setLoading(false); return }
          const { data } = await supabase
            .from('events')
            .select('*, course:courses(name, address), league:leagues(name, season_year, slug, logo_url)')
            .eq('league_id', league.id).eq('slug', eventSlug).single()
          ev = data
        }
        if (!ev) { setLoading(false); return }
        setEvent(ev)

        const { data: eps, count } = await supabase
          .from('event_players')
          .select('*, player:players(first_name, last_name)', { count: 'exact' })
          .eq('event_id', ev.id)
          .order('group_number').order('group_order', { nullsFirst: false }).order('flight')
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f8f5' }}>
      <p style={{ color: '#86868b' }}>Event not found.</p>
    </div>
  )

  const eid            = event.id
  const leaderboardUrl = `/${orgSlug}/${event.league?.slug ?? leagueSlug}/${event.slug}/leaderboard?eid=${eid}`
  const regUrl         = event.league?.slug && event.slug ? `/register/${event.league.slug}/${event.slug}` : null
  const formats        = event.formats ?? (event.format ? [event.format] : [])
  const sideGames      = event.side_game_options ?? []
  const eventName      = event.name ?? `Event #${event.event_number}`
  const coverImage     = event.cover_image_url ?? null
  const sponsors       = event.sponsors ?? []
  const description    = event.description ?? null
  const courseAddress  = event.course?.address ?? null
  const mapsUrl        = courseAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(courseAddress)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.course?.name ?? '')}`

  const startLabel = event.start_time
    ? `${formatTime(event.start_time)}${event.shotgun_start ? ' · Shotgun' : ''}`
    : (event.shotgun_start ? 'Shotgun Start' : null)

  const spotsLeft = event.registration_spots != null
    ? Math.max(0, event.registration_spots - (playerCount ?? 0))
    : null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f9f8f5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', width: '100%',
          display: 'grid',
          gridTemplateColumns: coverImage ? 'minmax(0,1fr) min(420px,45%)' : '1fr',
        }}>

          {/* Left panel */}
          <div style={{ padding: 'clamp(24px,4vw,44px) clamp(20px,4vw,44px) 0', display: 'flex', flexDirection: 'column', minHeight: coverImage ? 360 : 'auto' }}>

            {/* League identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              {event.league?.logo_url ? (
                <img src={event.league.logo_url} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: 8, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12, color: '#fff', flexShrink: 0 }}>
                  {(event.league?.name ?? '').slice(0, 2).toUpperCase()}
                </div>
              )}
              <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Hosted by {event.league?.name}
              </span>
            </div>

            {/* Title */}
            <h1 style={{ fontSize: 'clamp(22px, 4vw, 40px)', fontWeight: 900, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 8 }}>
              {eventName}
            </h1>
            <div style={{ width: 44, height: 4, background: GOLD, borderRadius: 2, marginBottom: 20 }} />

            {/* Date + Course */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <MetaRow icon={
                <svg width="15" height="15" fill="none" stroke="#374151" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              }>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{longDate(event.event_date)}</div>
                {startLabel && <div style={{ fontSize: 12, color: '#6b7280' }}>{startLabel}</div>}
              </MetaRow>

              <MetaRow icon={
                <svg width="15" height="15" fill="none" stroke="#374151" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              }>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{event.course?.name ?? 'TBD'}</div>
                  {courseAddress && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{courseAddress}</div>}
                </div>
              </MetaRow>
            </div>

            {/* Registration CTA — only if upcoming and reg is available */}
            {event.status === 'upcoming' && regUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px 18px' }}>
                <div style={{ flex: 1 }}>
                  {event.tournament_fee > 0 && (
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#111827', letterSpacing: '-0.02em' }}>
                      ${Number(event.tournament_fee).toFixed(0)}<span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>/player</span>
                    </div>
                  )}
                  {spotsLeft !== null && (
                    <div style={{ fontSize: 12, color: spotsLeft <= 5 ? '#dc2626' : '#6b7280', fontWeight: 600, marginTop: 2 }}>
                      {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} remaining` : 'Event full'}
                    </div>
                  )}
                </div>
                {(!spotsLeft || spotsLeft > 0) && (
                  <Link to={regUrl}
                    style={{ background: GREEN, color: '#fff', fontWeight: 800, fontSize: 14, padding: '12px 22px', borderRadius: 10, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Register →
                  </Link>
                )}
              </div>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Tab bar */}
            <div style={{ display: 'flex', borderTop: '1px solid #e5e7eb', marginLeft: 'clamp(-20px,-4vw,-44px)', marginRight: coverImage ? 0 : 'clamp(-20px,-4vw,-44px)', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '13px 24px',
                    fontSize: 13, fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    background: 'transparent',
                    color: activeTab === tab.key ? GREEN : '#9ca3af',
                    borderBottom: activeTab === tab.key ? `3px solid ${GREEN}` : '3px solid transparent',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                  {tab.label}
                </button>
              ))}
              <Link to={leaderboardUrl}
                style={{
                  padding: '13px 24px',
                  fontSize: 13, fontWeight: 700,
                  color: '#9ca3af',
                  borderBottom: '3px solid transparent',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  textDecoration: 'none',
                  display: 'flex', alignItems: 'center',
                }}>
                Leaderboard ↗
              </Link>
            </div>
          </div>

          {/* Right: Cover photo — hidden on mobile */}
          {coverImage && (
            <div style={{ position: 'relative', overflow: 'hidden', display: 'none' }} className="event-cover-photo">
              <img src={coverImage} alt={eventName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 360 }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', padding: 'clamp(20px,4vw,32px) clamp(16px,4vw,40px)', flex: 1, boxSizing: 'border-box' }}>

        {activeTab === 'overview' && (
          <OverviewTab event={event} leaderboardUrl={leaderboardUrl} description={description} />
        )}

        {activeTab === 'pairings' && (
          <GroupList eventPlayers={eventPlayers} event={event} orgSlug={orgSlug} />
        )}


      </div>

      {/* ── Sponsor Scroll Bar ────────────────────────────────────────────────── */}
      {sponsors.length > 0 && (
        <SponsorBar sponsors={sponsors} />
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: 12, color: '#c7c7cc', padding: '20px 0', borderTop: '1px solid #f3f4f6' }}>
        Powered by <strong style={{ color: '#9ca3af' }}>Scorify Golf</strong>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (min-width: 768px) {
          .event-cover-photo { display: block !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Sponsor tiles ────────────────────────────────────────────────────────────
function SponsorBar({ sponsors }) {
  return (
    <div style={{ background: '#fff', borderTop: '1px solid #e5e7eb', padding: '24px clamp(16px,4vw,40px)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
          Sponsored by
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {sponsors.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f8f5', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 20px', minWidth: 120 }}>
              {s.logo_url ? (
                <img src={s.logo_url} alt={s.name ?? 'Sponsor'} style={{ height: 36, maxWidth: 120, objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{s.name}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ event, leaderboardUrl, description }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {description && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>About this Event</div>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-line', margin: 0 }}>{description}</p>
        </div>
      )}

      {event.status !== 'upcoming' && (
        <Link to={leaderboardUrl} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: GREEN, color: '#fff', borderRadius: 16, padding: '20px 24px', textDecoration: 'none', gridColumn: '1 / -1' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>View results</div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em' }}>Full Leaderboard →</div>
          </div>
          {event.status === 'active' && (
            <span style={{ background: '#4ade80', color: '#14532d', fontSize: 11, fontWeight: 800, padding: '6px 14px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Live
            </span>
          )}
        </Link>
      )}
    </div>
  )
}

// ─── Group List (Pairings) ────────────────────────────────────────────────────
function GroupList({ eventPlayers, event }) {
  const [search, setSearch] = useState('')

  const groups = {}
  for (const ep of eventPlayers) {
    const g = ep.group_number ?? 0
    if (!groups[g]) groups[g] = []
    groups[g].push(ep)
  }
  for (const members of Object.values(groups)) {
    members.sort((a, b) => {
      const ao = a.group_order, bo = b.group_order
      if (ao != null && bo != null) return ao - bo
      if (ao != null) return -1
      if (bo != null) return 1
      const fa = (a.player?.first_name ?? '').toLowerCase()
      const fb = (b.player?.first_name ?? '').toLowerCase()
      if (fa !== fb) return fa < fb ? -1 : 1
      return (a.player?.last_name ?? '').toLowerCase() < (b.player?.last_name ?? '').toLowerCase() ? -1 : 1
    })
  }

  const sorted    = Object.entries(groups).filter(([k]) => k !== '0').sort(([a], [b]) => parseInt(a) - parseInt(b))
  const ungrouped = groups[0] ?? []
  const q         = search.toLowerCase().trim()
  const filtered  = q ? sorted.filter(([, ms]) => ms.some(ep => `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.toLowerCase().includes(q))) : sorted

  if (sorted.length === 0 && ungrouped.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>⛳</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Pairings not posted yet</div>
        <div style={{ fontSize: 14, color: '#86868b' }}>Check back closer to the event.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative', maxWidth: 400 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>🔍</span>
        <input type="text" placeholder="Search players…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '11px 16px 11px 40px', fontSize: 14, borderRadius: 12, border: '1px solid #d1d5db', background: '#fff', boxSizing: 'border-box', outline: 'none' }} />
      </div>
      <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>
        {q ? `${filtered.length} group${filtered.length !== 1 ? 's' : ''} matching "${search}"` : `${sorted.length} groups · ${eventPlayers.filter(ep => ep.group_number).length} players`}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {filtered.map(([groupNum, members]) => {
          const teeTime   = computeTeeTime(event.start_time, event.shotgun_start ? 0 : (event.tee_time_interval_mins ?? 10), parseInt(groupNum))
          const code      = event.group_codes?.[groupNum] ?? null
          const startHole = event.shotgun_start ? (event.group_hole_assignments?.[groupNum] ?? null) : null
          return (
            <div key={groupNum} style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              <div style={{ background: GREEN, color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                    {groupNum}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Group {groupNum}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{members.length} players</div>
                  </div>
                  {code && (
                    <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '3px 9px' }}>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>Code</div>
                      <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: '0.1em' }}>{code}</div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {startHole && <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 800, fontSize: 15 }}>Hole {startHole}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Start</div></div>}
                  {teeTime    && <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 800, fontSize: 15 }}>{teeTime}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Tee time</div></div>}
                </div>
              </div>
              {members.map((ep, idx) => (
                <div key={ep.player_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: idx > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {ep.flight && <FlightBadge flight={ep.flight} />}
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{ep.player?.first_name} {ep.player?.last_name}</span>
                    {ep.is_scorekeeper && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: '#f0fdf4', color: GREEN }}>SK</span>}
                  </div>
                  <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>CH {ep.course_handicap ?? ep.handicap_index ?? '—'}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      {ungrouped.length > 0 && !q && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Unassigned</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ungrouped.map(ep => <div key={ep.player_id} style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{ep.player?.first_name} {ep.player?.last_name}</div>)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────

function MetaRow({ icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        {icon}
      </div>
      <div>{children}</div>
    </div>
  )
}

function InfoCard({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  )
}

function InfoRow({ icon, label, value }) {
  if (value === null || value === undefined || value === '—') return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ fontSize: 15, flexShrink: 0, width: 20, textAlign: 'center', marginTop: 2 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{value}</div>
      </div>
    </div>
  )
}

function FlightBadge({ flight }) {
  const isA = flight === 'A'
  return (
    <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: isA ? '#dbeafe' : '#ede9fe', color: isA ? '#1d4ed8' : '#6d28d9', flexShrink: 0 }}>
      {flight}
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

function formatTime(t) { return computeTeeTime(t, 0, 1) ?? t }

function longDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function Skeleton() {
  return (
    <div style={{ minHeight: '100vh', background: '#f9f8f5' }}>
      <div style={{ height: 340, background: '#e5e7eb' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 40px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[0,1,2].map(i => <div key={i} style={{ height: 120, borderRadius: 16, background: '#e5e7eb' }} />)}
      </div>
    </div>
  )
}

/**
 * Public Event Page
 * Shareable landing page for a specific event — no login required.
 * Shows event details, links to Pairings and Leaderboard.
 */

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const FORMAT_LABELS = {
  net_stroke:        'Net Stroke Play (18-hole)',
  net_stroke_front9: 'Net Stroke Play (Front 9)',
  net_stroke_back9:  'Net Stroke Play (Back 9)',
  stableford:        'Stableford',
  match_points:      'Match Play Points',
  ryder_cup:         'Ryder Cup',
}

const SIDE_GAME_LABELS = {
  skins:         'Skins',
  skins_a:       'Skins — Flight A',
  skins_b:       'Skins — Flight B',
  long_drive:    'Long Drive',
  long_drive_a:  'Long Drive — Flight A',
  long_drive_b:  'Long Drive — Flight B',
  low_putts:     'Low Putts',
  ctp:           'Closest to Pin',
  track_putts:   'Putts Tracked',
}

export default function EventPage() {
  const { orgSlug, leagueSlug, eventSlug } = useParams()
  const [searchParams] = useSearchParams()
  const directEventId = searchParams.get('eid')

  const [event,        setEvent]        = useState(null)
  const [playerCount,  setPlayerCount]  = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState('about')

  useEffect(() => {
    async function load() {
      let ev = null

      if (directEventId) {
        const { data } = await supabase
          .from('events')
          .select('*, course:courses(name, city, state), league:leagues(name, season_year, slug, logo_url)')
          .eq('id', directEventId)
          .single()
        ev = data
      } else {
        const { data: league } = await supabase
          .from('leagues').select('id').eq('slug', leagueSlug).single()
        if (!league) { setLoading(false); return }
        const { data } = await supabase
          .from('events')
          .select('*, course:courses(name, city, state), league:leagues(name, season_year, slug, logo_url)')
          .eq('league_id', league.id)
          .eq('slug', eventSlug)
          .single()
        ev = data
      }

      if (!ev) { setLoading(false); return }
      setEvent(ev)

      const { count } = await supabase
        .from('event_players')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', ev.id)
        .eq('is_guest', false)
      setPlayerCount(count ?? 0)
      setLoading(false)
    }
    load()
  }, [directEventId, leagueSlug, eventSlug])

  if (loading) return <Skeleton />

  if (!event) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#fbfaf8' }}>
      <p style={{ color: '#86868b' }}>Event not found.</p>
    </div>
  )

  const eid = event.id
  const leaderboardUrl = `/${orgSlug}/${event.league?.slug ?? leagueSlug}/${event.slug}/leaderboard?eid=${eid}`
  const scheduleUrl    = `/${orgSlug}/${event.league?.slug ?? leagueSlug}/${event.slug}/schedule?eid=${eid}`
  const formats  = event.formats ?? (event.format ? [event.format] : [])
  const sideGames = event.side_game_options ?? []

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8' }}>

      {/* Hero header */}
      <div style={{ background: '#1B4332' }}>
        <div className="max-w-2xl mx-auto px-4 py-8 flex items-center gap-4">
          {event.league?.logo_url ? (
            <img
              src={event.league.logo_url}
              alt=""
              className="w-16 h-16 rounded-xl object-cover shrink-0"
              style={{ border: '2px solid rgba(255,255,255,0.2)' }}
            />
          ) : (
            <div
              className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center text-white font-black text-xl"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              {(event.league?.name ?? '?').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {event.league?.name} · {event.league?.season_year}
            </div>
            <h1 className="text-2xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>
              {event.name ?? `Event #${event.event_number}`}
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-0">
          {[
            { key: 'about',       label: 'About' },
            { key: 'pairings',    label: 'Pairings' },
            { key: 'leaderboard', label: 'Leaderboard' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors"
              style={{
                background: activeTab === tab.key ? '#fbfaf8' : 'transparent',
                color: activeTab === tab.key ? '#1B4332' : 'rgba(255,255,255,0.7)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex-1">

        {activeTab === 'about' && (
          <div className="space-y-5">
            {/* Status badge */}
            <StatusPill status={event.status} />

            {/* Detail cards */}
            <div className="card p-0 overflow-hidden divide-y" style={{ borderColor: '#ebe9e4' }}>
              <DetailRow icon="📅" label="Date">
                <span className="font-semibold text-ink">{formatDate(event.event_date)}</span>
                {event.start_time && (
                  <span className="text-ink-muted ml-2">· {formatTime(event.start_time)}</span>
                )}
              </DetailRow>

              <DetailRow icon="⛳" label="Course">
                <span className="font-semibold text-ink">{event.course?.name ?? '—'}</span>
                {(event.course?.city || event.course?.state) && (
                  <span className="text-ink-muted ml-2">· {[event.course.city, event.course.state].filter(Boolean).join(', ')}</span>
                )}
              </DetailRow>

              {formats.length > 0 && (
                <DetailRow icon="🏌️" label="Format">
                  <div className="space-y-0.5">
                    {formats.map(f => (
                      <div key={f} className="font-semibold text-ink">{FORMAT_LABELS[f] ?? f}</div>
                    ))}
                    {event.use_flights && (
                      <div className="text-xs text-ink-muted mt-1">Flight A &amp; Flight B</div>
                    )}
                  </div>
                </DetailRow>
              )}

              {sideGames.filter(s => s !== 'track_putts').length > 0 && (
                <DetailRow icon="🎯" label="Side Games">
                  <div className="flex flex-wrap gap-1.5">
                    {sideGames.filter(s => s !== 'track_putts').map(s => (
                      <span key={s} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#eceae5', color: '#1d1d1f' }}>
                        {SIDE_GAME_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                </DetailRow>
              )}

              {playerCount !== null && (
                <DetailRow icon="👥" label="Players">
                  <span className="font-semibold text-ink">{playerCount} registered</span>
                </DetailRow>
              )}

              {event.entry_fee > 0 && (
                <DetailRow icon="💵" label="Entry Fee">
                  <span className="font-semibold text-ink">${event.entry_fee}</span>
                </DetailRow>
              )}
            </div>

            {/* CTA buttons */}
            <div className="flex gap-3">
              {event.status !== 'upcoming' && (
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-white text-center transition-opacity hover:opacity-90"
                  style={{ background: '#1B4332' }}
                >
                  View Leaderboard →
                </button>
              )}
              <button
                onClick={() => setActiveTab('pairings')}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-center transition-colors"
                style={{ background: '#eceae5', color: '#1d1d1f' }}
              >
                View Pairings →
              </button>
            </div>
          </div>
        )}

        {activeTab === 'pairings' && (
          <div className="space-y-4">
            <EmbeddedSchedule eventId={eid} event={event} orgSlug={orgSlug} leagueSlug={leagueSlug} />
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            {event.status === 'upcoming' ? (
              <div className="text-center py-16 text-ink-muted">
                <div className="text-4xl mb-3">⏳</div>
                <p className="font-semibold">Leaderboard not yet available</p>
                <p className="text-sm mt-1">Check back once the event is underway.</p>
              </div>
            ) : (
              <div className="card overflow-hidden p-0">
                <div className="px-4 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #ebe9e4' }}>
                  <span className="font-semibold text-ink text-sm">Live Leaderboard</span>
                  <Link
                    to={leaderboardUrl}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: '#1B4332', color: '#ffffff' }}
                  >
                    Full view ↗
                  </Link>
                </div>
                <div className="px-4 py-6 text-center text-ink-muted text-sm">
                  <Link to={leaderboardUrl} className="font-semibold underline" style={{ color: '#1B4332' }}>
                    Open full leaderboard →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs py-6" style={{ color: '#c7c7cc' }}>
        Powered by Scorify Golf
      </div>
    </div>
  )
}

// ─── Embedded Schedule ────────────────────────────────────────────────────────
function EmbeddedSchedule({ eventId, event, orgSlug, leagueSlug }) {
  const [eventPlayers, setEventPlayers] = useState([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    supabase
      .from('event_players')
      .select('*, player:players(first_name, last_name)')
      .eq('event_id', eventId)
      .order('group_number')
      .order('flight')
      .order('adjusted_handicap_index')
      .then(({ data }) => { setEventPlayers(data ?? []); setLoading(false) })
  }, [eventId])

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[0,1,2].map(i => <div key={i} className="h-28 rounded-xl" style={{ background: '#eceae5' }} />)}
    </div>
  )

  const groups = {}
  for (const ep of eventPlayers) {
    const g = ep.group_number ?? 0
    if (!groups[g]) groups[g] = []
    groups[g].push(ep)
  }
  const sorted = Object.entries(groups)
    .filter(([k]) => k !== '0')
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
  const ungrouped = groups[0] ?? []

  if (sorted.length === 0 && ungrouped.length === 0) return (
    <div className="text-center py-16 text-ink-muted">
      <div className="text-4xl mb-3">⛳</div>
      <p className="font-semibold">Pairings not posted yet</p>
      <p className="text-sm mt-1">Check back closer to the event.</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {sorted.map(([groupNum, members]) => {
        const teeTime = computeTeeTime(event.start_time, event.tee_time_interval_mins ?? 10, parseInt(groupNum))
        const code = event.group_codes?.[groupNum] ?? null
        return (
          <div key={groupNum} className="card overflow-hidden p-0">
            <div className="flex items-center justify-between px-4 py-3" style={{ background: '#1B4332', color: '#fff' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  {groupNum}
                </div>
                <div>
                  <div className="font-bold text-sm">Group {groupNum}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{members.length} players</div>
                </div>
                {code && (
                  <div className="rounded-lg px-2.5 py-1" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <div className="text-xs leading-none mb-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Code</div>
                    <div className="font-bold text-sm tracking-widest">{code}</div>
                  </div>
                )}
              </div>
              {teeTime && (
                <div className="text-right">
                  <div className="font-bold text-base">{teeTime}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Tee time</div>
                </div>
              )}
            </div>
            <div className="divide-y" style={{ borderColor: '#ebe9e4' }}>
              {members.map(ep => (
                <div key={ep.player_id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {ep.flight && (
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${ep.flight === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {ep.flight}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-ink">
                      {ep.player?.first_name} {ep.player?.last_name}
                    </span>
                    {ep.is_scorekeeper && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: '#eceae5', color: '#1B4332' }}>SK</span>
                    )}
                  </div>
                  <span className="text-xs text-ink-muted">HI {ep.handicap_index}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {ungrouped.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Unassigned</p>
          <div className="space-y-2">
            {ungrouped.map(ep => (
              <div key={ep.player_id} className="text-sm text-ink">
                {ep.player?.first_name} {ep.player?.last_name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function DetailRow({ icon, label, children }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3.5">
      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-ink-muted mb-0.5">{label}</div>
        {children}
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    upcoming: { bg: '#fef9c3', color: '#854d0e', label: 'Upcoming' },
    active:   { bg: '#dcfce7', color: '#166534', label: 'In Progress' },
    complete: { bg: '#eceae5', color: '#86868b', label: 'Complete' },
  }
  const { bg, color, label } = map[status] ?? { bg: '#eceae5', color: '#86868b', label: status }
  return (
    <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: bg, color }}>
      {label}
    </span>
  )
}

function computeTeeTime(startTime, intervalMins, groupNum) {
  if (!startTime) return null
  const [h, m] = startTime.split(':').map(Number)
  const total = h * 60 + m + (groupNum - 1) * intervalMins
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 || 12
  return `${h12}:${mm.toString().padStart(2, '0')} ${ampm}`
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatTime(t) {
  return computeTeeTime(t, 0, 1) ?? t
}

function Skeleton() {
  return (
    <div className="min-h-screen" style={{ background: '#fbfaf8' }}>
      <div className="h-36 animate-pulse" style={{ background: '#1B4332', opacity: 0.7 }} />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {[0,1,2].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#eceae5' }} />)}
      </div>
    </div>
  )
}

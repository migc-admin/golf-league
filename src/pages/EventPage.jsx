/**
 * Public Event Page — redesigned with split hero, cover photo, registration CTA,
 * tournament description, sponsor scroll bar, mobile optimized.
 */

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSubdomainOrg } from '../lib/SubdomainContext'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'

const FORMAT_LABELS = {
  net_stroke:          'Net Stroke Play — Overall',
  net_stroke_front9:   'Net Stroke Play — Front 9',
  net_stroke_back9:    'Net Stroke Play — Back 9',
  low_gross:           'Low Gross — Overall',
  gross_stroke_front9: 'Low Gross — Front 9',
  gross_stroke_back9:  'Low Gross — Back 9',
  net_stroke_nassau:   'Nassau',
  stableford:          'Stableford — Net',
  stableford_gross:    'Stableford — Gross',
  best_ball_2:         'Best Ball — 2 Person',
  best_ball_4:         'Best Ball — 4 Person',
  scramble:            'Scramble',
  shamble:             'Shamble',
  match_points:        'Match Points',
  ryder_cup:           'Ryder Cup',
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

const BASE_TABS = [
  { key: 'overview',  label: 'Overview'  },
  { key: 'pairings',  label: 'Pairings'  },
  { key: 'photos',    label: 'Photos'    },
]

export default function EventPage() {
  const subdomainOrg = useSubdomainOrg()
  const { orgSlug: paramOrgSlug, leagueSlug, eventSlug } = useParams()
  const orgSlug = subdomainOrg ?? paramOrgSlug
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
  const _leagueSlug    = event.league?.slug ?? leagueSlug
  const leaderboardUrl = subdomainOrg
    ? `/${_leagueSlug}/${event.slug}/leaderboard?eid=${eid}`
    : `/${orgSlug}/${_leagueSlug}/${event.slug}/leaderboard?eid=${eid}`
  const regUrl         = event.league?.slug && event.slug ? `/register/${event.league.slug}/${event.slug}` : null
  const formats        = event.formats ?? (event.format ? [event.format] : [])
  const sideGames      = event.side_game_options ?? []
  const eventName      = event.name ?? `Event #${event.event_number}`
  const coverImage     = event.cover_image_url ?? null
  const sponsors       = event.sponsors ?? []
  const photos         = event.photos ?? []
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

        {/* Cover photo — mobile only, full-width banner */}
        {coverImage && (
          <div className="event-cover-mobile" style={{ width: '100%', height: 200, overflow: 'hidden' }}>
            <img src={coverImage} alt={eventName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        <div className="event-hero-grid" style={{
          maxWidth: 1100, margin: '0 auto', width: '100%',
          display: 'grid',
          gridTemplateColumns: coverImage ? 'minmax(0,1fr) min(420px,45%)' : '1fr',
        }}>

          {/* Left panel */}
          <div style={{ padding: 'clamp(20px,4vw,44px) clamp(16px,4vw,44px) 0', display: 'flex', flexDirection: 'column', minHeight: coverImage ? 360 : 'auto' }}>

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
                {event.league?.name}
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
                  {courseAddress && (
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280', textDecoration: 'underline' }}>{courseAddress}</a>
                    </div>
                  )}
                </div>
              </MetaRow>
            </div>

            {/* Registration CTA — only if upcoming and reg is available */}
            {event.status === 'upcoming' && regUrl && (
              <div className="reg-cta" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                {event.tournament_fee > 0 && (
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#111827', letterSpacing: '-0.02em' }}>
                    ${Number(event.tournament_fee).toFixed(0)}<span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>/player</span>
                  </div>
                )}
                {spotsLeft !== null && spotsLeft <= 0 ? (
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>Registration Closed</span>
                ) : (
                  <Link to={regUrl}
                    style={{ flexShrink: 0, display: 'inline-block', background: GREEN, color: '#fff', fontWeight: 800, fontSize: 14, padding: '13px 28px', borderRadius: 10, textDecoration: 'none' }}>
                    Register →
                  </Link>
                )}
              </div>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Tab bar */}
            <div className="event-tab-bar" style={{ borderTop: '1px solid #e5e7eb', marginLeft: 'clamp(-16px,-4vw,-44px)', marginRight: 'clamp(-16px,-4vw,-44px)' }}>
              {BASE_TABS.map(tab => (
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

          {/* Right: Cover photo — desktop only */}
          {coverImage && (
            <div style={{ position: 'relative', overflow: 'hidden', display: 'none' }} className="event-cover-desktop">
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

        {activeTab === 'photos' && (
          <PhotosTab photos={photos} eventId={event.id} onUploaded={photo => setEvent(prev => ({ ...prev, photos: [...(prev.photos ?? []), photo] }))} />
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
        /* Disable iOS Safari auto-link detection on addresses */
        a[x-apple-data-detectors] {
          color: inherit !important;
          text-decoration: none !important;
          pointer-events: none;
        }
        .event-cover-mobile { display: block; }
        .event-cover-desktop { display: none; }
        @media (min-width: 768px) {
          .event-cover-mobile { display: none; }
          .event-cover-desktop { display: block !important; }
        }
        @media (max-width: 767px) {
          .event-hero-grid { grid-template-columns: 1fr !important; }
        }
        .event-tab-bar { display: flex; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; width: 100%; }
        .event-tab-bar::-webkit-scrollbar { display: none; }
        .event-tab-bar button, .event-tab-bar a { flex: 1; text-align: center; min-width: 0; padding-left: 8px !important; padding-right: 8px !important; justify-content: center; }
        @media (min-width: 480px) {
          .event-tab-bar button, .event-tab-bar a { flex: none; padding-left: 24px !important; padding-right: 24px !important; }
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {sponsors.map((s, i) => {
            const tile = (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f9f8f5', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px 14px', minWidth: 140, gap: 10 }}>
                {s.logo_url ? (
                  <img src={s.logo_url} alt={s.name ?? 'Sponsor'} style={{ height: 72, maxWidth: 160, objectFit: 'contain' }} />
                ) : (
                  <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textAlign: 'center' }}>{s.name}</span>
                  </div>
                )}
                {s.logo_url && s.name && (
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', textAlign: 'center' }}>{s.name}</span>
                )}
              </div>
            )
            return s.url ? (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{tile}</a>
            ) : (
              <div key={i}>{tile}</div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ event, leaderboardUrl, description }) {
  const scheduleItems = (event.schedule_items ?? []).filter(s => s.label?.trim())
  const customCompetitions = (event.custom_competitions ?? []).filter(c => c?.trim())
  const formats = (event.formats ?? (event.format ? [event.format] : []))
    .map(k => FORMAT_LABELS[k])
    .filter(Boolean)
  const presetGames = (event.side_game_options ?? [])
    .map(k => SIDE_GAME_LABELS[k])
    .filter(Boolean)
  const allCompetitions = [...formats, ...presetGames, ...customCompetitions]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {description && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>About this Event</div>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: '#374151', margin: 0 }}
            dangerouslySetInnerHTML={{ __html:
              description
                .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br/>')
            }}
          />
        </div>
      )}

      {scheduleItems.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Schedule</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {scheduleItems.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 16, alignItems: 'start', padding: '14px 16px', background: '#f9f8f5', borderRadius: 12, border: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', paddingTop: 1 }}>
                  {item.time ? formatTime12(item.time) : '—'}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{item.label}</div>
                  {item.description?.trim() && (
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3, lineHeight: 1.5 }}>{item.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {allCompetitions.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Competitions &amp; Side Games
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allCompetitions.map((name, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#111827' }}>
                <span style={{ color: '#16a34a', fontSize: 16, lineHeight: 1 }}>⛳</span>
                {name}
              </div>
            ))}
          </div>
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

// ─── Photos Tab ───────────────────────────────────────────────────────────────
function PhotosTab({ photos, eventId, onUploaded }) {
  const [lightbox,     setLightbox]     = useState(null)
  const [uploading,    setUploading]    = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [uploaderName, setUploaderName] = useState('')
  const [caption,      setCaption]      = useState('')
  const fileInputRef = { current: null }

  // Normalize: support legacy plain-URL strings and new objects
  const normalizedPhotos = photos.map(p => typeof p === 'string' ? { url: p } : p)

  function handleFileSelect(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setPendingFiles(files)
    e.target.value = ''
  }

  async function handleConfirmUpload() {
    if (!pendingFiles.length) return
    setUploading(true)
    try {
      for (const file of pendingFiles) {
        const ext  = file.name.split('.').pop()
        const path = `events/${eventId}/photos/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('media').upload(path, file, { upsert: false })
        if (error) continue
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
        const photo = {
          url: publicUrl,
          ...(caption.trim()      && { caption:      caption.trim() }),
          ...(uploaderName.trim() && { uploaded_by:  uploaderName.trim() }),
          uploaded_at: new Date().toISOString(),
        }
        const { data: ev } = await supabase.from('events').select('photos').eq('id', eventId).single()
        const next = [...(ev?.photos ?? []), photo]
        await supabase.from('events').update({ photos: next }).eq('id', eventId)
        onUploaded(photo)
      }
    } finally {
      setUploading(false)
      setPendingFiles([])
      setCaption('')
      setUploaderName('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Upload button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', borderRadius: 10, border: '2px dashed #1B4332',
          color: '#1B4332', fontWeight: 700, fontSize: 14, cursor: uploading ? 'not-allowed' : 'pointer',
          opacity: uploading ? 0.5 : 1,
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4"/>
          </svg>
          Add Photos
          <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileSelect} disabled={uploading} />
        </label>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>Share your shots from the event</span>
      </div>

      {/* Metadata form — shown after files are selected */}
      {pendingFiles.length > 0 && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
            {pendingFiles.length} photo{pendingFiles.length !== 1 ? 's' : ''} selected
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Your name</label>
            <input
              value={uploaderName}
              onChange={e => setUploaderName(e.target.value)}
              placeholder="e.g. John Smith"
              style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', background: '#fff' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Caption (optional)</label>
            <input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="e.g. Hole 7 eagle putt!"
              style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', background: '#fff' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={handleConfirmUpload} disabled={uploading}
              style={{ flex: 1, background: '#1B4332', color: '#fff', fontWeight: 700, fontSize: 14, padding: '11px 0', borderRadius: 9, border: 'none', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button onClick={() => setPendingFiles([])} disabled={uploading}
              style={{ padding: '11px 18px', borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#374151' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {normalizedPhotos.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 60, paddingBottom: 60 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📷</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 6 }}>No photos yet</div>
          <div style={{ fontSize: 14, color: '#86868b' }}>Be the first to upload!</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {normalizedPhotos.map((photo, i) => (
            <div key={i} onClick={() => setLightbox({ photo, idx: i })} style={{ cursor: 'pointer' }}>
              <div style={{ borderRadius: 12, overflow: 'hidden', aspectRatio: '1', background: '#f3f4f6' }}>
                <img src={photo.url} alt={photo.caption ?? `Photo ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                />
              </div>
              {(photo.caption || photo.uploaded_by) && (
                <div style={{ padding: '6px 2px' }}>
                  {photo.caption && <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>{photo.caption}</div>}
                  {photo.uploaded_by && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{photo.uploaded_by}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={lightbox.photo.url} alt={lightbox.photo.caption ?? 'Event photo'}
            style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 12, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          />
          {(lightbox.photo.caption || lightbox.photo.uploaded_by) && (
            <div onClick={e => e.stopPropagation()} style={{ marginTop: 14, textAlign: 'center' }}>
              {lightbox.photo.caption && <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{lightbox.photo.caption}</div>}
              {lightbox.photo.uploaded_by && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>📷 {lightbox.photo.uploaded_by}</div>}
            </div>
          )}
          {/* Prev */}
          {lightbox.idx > 0 && (
            <button onClick={e => { e.stopPropagation(); setLightbox({ photo: normalizedPhotos[lightbox.idx - 1], idx: lightbox.idx - 1 }) }}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>
              ‹
            </button>
          )}
          {/* Next */}
          {lightbox.idx < normalizedPhotos.length - 1 && (
            <button onClick={e => { e.stopPropagation(); setLightbox({ photo: normalizedPhotos[lightbox.idx + 1], idx: lightbox.idx + 1 }) }}
              style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>
              ›
            </button>
          )}
          <button onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            {lightbox.idx + 1} / {normalizedPhotos.length}
          </div>
        </div>
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

  if (sorted.length === 0 || ungrouped.length > 0) {
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

function formatTime12(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

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

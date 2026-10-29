/**
 * Public Event Page — status-driven hero (registration / countdown / results), sticky tabs,
 * and body cards. Presentation lives in src/components/event-page; page logic in lib/eventPageView.
 */

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSubdomainOrg } from '../lib/SubdomainContext'
import EventHero from '../components/event-page/EventHero'
import EventActionCard from '../components/event-page/EventActionCard'
import EventCoverImage from '../components/event-page/EventCoverImage'
import useScrolledPast from '../components/event-page/useScrolledPast'
import EventTabBar from '../components/event-page/EventTabBar'
import AboutCard from '../components/event-page/AboutCard'
import MatchupsCard from '../components/event-page/MatchupsCard'
import CompetitionsCard from '../components/event-page/CompetitionsCard'
import ScheduleCard from '../components/event-page/ScheduleCard'
import GettingThereCard from '../components/event-page/GettingThereCard'
import LocalRulesCard from '../components/event-page/LocalRulesCard'
import SponsorsCard from '../components/event-page/SponsorsCard'
import {
  registrationState, feeLabel, eventTabs, competitionGroups, scheduleEntries, matchupRows,
} from '../lib/eventPageView'

const GREEN    = '#1B4332'
const MIGC_ORG = import.meta.env.VITE_MIGC_ORG_ID

export default function EventPage() {
  const subdomainOrg = useSubdomainOrg()
  const { orgSlug: paramOrgSlug, leagueSlug, eventSlug } = useParams()
  const orgSlug = subdomainOrg ?? paramOrgSlug
  const [searchParams] = useSearchParams()
  const directEventId = searchParams.get('eid')

  const [event,        setEvent]        = useState(null)
  const [playerCount,  setPlayerCount]  = useState(null)
  const [eventPlayers, setEventPlayers] = useState([])
  const [pairings,     setPairings]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState('overview')

  useEffect(() => {
    async function load() {
      try {
        let ev = null
        if (directEventId) {
          const { data } = await supabase
            .from('events')
            .select('*, course:courses(name, address), league:leagues(name, season_year, slug, logo_url, org_id, is_trip_league)')
            .eq('id', directEventId).single()
          ev = data
        } else {
          const { data: league } = await supabase.from('leagues').select('id').eq('slug', leagueSlug).single()
          if (!league) { setLoading(false); return }
          const { data } = await supabase
            .from('events')
            .select('*, course:courses(name, address), league:leagues(name, season_year, slug, logo_url, org_id, is_trip_league)')
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

        // Match Play / Ryder Cup matchups — only fetched when the event actually
        // uses one of those formats, to avoid an extra query on every event.
        const evFormats = ev.formats ?? (ev.format ? [ev.format] : [])
        if (evFormats.includes('match_points') || evFormats.includes('ryder_cup')) {
          const { data: mp } = await supabase
            .from('match_pairings')
            .select('*, playerA:players!player_a_id(first_name,last_name), playerB:players!player_b_id(first_name,last_name)')
            .eq('event_id', ev.id)
            .order('match_number')
          setPairings(mp ?? [])
        }

        setLoading(false)
      } catch (err) {
        console.error('EventPage load error:', err)
        setLoading(false)
      }
    }
    load()
  }, [directEventId, leagueSlug, eventSlug])

  // The tab bar's Register button only appears once the hero's Register button has scrolled out of view.
  const heroRegisterPassed = useScrolledPast('hero-register', loading)

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
  const regUrl         = event.league?.slug && event.slug && !event.league?.is_trip_league
    ? `/register/${event.league.slug}/${event.slug}`
    : null
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

  const eventDateTime = event.event_date
    ? new Date(`${event.event_date}T${(event.start_time ?? '00:00:00').slice(0, 8)}`)
    : null

  // Wager link: always for live events. For upcoming events, only once groups
  // are set and — when the event has match play — the matchups are posted too.
  const hasMatchFormat = formats.includes('match_points') || formats.includes('ryder_cup')
  const groupsSet      = eventPlayers.some(ep => ep.group_number != null)
  const matchupsSet    = !hasMatchFormat || pairings.length > 0
  const showBetLink    = event.status === 'active' || (event.status === 'upcoming' && groupsSet && matchupsSet)

  const reg        = registrationState({ status: event.status, regUrl, spotsLeft })
  const fee        = feeLabel(event.tournament_fee)
  const { tabs, registerLabel } = eventTabs({ hasMatchups: pairings.length > 0, canRegister: reg.canRegister, fee })
  const countdownTarget = event.status === 'complete' ? null : eventDateTime

  return (
    <div className="flex min-h-screen flex-col bg-surface-dim">

      <EventHero
        clubName={event.league?.name}
        logoUrl={event.league?.logo_url}
        pill={{ kind: reg.kind, label: reg.pill }}
        title={eventName}
        dateLabel={event.event_date ? longDate(event.event_date) : null}
        timeLabel={startLabel}
        courseName={event.course?.name}
        courseAddress={courseAddress}
        media={coverImage ? <EventCoverImage src={coverImage} alt={eventName} /> : null}
      >
        <EventActionCard
          kind={reg.kind}
          targetDate={countdownTarget}
          fee={fee}
          regUrl={regUrl}
          leaderboardUrl={leaderboardUrl}
          onPhotos={() => setActiveTab('photos')}
        />
      </EventHero>

      <EventTabBar
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
        leaderboardUrl={leaderboardUrl}
        registerLabel={heroRegisterPassed ? registerLabel : null}
        registerHref={regUrl}
      />

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
        {activeTab === 'overview' && (
          <OverviewTab
            event={event} pairings={pairings} eventPlayers={eventPlayers} description={description}
            courseAddress={courseAddress} mapsUrl={mapsUrl} eventId={eid} showBetLink={showBetLink}
            startLabel={startLabel} sponsors={sponsors} onSeePairings={() => setActiveTab('pairings')}
          />
        )}

        {activeTab === 'matchups' && (
          <MatchupsTab pairings={pairings} event={event} eventPlayers={eventPlayers} />
        )}

        {activeTab === 'pairings' && (
          <GroupList eventPlayers={eventPlayers} event={event} orgSlug={orgSlug} />
        )}

        {activeTab === 'photos' && (
          <PhotosTab photos={photos} eventId={event.id} onUploaded={photo => setEvent(prev => ({ ...prev, photos: [...(prev.photos ?? []), photo] }))} />
        )}

        {activeTab !== 'overview' && sponsors.length > 0 && (
          <div className="mt-8 max-w-[520px]"><SponsorsCard sponsors={sponsors} /></div>
        )}
      </main>

      <footer className="py-5 text-center text-xs text-ink-muted">
        Powered by <strong className="font-semibold">Scorify Golf</strong>
      </footer>
    </div>
  )
}


// ─── Overview Tab ──────────────────────────────────────────────────────────
function OverviewTab({ event, pairings, eventPlayers, description, courseAddress, mapsUrl, eventId, showBetLink, startLabel, sponsors, onSeePairings }) {
  const isMIGC = event.league?.org_id === MIGC_ORG
  const formats = event.formats ?? (event.format ? [event.format] : [])
  const teams = event.ryder_cup_teams
  const matchSubtitle = formats.includes('ryder_cup') ? `${teams?.a || 'Team A'} vs ${teams?.b || 'Team B'}` : null
  const schedule = scheduleEntries(event, startLabel)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        {isMIGC && eventId && showBetLink && (
          <a href={`/wager/${eventId}`} className="flex items-center justify-between rounded-sm bg-fairway-700 px-5 py-4 text-white no-underline">
            <span>
              <span className="block text-[15px] font-bold">Place a Bet</span>
              <span className="block text-xs text-fairway-200">Parimutuel wager board · Venmo or cash</span>
            </span>
            <span className="text-xl font-bold" aria-hidden="true">→</span>
          </a>
        )}
        <AboutCard text={description} />
        <MatchupsCard rows={matchupRows(pairings, eventPlayers)} subtitle={matchSubtitle} onSeePairings={onSeePairings} />
        <CompetitionsCard groups={competitionGroups(event)} />
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <ScheduleCard entries={schedule} />
        <GettingThereCard courseName={event.course?.name} address={courseAddress} mapsUrl={mapsUrl} />
        <LocalRulesCard text={event.local_rules} />
        <SponsorsCard sponsors={sponsors} />
      </div>
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

// ─── Matchups Tab (Match Play / Ryder Cup pairings) ────────────────────────────
function MatchupsTab({ pairings, event, eventPlayers }) {
  const epByPlayerId = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep]))
  function relativeStrokes(aId, bId) {
    const chA = epByPlayerId[aId]?.course_handicap ?? 0
    const chB = epByPlayerId[bId]?.course_handicap ?? 0
    const baseline = Math.min(chA, chB)
    return { relA: Math.max(0, chA - baseline), relB: Math.max(0, chB - baseline) }
  }

  const isRyderCup = (event.formats ?? (event.format ? [event.format] : [])).includes('ryder_cup')
  const teamAName = event.ryder_cup_teams?.a || 'Team A'
  const teamBName = event.ryder_cup_teams?.b || 'Team B'

  if (pairings.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Matchups not posted yet</div>
        <div style={{ fontSize: 14, color: '#86868b' }}>Check back closer to the event.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {isRyderCup && (
        <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>
          {teamAName} vs {teamBName} · {pairings.length} match{pairings.length !== 1 ? 'es' : ''}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {pairings.map(p => {
          const { relA, relB } = relativeStrokes(p.player_a_id, p.player_b_id)
          return (
            <div key={p.id} style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              <div style={{ background: GREEN, color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.04em' }}>MATCH #{p.match_number}</span>
                {isRyderCup && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{teamAName} vs {teamBName}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1d4ed8' }}>
                    {p.playerA?.first_name} {p.playerA?.last_name}
                  </span>
                  {relA > 0 && <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>+{relA}</span>}
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', fontWeight: 700, padding: '4px 0' }}>VS</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#6d28d9' }}>
                    {p.playerB?.first_name} {p.playerB?.last_name}
                  </span>
                  {relB > 0 && <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>+{relB}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
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

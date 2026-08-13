import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { hasFeature as checkFeature } from '../../lib/features'
import toast from 'react-hot-toast'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import { StatusBadge } from '../../components/ui/Badge'
import ImageUpload from '../../components/ui/ImageUpload'

const CURRENT_YEAR = new Date().getFullYear()

export default function LeagueDetail() {
  const { leagueSlug } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [league,       setLeague]       = useState(null)
  const [events,       setEvents]       = useState([])
  const [orgSlug,      setOrgSlug]      = useState(null)
  const [orgId,        setOrgId]        = useState(null)
  const [orgTier,      setOrgTier]      = useState('free')
  const [loading,      setLoading]      = useState(true)
  const [leagueModal,  setLeagueModal]  = useState(false)
  const [eventModal,   setEventModal]   = useState(false)
  const [tglModal,     setTglModal]     = useState(false)

  const dragItem = useRef(null)
  const dragOver = useRef(null)

  async function load(slug, leagueId) {
    const { data: evData } = await supabase
      .from('events')
      .select('id, event_number, name, slug, event_date, status, display_order, course:courses(name)')
      .eq('league_id', leagueId)
      .order('display_order', { ascending: true, nullsFirst: false })
    setEvents(evData ?? [])
  }

  function handleDragStart(i) {
    dragItem.current = i
  }

  function handleDragEnter(i) {
    dragOver.current = i
    if (dragItem.current === i) return
    const reordered = [...events]
    const [moved] = reordered.splice(dragItem.current, 1)
    reordered.splice(i, 0, moved)
    dragItem.current = i
    setEvents(reordered)
  }

  async function handleDragEnd() {
    dragItem.current = null
    dragOver.current = null
    await Promise.all(
      events.map((ev, i) =>
        supabase.from('events').update({ display_order: i }).eq('id', ev.id)
      )
    )
  }

  useEffect(() => {
    async function init() {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('org_id').eq('id', user.id).single()
      if (!profile?.org_id) return
      const { data: org } = await supabase
        .from('organizations').select('id, slug, tier').eq('id', profile.org_id).single()
      if (org) {
        setOrgSlug(org.slug)
        setOrgId(org.id)
        // Apply same owner/platform-admin Club override as Layout + Settings
        const { data: prof2 } = await supabase
          .from('profiles').select('is_owner, is_platform_admin').eq('id', user.id).single()
        const isPrivileged = prof2?.is_owner || prof2?.is_platform_admin
        setOrgTier(isPrivileged ? 'club' : (org.tier ?? 'free'))
      }

      const { data: lg } = await supabase
        .from('leagues')
        .select('id, name, slug, season_year, logo_url, team_play_label')
        .eq('slug', leagueSlug)
        .single()
      if (!lg) { navigate('/admin/leagues'); return }
      setLeague(lg)
      await load(org.slug, lg.id)
      setLoading(false)
    }
    init()
  }, [user, leagueSlug])

  async function handleDeleteLeague() {
    if (!confirm('Delete this league? All events and earnings will be deleted.')) return
    const { error } = await supabase.from('leagues').delete().eq('id', league.id)
    if (error) toast.error(error.message)
    else { toast.success('League deleted'); navigate('/admin/leagues') }
  }

  async function refreshLeague() {
    const { data: lg } = await supabase
      .from('leagues').select('id, name, slug, season_year, logo_url, team_play_label').eq('id', league.id).single()
    if (lg) setLeague(lg)
    await load(orgSlug, league.id)
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-lg" style={{ background: '#eceae5' }} />
        <div className="h-40 rounded-xl" style={{ background: '#eceae5' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div>
        <Link to="/admin/leagues" className="text-sm text-ink-muted hover:text-ink">← All Leagues</Link>
      </div>

      {/* League header card */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-start gap-5 px-5 py-5" style={{ borderBottom: '1px solid #ebe9e4' }}>
          {/* Logo upload — Club tier only */}
          <div className="shrink-0">
            {checkFeature(orgTier ?? 'free', 'custom_branding') ? (
              <ImageUpload
                shape="rect"
                path={`orgs/${orgSlug}/leagues/${league.id}/logo`}
                currentUrl={league.logo_url ?? null}
                onUploaded={async (url) => {
                  await supabase.from('leagues').update({ logo_url: url }).eq('id', league.id)
                  setLeague(prev => ({ ...prev, logo_url: url }))
                }}
                onRemoved={async () => {
                  await supabase.from('leagues').update({ logo_url: null }).eq('id', league.id)
                  setLeague(prev => ({ ...prev, logo_url: null }))
                }}
                label="League Logo"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl flex flex-col items-center justify-center text-center gap-1"
                style={{ border: '2px dashed #d1d5db', background: '#f9fafb' }}>
                <svg width="20" height="20" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                <span className="text-xs text-gray-400 leading-tight">Club plan</span>
              </div>
            )}
          </div>

          {/* League info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-ink" style={{ letterSpacing: '-0.03em' }}>{league.name}</h1>
            <p className="text-sm text-ink-muted mt-0.5">Season {league.season_year} · {events.length} event{events.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
            <Button size="sm" onClick={() => setEventModal(true)}>+ Event</Button>
            <Button size="sm" variant="secondary" onClick={() => setLeagueModal(true)}>Edit League</Button>
            <Link to={`/${orgSlug}/${league.slug}/standings`} className="btn btn-secondary btn-sm">Standings</Link>
            {checkFeature(orgTier, 'tgl') ? (
              <Button size="sm" variant="secondary" onClick={() => setTglModal(true)}>{league.team_play_label || 'Team Play'}</Button>
            ) : (
              <span className="text-xs text-ink-muted rounded-full px-3 py-1" style={{ background: '#eceae5' }}>Team Play — Club</span>
            )}
            <Button size="sm" variant="danger" onClick={handleDeleteLeague}>Delete</Button>
          </div>
        </div>

        {/* Events list */}
        {events.length === 0 ? (
          <div className="px-5 py-6 text-sm text-ink-muted">
            No events yet. <button onClick={() => setEventModal(true)} className="text-fairway-700 hover:underline font-semibold">Add first event →</button>
          </div>
        ) : (
          <div>
            {events.map((ev, i) => (
              <div
                key={ev.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragEnter={() => handleDragEnter(i)}
                onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                className="flex items-center gap-2 transition-colors"
                style={{ borderBottom: i < events.length - 1 ? '1px solid #ebe9e4' : 'none' }}
              >
                {/* Drag handle */}
                <div className="pl-3 py-4 cursor-grab active:cursor-grabbing text-ink-muted flex-shrink-0" style={{ touchAction: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="3" y="3" width="10" height="1.5" rx="0.75"/>
                    <rect x="3" y="7.25" width="10" height="1.5" rx="0.75"/>
                    <rect x="3" y="11.5" width="10" height="1.5" rx="0.75"/>
                  </svg>
                </div>
                {/* Clickable row */}
                <Link
                  to={`/admin/${orgSlug}/${league.slug}/${ev.slug}`}
                  className="flex flex-1 items-center justify-between pr-5 py-3 min-w-0"
                  onMouseEnter={e => e.currentTarget.closest('div[draggable]').style.background = '#f4f3f0'}
                  onMouseLeave={e => e.currentTarget.closest('div[draggable]').style.background = ''}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-semibold text-ink truncate">
                      {ev.name ? ev.name : `Event #${ev.event_number}`}
                    </span>
                    {ev.course?.name && <span className="text-xs text-ink-muted hidden sm:inline">{ev.course.name}</span>}
                    <span className="text-xs text-ink-muted">{formatDate(ev.event_date)}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Link
                      to={`/${orgSlug}/${league.slug}/${ev.slug}/leaderboard?eid=${ev.id}`}
                      onClick={e => e.stopPropagation()}
                      className="text-xs font-semibold text-fairway-700 hover:underline"
                    >
                      Leaderboard ↗
                    </Link>
                    <StatusBadge status={ev.status} />
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <LeagueModal
        open={leagueModal}
        onClose={() => setLeagueModal(false)}
        editing={league}
        orgId={orgId}
        orgSlug={orgSlug}
        onSaved={() => { setLeagueModal(false); refreshLeague() }}
      />
      <EventModal
        open={eventModal}
        onClose={() => setEventModal(false)}
        league={league}
        orgTier={orgTier}
        onSaved={() => { setEventModal(false); load(orgSlug, league.id) }}
      />
      {tglModal && (
        <TGLTeamsModal
          open={tglModal}
          onClose={() => setTglModal(false)}
          league={league}
        />
      )}
    </div>
  )
}

// ─── League Modal ─────────────────────────────────────────────────────────────
function LeagueModal({ open, onClose, editing, orgId, orgSlug, onSaved }) {
  const [name,          setName]          = useState('')
  const [year,          setYear]          = useState(CURRENT_YEAR)
  const [logoUrl,       setLogoUrl]       = useState('')
  const [teamPlayLabel, setTeamPlayLabel] = useState('')
  const [saving,        setSaving]        = useState(false)

  useEffect(() => {
    if (editing) { setName(editing.name); setYear(editing.season_year); setLogoUrl(editing.logo_url ?? ''); setTeamPlayLabel(editing.team_play_label ?? '') }
    else         { setName('');           setYear(CURRENT_YEAR);        setLogoUrl('');                     setTeamPlayLabel('') }
  }, [editing, open])

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    let resolvedOrgId = orgId
    if (!resolvedOrgId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
        resolvedOrgId = profile?.org_id ?? null
      }
    }
    const { error } = editing
      ? await supabase.from('leagues').update({ name: name.trim(), season_year: +year, logo_url: logoUrl || null, team_play_label: teamPlayLabel.trim() || null }).eq('id', editing.id)
      : await supabase.from('leagues').insert({ name: name.trim(), season_year: +year, org_id: resolvedOrgId, logo_url: logoUrl || null })
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success(editing ? 'League updated' : 'League created'); onSaved() }
  }

  const years = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i)
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit League' : 'New League'}>
      <form onSubmit={handleSave} className="space-y-4">
        <ImageUpload
          shape="rect"
          path={`orgs/${orgSlug}/leagues/${Date.now()}`}
          currentUrl={logoUrl || null}
          onUploaded={url => setLogoUrl(url)}
          onRemoved={() => setLogoUrl('')}
          label="League Logo (optional)"
        />
        <Input label="League Name" value={name} onChange={e => setName(e.target.value)} placeholder="Tuesday Evening League" required />
        <Select label="Season Year" value={year} onChange={e => setYear(e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Input label="Team Play Button Label (optional)" value={teamPlayLabel} onChange={e => setTeamPlayLabel(e.target.value)} placeholder="e.g. TGL Teams, Ryder Cup, Match Play…" />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{editing ? 'Save' : 'Create League'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Event Modal ──────────────────────────────────────────────────────────────

// Side games that can apply per-flight OR to the whole group
const PER_FLIGHT_GAMES = [
  { key: 'skins',      label: 'Skins',                      pro: true },
  { key: 'long_drive', label: 'Long Drive',                 pro: true },
  { key: 'low_putts',  label: 'Low Putts',                  pro: true },
  { key: 'ctp',        label: 'Closest to Pin (par 3s)',    pro: true },
]
const GROUP_GAMES = []

const PER_FLIGHT_GAME_KEYS = new Set(PER_FLIGHT_GAMES.map(g => g.key))

/** Convert base game set + scope map + numFlights → side_game_options array for DB */
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

/** Parse existing side_game_options from DB back into { games: Set, scope: {} } */
function parseSideGameOptions(options) {
  const games = new Set()
  const scope = {}
  for (const opt of options ?? []) {
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

const FORMAT_OPTIONS = [
  { group: 'Net Stroke Play', options: [
    { value: 'net_stroke',        label: '18-Hole Overall Net' },
    { value: 'net_stroke_front9', label: 'Front Nine Net' },
    { value: 'net_stroke_back9',  label: 'Back Nine Net' },
  ]},
  { group: 'Other Formats', options: [
    { value: 'stableford',      label: 'Stableford' },
    { value: 'scramble',        label: 'Scramble' },
    { value: 'match_points',    label: 'Match Play (Head-to-Head)',  pro: true },
    { value: 'team_match_play', label: 'Match Play (Team Best Ball)', pro: true },
    { value: 'ryder_cup',       label: 'Ryder Cup',                  pro: true },
  ]},
]

const PLACES_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function EventModal({ open, onClose, league, orgTier, onSaved }) {
  const canUsePro = checkFeature(orgTier ?? 'free', 'side_games')

  const [courses,      setCourses]      = useState([])
  const [courseId,     setCourseId]     = useState('')
  const [eventDate,    setEventDate]    = useState('')
  const [eventNum,     setEventNum]     = useState(1)
  const [eventName,    setEventName]    = useState('')
  const [entryFee,     setEntryFee]     = useState('20')
  const [payoutBasis,  setPayoutBasis]  = useState('per_player')
  const [payoutFixed,  setPayoutFixed]  = useState('')
  const [formats,      setFormats]      = useState(new Set(['net_stroke']))
  const [payoutPlaces, setPayoutPlaces] = useState({})   // { format_key: number }
  const [sideGames,    setSideGames]    = useState(new Set())
  const [customCompetitions, setCustomCompetitions] = useState([])
  const [gameScope,    setGameScope]    = useState({})   // { game_key: 'flight'|'group' }
  const [numFlights,   setNumFlights]   = useState(0)   // 0 = no flights, 2–25 = number of flights
  const [startTime,    setStartTime]    = useState('')
  const [interval,     setInterval]     = useState(10)
  const [tournamentFee,  setTournamentFee]  = useState('')
  const [venmoHandle,   setVenmoHandle]   = useState('')
  const [paypalLink,    setPaypalLink]    = useState('')
  const [zelleHandle,     setZelleHandle]     = useState('')
  const [customQuestions, setCustomQuestions] = useState([{ label: '', required: false }])
  const [scheduleItems,   setScheduleItems]   = useState([])
  const [shotgunStart,  setShotgunStart]  = useState(false)
  const [holesPlayed,   setHolesPlayed]   = useState(18)
  const [useHandicaps,  setUseHandicaps]  = useState(true)
  const [saving,        setSaving]        = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.from('courses').select('id, name').order('name').then(({ data }) => setCourses(data ?? []))
    if (league) {
      supabase.from('events').select('event_number').eq('league_id', league.id).order('event_number', { ascending: false }).limit(1)
        .then(({ data }) => setEventNum(data?.[0]?.event_number ? data[0].event_number + 1 : 1))
    }
    setEventDate(''); setCourseId(''); setEventName(''); setEntryFee('20')
    setPayoutBasis('per_player'); setPayoutFixed('')
    setFormats(new Set(['net_stroke'])); setPayoutPlaces({}); setSideGames(new Set()); setGameScope({})
    setNumFlights(0); setStartTime(''); setInterval(10)
    setTournamentFee(''); setVenmoHandle(''); setPaypalLink(''); setZelleHandle(''); setShotgunStart(false)
    setCustomCompetitions([])
    setCustomQuestions([{ label: '', required: false }])
    setScheduleItems([])
    setHolesPlayed(18)
    setUseHandicaps(true)
  }, [open, league])

  function toggleFormat(key) {
    setFormats(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next })
  }
  function toggleSideGame(key) {
    setSideGames(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!courseId || !eventDate || formats.size === 0) return
    setSaving(true)
    const formatsArr = [...formats]
    const { error } = await supabase.from('events').insert({
      league_id:              league.id,
      course_id:              courseId,
      event_date:             eventDate,
      event_number:           parseInt(eventNum, 10),
      name:                   eventName.trim() || null,
      entry_fee:              Math.round(parseFloat(entryFee) * 100) / 100,
      payout_basis:           payoutBasis,
      payout_fixed_total:     payoutBasis === 'fixed' ? parseFloat(payoutFixed) || 0 : null,
      format:                 formatsArr[0],
      formats:                formatsArr,
      use_flights:            numFlights > 0,
      num_flights:            numFlights > 0 ? numFlights : null,
      side_game_options:      buildSideGameOptions(sideGames, gameScope, numFlights),
      payout_places:          Object.keys(payoutPlaces).length > 0 ? payoutPlaces : null,
      start_time:             startTime || null,
      tee_time_interval_mins: parseInt(interval, 10),
      tournament_fee:         tournamentFee ? Math.round(parseFloat(tournamentFee) * 100) / 100 : null,
      venmo_handle:           venmoHandle.trim().replace(/^@/, '') || null,
      paypal_link:            paypalLink.trim() || null,
      zelle_handle:           zelleHandle.trim() || null,
      custom_questions:       customQuestions.filter(q => q.label.trim()),
      custom_competitions:    customCompetitions.filter(c => c.trim()),
      schedule_items:         scheduleItems.filter(s => s.label.trim()),
      shotgun_start:          shotgunStart,
      holes_played:           holesPlayed,
      use_handicaps:          useHandicaps,
      status:                 'upcoming',
    })
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Event created'); onSaved() }
  }

  return (
    <Modal open={open} onClose={onClose} title={`New Event — ${league?.name ?? ''}`} maxWidth="max-w-lg">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Event #" type="number" min="1" value={eventNum} onChange={e => setEventNum(e.target.value)} required />
          <Input label="Date" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
        </div>
        <Input label="Event Name (optional)" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. Spring Opener, Member-Guest…" />
        <div>
          <label className="label">Course</label>
          <select value={courseId} onChange={e => setCourseId(e.target.value)} className="input bg-white" required>
            <option value="">Select course…</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className={`bg-gray-50 rounded-xl px-4 py-3 ${!canUsePro ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                Number of Flights
                {!canUsePro && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Pro</span>}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Flight A = highest/best players. Leave at "No flights" for a single field.</div>
            </div>
            <select
              value={numFlights}
              onChange={e => canUsePro && setNumFlights(Number(e.target.value))}
              disabled={!canUsePro}
              className="input bg-white w-36"
            >
              <option value={0}>No flights</option>
              {Array.from({ length: 24 }, (_, i) => i + 2).map(n => (
                <option key={n} value={n}>{n} flights ({Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)).join(', ')})</option>
              ))}
            </select>
          </div>
        </div>

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

        <div>
          <label className="label">Scoring Formats</label>
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-3">
            {FORMAT_OPTIONS.map(group => (
              <div key={group.group}>
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">{group.group}</div>
                <div className="space-y-2">
                  {group.options.map(opt => {
                    const locked = opt.pro && !canUsePro
                    return (
                      <div key={opt.value} className={`flex items-center gap-2.5 ${locked ? 'opacity-50' : ''}`}>
                        <input type="checkbox" checked={formats.has(opt.value)}
                          onChange={() => !locked && toggleFormat(opt.value)}
                          disabled={locked} className="accent-fairway-600 w-4 h-4 shrink-0 cursor-pointer" />
                        <span className={`text-sm text-gray-800 ${locked ? '' : 'cursor-pointer'}`} onClick={() => !locked && toggleFormat(opt.value)}>{opt.label}</span>
                        {locked && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Pro</span>}
                        {formats.has(opt.value) && !locked && (
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
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {formats.size === 0 && <p className="text-xs text-red-500 mt-1">Select at least one format.</p>}
        </div>

        <div>
          <label className="label">Side Games / Competitions</label>
          <div className="space-y-3 bg-gray-50 rounded-xl px-4 py-3">
            {/* Per-flight eligible games */}
            {PER_FLIGHT_GAMES.map(opt => {
              const locked = opt.pro && !canUsePro
              const checked = sideGames.has(opt.key)
              const scope = gameScope[opt.key] ?? 'flight'
              const flightLetters = Array.from({ length: numFlights }, (_, i) => String.fromCharCode(65 + i))
              return (
                <div key={opt.key} className={locked ? 'opacity-50' : ''}>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={checked}
                      onChange={() => !locked && toggleSideGame(opt.key)}
                      disabled={locked} className="accent-fairway-600 w-4 h-4" />
                    <span className="text-sm text-gray-800">{opt.label}</span>
                    {locked && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Pro</span>}
                  </label>
                  {checked && numFlights > 0 && (
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
                </div>
              )
            })}
            {/* Always-group games */}
            {GROUP_GAMES.map(opt => {
              const locked = opt.pro && !canUsePro
              return (
                <label key={opt.key} className={`flex items-center gap-2.5 cursor-pointer ${locked ? 'opacity-50' : ''}`}>
                  <input type="checkbox" checked={sideGames.has(opt.key)}
                    onChange={() => !locked && toggleSideGame(opt.key)}
                    disabled={locked} className="accent-fairway-600 w-4 h-4" />
                  <span className="text-sm text-gray-800">{opt.label}</span>
                  {locked && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Pro</span>}
                </label>
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

        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          <Input label="Tee Interval (min)" type="number" min="1" max="60" value={interval} onChange={e => setInterval(e.target.value)} />
        </div>
        <Input label="Side Games / Competitions Entry Fee ($)" type="number" step="0.01" min="0" value={entryFee} onChange={e => setEntryFee(e.target.value)} required />
        <div>
          <label className="label">Payout Pot Based On</label>
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="payoutBasis" value="per_player" checked={payoutBasis === 'per_player'} onChange={() => setPayoutBasis('per_player')} className="accent-fairway-600" />
              <span className="text-sm text-gray-700">Attendance (entry fee × players)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="payoutBasis" value="fixed" checked={payoutBasis === 'fixed'} onChange={() => setPayoutBasis('fixed')} className="accent-fairway-600" />
              <span className="text-sm text-gray-700">Fixed total</span>
            </label>
          </div>
          {payoutBasis === 'fixed' && (
            <Input className="mt-2" label="Fixed Pot Total ($)" type="number" step="0.01" min="0" value={payoutFixed} onChange={e => setPayoutFixed(e.target.value)} placeholder="e.g. 500" />
          )}
        </div>
        <Input label="Tournament Entry Fee ($)" type="number" step="0.01" min="0" value={tournamentFee} onChange={e => setTournamentFee(e.target.value)} placeholder="e.g. 25.00 (shown on registration page)" />

        <div className="space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Links (optional)</div>
          <div>
            <label className="label">Venmo Handle</label>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-600">
              <span className="px-3 text-gray-400 text-sm border-r border-gray-300 bg-gray-50 py-2">@</span>
              <input
                type="text"
                value={venmoHandle}
                onChange={e => setVenmoHandle(e.target.value)}
                placeholder="your-venmo-username"
                className="flex-1 px-3 py-2 text-sm focus:outline-none bg-white"
              />
            </div>
          </div>
          <Input label="PayPal.me Link" value={paypalLink} onChange={e => setPaypalLink(e.target.value)} placeholder="https://paypal.me/yourhandle" />
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
                placeholder="Description (optional)"
                className="input text-sm"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setScheduleItems(prev => [...prev, { time: '', label: '', description: '' }])}
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

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Create Event</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── TGL Teams Modal ─────────────────────────────────────────────────────────
function TGLTeamsModal({ open, onClose, league }) {
  const [teams,       setTeams]       = useState([])
  const [members,     setMembers]     = useState([])
  const [allPlayers,  setAllPlayers]  = useState([])
  const [newName,     setNewName]     = useState('')
  const [newColor,    setNewColor]    = useState('#16a34a')
  const [rosterTeam,  setRosterTeam]  = useState(null)
  const [saving,      setSaving]      = useState(false)

  async function load() {
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('tgl_teams').select('*').eq('league_id', league.id).order('name'),
      supabase.from('players').select('id, first_name, last_name').order('first_name'),
    ])
    setTeams(t ?? [])
    setAllPlayers(p ?? [])
    if (t?.length) {
      const { data: m } = await supabase
        .from('tgl_team_members')
        .select('*, player:players(id, first_name, last_name)')
        .in('team_id', t.map(x => x.id))
      setMembers(m ?? [])
    }
  }

  useEffect(() => { if (open) load() }, [open])

  async function createTeam() {
    if (!newName.trim()) return
    setSaving(true)
    const { error } = await supabase.from('tgl_teams').insert({ league_id: league.id, name: newName.trim(), color: newColor })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setNewName(''); setNewColor('#16a34a')
    load()
  }

  async function deleteTeam(id) {
    if (!confirm('Delete this team and remove all its members?')) return
    await supabase.from('tgl_teams').delete().eq('id', id)
    load()
  }

  async function toggleMember(teamId, playerId) {
    const existing = members.find(m => m.team_id === teamId && m.player_id === playerId)
    if (existing) {
      await supabase.from('tgl_team_members').delete().eq('id', existing.id)
    } else {
      await supabase.from('tgl_team_members').insert({ team_id: teamId, player_id: playerId })
    }
    load()
  }

  const teamMemberIds = (teamId) => new Set(members.filter(m => m.team_id === teamId).map(m => m.player_id))

  return (
    <Modal open={open} onClose={onClose} title={`Team Play — ${league.name}`} maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input label="New Team Name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Just the Tips" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="h-9 w-14 rounded border border-gray-300 cursor-pointer" />
          </div>
          <Button onClick={createTeam} disabled={saving || !newName.trim()}>Add Team</Button>
        </div>

        {teams.length === 0 && (
          <p className="text-sm text-gray-400 italic text-center py-4">No teams yet. Add up to 4 teams above.</p>
        )}

        <div className="space-y-3">
          {teams.map(team => {
            const mIds = teamMemberIds(team.id)
            const teamMembers = members.filter(m => m.team_id === team.id)
            const expanded = rosterTeam === team.id
            return (
              <div key={team.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3" style={{ borderLeft: `4px solid ${team.color}` }}>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                    <span className="font-semibold text-gray-900">{team.name}</span>
                    <span className="text-xs text-gray-400">({teamMembers.length} members)</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setRosterTeam(expanded ? null : team.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      {expanded ? 'Hide Roster' : 'Edit Roster'}
                    </button>
                    <button onClick={() => deleteTeam(team.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>
                </div>
                {expanded && (
                  <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500 mb-2">Select season roster members:</p>
                    <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                      {allPlayers.map(p => (
                        <label key={p.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-white cursor-pointer text-sm">
                          <input type="checkbox" checked={mIds.has(p.id)} onChange={() => toggleMember(team.id, p.id)} className="rounded text-green-600 accent-green-600" />
                          <span className={mIds.has(p.id) ? 'font-medium text-gray-900' : 'text-gray-600'}>
                            {p.first_name} {p.last_name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  )
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

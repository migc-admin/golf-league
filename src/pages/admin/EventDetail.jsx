import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { computePayouts, DEFAULT_PAYOUT_CONFIG, CATEGORY_LABELS, ctpLabel, activePayoutKeys } from '../../lib/engines/payouts'
import { computeLeaderboards } from '../../lib/engines/scoring'
import { computeAllSkins } from '../../lib/engines/skins'
import { computeTGLEventResults } from '../../lib/engines/tgl'
import Card, { CardHeader } from '../../components/ui/Card'
import { ExportScorecardsButton } from '../../components/ScorecardExport'
import { useOrg, useFeatures } from '../../lib/OrgContext'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import Badge, { FlightBadge, StatusBadge } from '../../components/ui/Badge'
import ImageUpload from '../../components/ui/ImageUpload'

// Collapsed from 7 → 4 tabs: Players = Registrations + Players & Flights; Payout = Config + Side Games + Summary
const ALL_ADMIN_TABS = ['Overview', 'Players', 'Groups', 'Payout', 'TGL']


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
  const [activeTab,      setActiveTab]      = useState('Overview')

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
      supabase.from('players').select('*').order('last_name'),
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {event.league?.name} — {event.name ? event.name : `Event #${event.event_number}`}
            </h1>
            <StatusBadge status={event.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {event.course?.name} · {formatDate(event.event_date)} · Entry: ${event.entry_fee}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <Link to={`/${orgSlug}/${event.league?.slug}/${event.slug}/event?eid=${event.id}`} className="btn-secondary btn-sm btn">
            Event Page ↗
          </Link>
          <Link to={`/${orgSlug}/${event.league?.slug}/${event.slug}/schedule?eid=${event.id}`} className="btn-secondary btn-sm btn">
            Pairings ↗
          </Link>
          <Link to={`/${orgSlug}/${event.league?.slug}/${event.slug}/leaderboard?eid=${event.id}`} className="btn-secondary btn-sm btn">
            Leaderboard ↗
          </Link>
          <EventStatusControl event={event} onUpdated={load} />
        </div>
      </div>


      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {ALL_ADMIN_TABS.filter(tab => {
            if (tab === 'TGL') return hasFeature('tgl') && tglTeams.length > 0
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
        <TabOverview event={event} eventPlayers={eventPlayers} allScores={allScores} course={course} conflicts={conflicts} onUpdated={load} leagues={leagues} orgName={org?.name} orgSlug={orgSlug} />
      )}

      {activeTab === 'Players' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Registrations</h3>
            <TabRegistrations event={event} onUpdated={load} />
          </div>
          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Players &amp; Flights</h3>
            <TabFlights event={event} eventPlayers={eventPlayers} course={course} allPlayers={allPlayers} onUpdated={load} />
          </div>
        </div>
      )}

      {activeTab === 'Groups' && (
        <div className="space-y-6">
          <TabGroups event={event} eventPlayers={eventPlayers} onUpdated={load} />
          {((event.formats ?? (event.format ? [event.format] : [])).includes('match_points') ||
            (event.formats ?? (event.format ? [event.format] : [])).includes('ryder_cup')) && (
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Match Play Pairings</h3>
              <MatchPairingsManager eventId={event.id} eventPlayers={eventPlayers} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'Payout' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Payout Config</h3>
            <TabPayoutConfig event={event} eventPlayers={eventPlayers} course={course} onUpdated={load} />
          </div>
          {(event?.side_game_options ?? []).length > 0 && (
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Side Games</h3>
              <TabSideGames event={event} eventPlayers={eventPlayers} course={course} sideGames={sideGames} onUpdated={load} />
            </div>
          )}
          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Payout Summary</h3>
            <TabPayoutSummary event={event} eventPlayers={eventPlayers} allScores={allScores} sideGames={sideGames} course={course} />
          </div>
        </div>
      )}

      {activeTab === 'TGL' && (
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
    </div>
  )
}

// ─── Export Scores ────────────────────────────────────────────────
function exportScoresCSV(event, eventPlayers, allScores, course) {
  const headers = [
    'last_name', 'first_name', 'flight', 'group',
    'course_handicap',
    ...Array.from({ length: 18 }, (_, i) => `hole_${i + 1}_gross`),
    ...Array.from({ length: 18 }, (_, i) => `hole_${i + 1}_putts`),
    'total_gross', 'front_gross', 'back_gross',
    'total_putts',
  ]

  const scoreMap = {}
  for (const s of allScores) {
    if (!scoreMap[s.player_id]) scoreMap[s.player_id] = {}
    scoreMap[s.player_id][s.hole_number] = s
  }

  const rows = eventPlayers.map(ep => {
    const pScores = scoreMap[ep.player_id] ?? {}
    const grossArr = Array.from({ length: 18 }, (_, i) => pScores[i + 1]?.gross_score ?? '')
    const puttsArr = Array.from({ length: 18 }, (_, i) => pScores[i + 1]?.putts ?? '')
    const totalGross = grossArr.reduce((a, v) => a + (parseInt(v) || 0), 0)
    const frontGross = grossArr.slice(0, 9).reduce((a, v) => a + (parseInt(v) || 0), 0)
    const backGross  = grossArr.slice(9).reduce((a, v) => a + (parseInt(v) || 0), 0)
    const totalPutts = puttsArr.reduce((a, v) => a + (parseInt(v) || 0), 0)

    return [
      ep.player?.last_name ?? '',
      ep.player?.first_name ?? '',
      ep.flight ?? '',
      ep.group_number ?? '',
      ep.course_handicap ?? '',
      ...grossArr,
      ...puttsArr,
      totalGross || '',
      frontGross || '',
      backGross || '',
      totalPutts || '',
    ]
  })

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `event_${event.event_number}_scores.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Tab: Overview ────────────────────────────────────────────────
function TabOverview({ event, eventPlayers, allScores, course, conflicts, onUpdated, orgName, orgSlug }) {
  const [editModal,   setEditModal]   = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [scoreEditor, setScoreEditor] = useState(false)

  const holesEntered = new Set(allScores.map(s => `${s.player_id}-${s.hole_number}`)).size
  const nonGuests = eventPlayers.filter(e => !e.is_guest)
  const flightA = nonGuests.filter(e => e.flight === 'A').length
  const flightB = nonGuests.filter(e => e.flight === 'B').length

  // Scorecard link shown when event is active
  const scorecardUrl = `${window.location.origin}/${orgSlug}/${event.league?.slug}/${event.slug}/scorecard?eid=${event.id}`

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Card>
        <CardHeader
          title="Event Details"
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => exportScoresCSV(event, eventPlayers, allScores, course)}>
                ⬇ Export
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setScoreEditor(true)}>✎ Scores</Button>
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
          <Row label="Start Time"   value={event.start_time ? formatTime(event.start_time) : '—'} />
          <Row label="Tee Interval" value={`${event.tee_time_interval_mins ?? 10} min`} />
          <Row label="Entry Fee" value={`$${event.entry_fee}`} />
          {event.tournament_fee > 0 && <Row label="Tournament Entry Fee" value={`$${Number(event.tournament_fee).toFixed(2)}`} />}
          <Row label="Status"       value={<StatusBadge status={event.status} />} />
        </dl>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Players" />
          <dl className="space-y-2 text-sm">
            <Row label="Total Players"  value={`${nonGuests.length}${nonGuests.length !== eventPlayers.length ? ` + ${eventPlayers.length - nonGuests.length} guest${eventPlayers.length - nonGuests.length !== 1 ? 's' : ''}` : ''}`} />
            {(event.use_flights ?? false) && <Row label="Flight A" value={flightA} />}
            {(event.use_flights ?? false) && <Row label="Flight B" value={flightB} />}
            <Row label="Scores Entered" value={`${holesEntered} hole entries`} />
            <Row label="Total Pot"      value={`$${(event.entry_fee * nonGuests.length).toFixed(2)}`} />
          </dl>
        </Card>

        {/* Scoring Access — shown when active */}
        {event.status === 'active' && (
          <Card>
            <CardHeader title="Scoring Access" subtitle="Share with players to enter scores" />
            <AccessCodeSection event={event} eventPlayers={eventPlayers} onUpdated={onUpdated} orgSlug={orgSlug} />
            <div className="mt-3 pt-3 border-t border-gray-100">
              <ExportScorecardsButton event={event} eventPlayers={eventPlayers} course={course} orgName={event.league?.name ?? orgName} orgSlug={orgSlug} />
            </div>
          </Card>
        )}
      </div>

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
          <p className="text-xs text-red-500 mt-2">Use ✎ Scores to review and correct the final values.</p>
        </Card>
      )}

      <EditEventModal open={editModal} onClose={() => setEditModal(false)} event={event} onSaved={onUpdated} />
      <DeleteEventModal open={deleteModal} onClose={() => setDeleteModal(false)} event={event} />
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

// ─── Admin Score Editor ────────────────────────────────────────────
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
                      <div className="text-xs font-semibold truncate">{ep.player?.last_name}, {ep.player?.first_name}</div>
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
                          {holeGroup.map(h => <td key={h} className="px-2 py-1 text-center">{course.stroke_index[h-1]}</td>)}
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

// ─── Tab: Players & Flights ────────────────────────────────────────
function TabFlights({ event, eventPlayers, course, allPlayers, onUpdated }) {
  const [addModal, setAddModal] = useState(false)
  const [editingEp, setEditingEp] = useState(null) // ep being edited

  const rostered = new Set(eventPlayers.map(ep => ep.player_id))
  const available = allPlayers.filter(p => !rostered.has(p.id))

  async function overrideFlight(epId, newFlight) {
    const { error } = await supabase.from('event_players').update({ flight: newFlight }).eq('id', epId)
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

  const guests   = eventPlayers.filter(e => e.is_guest)
  const nonGuests = eventPlayers.filter(e => !e.is_guest)
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
      <div key={ep.id} className="flex items-center justify-between px-5 py-3">
        <div>
          <div className="font-medium text-sm text-gray-900">
            {ep.player?.last_name}, {ep.player?.first_name}
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
            <button
              onClick={() => setEditingEp(ep)}
              style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, padding: '1px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
            >Edit</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
              value={ep.flight ?? ''}
              onChange={e => overrideFlight(ep.id, e.target.value)}
              className="input py-1 text-xs w-24"
            >
              <option value="">—</option>
              <option value="A">Flight A</option>
              <option value="B">Flight B</option>
            </select>
          )}
          <button onClick={() => removePlayer(ep.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
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

      <div className="flex items-center gap-3">
        <Button onClick={() => setAddModal(true)} variant="secondary">+ Add Player to Event</Button>
        {eventPlayers.length > 0 && (
          <span className="text-sm text-gray-500">
            {useFlights
              ? `${nonGuests.length} players · Flight A: ${flightA.length} · Flight B: ${flightB.length}${guests.length > 0 ? ` · ${guests.length} guest${guests.length !== 1 ? 's' : ''}` : ''}`
              : `${nonGuests.length} player${nonGuests.length !== 1 ? 's' : ''}${guests.length > 0 ? ` · ${guests.length} guest${guests.length !== 1 ? 's' : ''}` : ''}`
            }
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
                  <div className="font-medium text-sm text-gray-900">{ep.player?.last_name}, {ep.player?.first_name}</div>
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
        ['A', 'B'].map(flight => {
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
        })
      ) : (
        /* No flights — single flat roster */
        eventPlayers.length > 0 && (
          <Card className="overflow-hidden p-0">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-semibold text-gray-700">Players ({eventPlayers.length})</span>
            </div>
            <div className="divide-y divide-gray-100">
              {eventPlayers.map(ep => renderPlayerRow(ep))}
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
        onSaved={onUpdated}
      />
    </div>
  )
}

function AddPlayerModal({ open, onClose, eventId, available, course, useFlights, onSaved }) {
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

                      {/* HI / CH fields — hidden for guest */}
                      {vals.flight !== 'guest' && (
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
function MatchPairingsManager({ eventId, eventPlayers }) {
  const [pairings,    setPairings]    = useState([])
  const [playerAId,   setPlayerAId]   = useState('')
  const [playerBId,   setPlayerBId]   = useState('')
  const [matchNumber, setMatchNumber] = useState(1)
  const [saving,      setSaving]      = useState(false)

  async function loadPairings() {
    const { data } = await supabase
      .from('match_pairings')
      .select('*, playerA:players!player_a_id(first_name,last_name), playerB:players!player_b_id(first_name,last_name)')
      .eq('event_id', eventId)
      .order('match_number')
    setPairings(data ?? [])
  }

  useEffect(() => { loadPairings() }, [eventId])

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
      event_id:    eventId,
      player_a_id: playerAId,
      player_b_id: playerBId,
      match_number: matchNumber,
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
    await loadPairings()
  }

  function playerName(ep) {
    return `${ep.player?.last_name ?? ''}, ${ep.player?.first_name ?? ''} (CH: ${ep.course_handicap ?? '—'})`
  }

  return (
    <div className="space-y-4">
      {/* Current pairings */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Current Match Pairings</h3>
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
      {unpairedPlayers.length >= 2 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Add Pairing</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Player A</label>
                <select
                  className="input w-full"
                  value={playerAId}
                  onChange={e => setPlayerAId(e.target.value)}
                >
                  <option value="">Select player…</option>
                  {unpairedPlayers
                    .filter(ep => ep.player_id !== playerBId)
                    .map(ep => (
                      <option key={ep.player_id} value={ep.player_id}>{playerName(ep)}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Player B</label>
                <select
                  className="input w-full"
                  value={playerBId}
                  onChange={e => setPlayerBId(e.target.value)}
                >
                  <option value="">Select player…</option>
                  {unpairedPlayers
                    .filter(ep => ep.player_id !== playerAId)
                    .map(ep => (
                      <option key={ep.player_id} value={ep.player_id}>{playerName(ep)}</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Match #</label>
                <input
                  type="number"
                  min="1"
                  className="input w-24"
                  value={matchNumber}
                  onChange={e => setMatchNumber(parseInt(e.target.value, 10) || 1)}
                />
              </div>
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

function TabGroups({ event, eventPlayers, onUpdated }) {
  const ungrouped = eventPlayers.filter(ep => !ep.group_number)
  const maxGroup  = Math.max(0, ...eventPlayers.map(ep => ep.group_number ?? 0))

  // Local order state: { [epId]: orderIndex }
  const [localOrder, setLocalOrder] = useState(() => {
    const init = {}
    const byGroup = {}
    for (const ep of eventPlayers) {
      if (!ep.group_number) continue
      if (!byGroup[ep.group_number]) byGroup[ep.group_number] = []
      byGroup[ep.group_number].push(ep)
    }
    for (const members of Object.values(byGroup)) {
      members.sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0))
      members.forEach((ep, i) => { init[ep.id] = i })
    }
    return init
  })

  // Sorted members for a given group number
  function groupMembers(g) {
    return eventPlayers
      .filter(ep => ep.group_number === parseInt(g, 10))
      .sort((a, b) => (localOrder[a.id] ?? 0) - (localOrder[b.id] ?? 0))
  }

  async function movePlayer(epId, groupNum, direction) {
    const members = groupMembers(groupNum)
    const idx = members.findIndex(m => m.id === epId)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= members.length) return

    const a = members[idx]
    const b = members[swapIdx]
    const newOrder = { ...localOrder, [a.id]: swapIdx, [b.id]: idx }
    setLocalOrder(newOrder)

    // Persist — requires group_order column (run migration if not yet done)
    await Promise.all([
      supabase.from('event_players').update({ group_order: swapIdx }).eq('id', a.id),
      supabase.from('event_players').update({ group_order: idx }).eq('id', b.id),
    ])
  }

  async function setGroup(epId, group) {
    const { error } = await supabase.from('event_players').update({ group_number: group || null }).eq('id', epId)
    if (error) { toast.error(error.message); return }

    if (group) {
      const members = eventPlayers.filter(ep => ep.group_number === parseInt(group, 10))
      const hasScorekeeper = members.some(ep => ep.is_scorekeeper)
      if (!hasScorekeeper) {
        await supabase.from('event_players').update({ is_scorekeeper: true }).eq('id', epId)
      }
    }

    onUpdated()
  }

  async function toggleScorekeeper(ep) {
    const { error } = await supabase.from('event_players')
      .update({ is_scorekeeper: !ep.is_scorekeeper })
      .eq('id', ep.id)
    if (error) toast.error(error.message)
    else onUpdated()
  }

  const groupNums = [...new Set(eventPlayers.map(ep => ep.group_number).filter(Boolean))].sort((a,b) => a - b)

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Assign players to groups (2–4 per group). Use the arrows to reorder players within a group. Mark one player per group as scorekeeper.
      </p>

      {ungrouped.length > 0 && (
        <Card>
          <CardHeader title="Ungrouped Players" subtitle="Assign these players to a group" />
          <div className="space-y-2">
            {ungrouped.map(ep => (
              <GroupRow key={ep.id} ep={ep} maxGroup={maxGroup} onSetGroup={setGroup} onToggleSK={toggleScorekeeper} />
            ))}
          </div>
        </Card>
      )}

      {groupNums.map(g => {
        const members = groupMembers(g)
        return (
          <Card key={g}>
            <CardHeader title={`Group ${g}`} subtitle={`${members.length} player${members.length !== 1 ? 's' : ''}`} />
            <div className="divide-y divide-gray-100">
              {members.map((ep, i) => (
                <GroupRow
                  key={ep.id}
                  ep={ep}
                  maxGroup={maxGroup}
                  isFirst={i === 0}
                  isLast={i === members.length - 1}
                  onSetGroup={setGroup}
                  onToggleSK={toggleScorekeeper}
                  onMove={dir => movePlayer(ep.id, g, dir)}
                />
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function GroupRow({ ep, maxGroup, isFirst, isLast, onSetGroup, onToggleSK, onMove }) {
  const groupOptions = Array.from({ length: Math.max(maxGroup + 1, 5) }, (_, i) => i + 1)

  return (
    <div className="flex items-center justify-between py-2 px-1">
      <div className="flex items-center gap-2">
        {/* Up/down only shown when inside a group */}
        {onMove && (
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => onMove(-1)}
              disabled={isFirst}
              className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none px-1"
              title="Move up"
            >▲</button>
            <button
              onClick={() => onMove(1)}
              disabled={isLast}
              className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none px-1"
              title="Move down"
            >▼</button>
          </div>
        )}
        <span className="text-sm font-medium text-gray-900">
          {ep.player?.last_name}, {ep.player?.first_name}
        </span>
        {ep.flight && <FlightBadge flight={ep.flight} />}
        {ep.is_scorekeeper && <Badge variant="green">Scorekeeper</Badge>}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={ep.group_number ?? ''}
          onChange={e => onSetGroup(ep.id, e.target.value)}
          className="input py-1 text-xs w-24"
        >
          <option value="">None</option>
          {groupOptions.map(g => <option key={g} value={g}>Group {g}</option>)}
        </select>
        <button
          onClick={() => onToggleSK(ep)}
          className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
            ep.is_scorekeeper
              ? 'bg-fairway-100 text-fairway-700 hover:bg-fairway-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {ep.is_scorekeeper ? '✓ Scorekeeper' : 'Set SK'}
        </button>
      </div>
    </div>
  )
}

// ─── Tab: Payout Config ───────────────────────────────────────────
function TabPayoutConfig({ event, eventPlayers, course, onUpdated }) {
  const [config,         setConfig]         = useState({})
  const [saving,         setSaving]         = useState(false)
  const [ctpHoles,       setCtpHoles]       = useState([])   // array of hole numbers
  const [ctpInput,       setCtpInput]       = useState('')
  const [longDriveHole,  setLongDriveHole]  = useState(event.long_drive_hole ?? '')
  const [payoutBasis,    setPayoutBasis]    = useState(event.payout_basis ?? 'per_player')
  const [fixedTotal,     setFixedTotal]     = useState(event.payout_fixed_total ?? '')

  const nonGuestPlayers = eventPlayers.filter(e => !e.is_guest)
  const flightA = nonGuestPlayers.filter(e => e.flight === 'A').length
  const flightB = nonGuestPlayers.filter(e => e.flight === 'B').length
  const totalPlayers = nonGuestPlayers.length

  // Active keys driven by event's formats + side_game_options + use_flights
  const eventActiveKeys = activePayoutKeys(event)

  const hasCtp      = (event.side_game_options ?? []).includes('ctp')
  const hasLongDrive = (event.side_game_options ?? []).some(s => s.startsWith('long_drive'))

  // Rebuild config whenever event setup changes (formats, sides, use_flights)
  const eventConfigKey = [
    event.id,
    (event.formats ?? []).join(','),
    (event.side_game_options ?? []).join(','),
    String(event.use_flights),
  ].join('|')

  useEffect(() => {
    const existingConfig = event.payout_config ?? {}

    // CTP holes only loaded when CTP is selected
    const existingCtpHoles = hasCtp
      ? Object.keys(existingConfig)
          .filter(k => k.startsWith('ctp_'))
          .map(k => parseInt(k.replace('ctp_', ''), 10))
          .sort((a, b) => a - b)
      : []
    setCtpHoles(existingCtpHoles)

    // Build config from active keys only — no extra keys shown
    const keys = activePayoutKeys(event)
    const next = {}
    for (const k of keys) {
      next[k] = existingConfig[k] ?? DEFAULT_PAYOUT_CONFIG[k] ?? 0
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

  const useFlights = event.use_flights ?? false

  function getMultiplier(key) {
    if (key === 'low_putts' || key.startsWith('ctp_')) return totalPlayers
    if (key === 'skins' || key === 'long_drive') return totalPlayers
    if (key === 'skins_b' || key.includes('_b_') || key === 'long_drive_b') return flightB
    // No-flight net scoring keys (no _a_ or _b_ in name) → full field
    if (!useFlights && (key.startsWith('18_net_') || key.startsWith('f9_') || key.startsWith('b9_'))) return totalPlayers
    return flightA
  }

  const totalPot = payoutBasis === 'fixed'
    ? (parseFloat(fixedTotal) || 0)
    : event.entry_fee * totalPlayers

  const totalAllocated = Object.entries(config).reduce((sum, [k, v]) => sum + ((v || 0) * getMultiplier(k)), 0)
  const overBudget     = totalAllocated > totalPot

  const rows = Object.entries(config).map(([key, val]) => {
    const isField   = key === 'low_putts' || key.startsWith('ctp_') || key === 'skins' || key === 'long_drive'
                   || (!useFlights && (key.startsWith('18_net_') || key.startsWith('f9_') || key.startsWith('b9_')))
    const isFlightB = !isField && (key === 'skins_b' || key.includes('_b_') || key === 'long_drive_b')
    const isFlightA = !isField && !isFlightB
    const mult  = getMultiplier(key)
    const total = (val || 0) * mult
    const label = key.startsWith('ctp_')
      ? ctpLabel(parseInt(key.replace('ctp_', ''), 10))
      : (CATEGORY_LABELS[key] ?? key)
    return { key, val, label, isField, isFlightA, isFlightB, mult, total }
  })

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="text-sm text-gray-600 space-y-0.5">
        {useFlights
          ? <p>Flight A: <strong>{flightA}</strong> · Flight B: <strong>{flightB}</strong> · Total: <strong>{totalPlayers} players</strong> · Pot: <strong className="tabular-nums">${totalPot.toFixed(2)}</strong></p>
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

      {/* CTP hole assignment — only when CTP is selected */}
      {/* Long Drive hole — only when Long Drive is selected */}
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

      {/* Flight A — only shown when flights are on and there are A-specific rows */}
      {useFlights && rows.some(r => r.isFlightA) && (
        <Card className="overflow-hidden p-0">
          <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100">
            <h3 className="text-xs font-semibold text-blue-700">Flight A ({flightA} players)</h3>
          </div>
          <PayoutTable rows={rows.filter(r => r.isFlightA)} onChange={setVal} colLabel="$ per player (Flt A)" />
        </Card>
      )}

      {/* Flight B — only shown when flights are on and there are B-specific rows */}
      {useFlights && rows.some(r => r.isFlightB) && (
        <Card className="overflow-hidden p-0">
          <div className="px-4 py-2.5 bg-purple-50 border-b border-purple-100">
            <h3 className="text-xs font-semibold text-purple-700">Flight B ({flightB} players)</h3>
          </div>
          <PayoutTable rows={rows.filter(r => r.isFlightB)} onChange={setVal} colLabel="$ per player (Flt B)" />
        </Card>
      )}

      {/* Full field — scoring results (no flights) + side games + CTP */}
      {rows.some(r => r.isField) && (
        <Card className="overflow-hidden p-0">
          <div className="px-4 py-2.5 bg-green-50 border-b border-green-100">
            <h3 className="text-xs font-semibold text-green-700">
              {useFlights ? 'Full Field — Side Games & CTP' : 'All Players'} ({totalPlayers} players)
            </h3>
          </div>
          <PayoutTable rows={rows.filter(r => r.isField)} onChange={setVal} colLabel="$ per player (All)" />
        </Card>
      )}

      {/* Save — at bottom after all config is filled out */}
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
    </table>
  )
}

// ─── Tab: Side Games ──────────────────────────────────────────────
function TabSideGames({ event, eventPlayers, course, sideGames, onUpdated }) {
  // Only show CTP holes that were explicitly configured in Payout Config
  const ctpConfigHoles = Object.keys(event.payout_config ?? {})
    .filter(k => k.startsWith('ctp_'))
    .map(k => parseInt(k.replace('ctp_', ''), 10))
    .sort((a, b) => a - b)

  // Fallback to all par-3s if no CTP holes configured yet
  const par3Holes = ctpConfigHoles.length > 0
    ? ctpConfigHoles.map(h => ({ hole: h }))
    : course
      ? course.par_per_hole.map((p, i) => ({ hole: i+1 })).filter((_, i) => course.par_per_hole[i] === 3)
      : []

  const flightA = eventPlayers.filter(ep => ep.flight === 'A')
  const flightB = eventPlayers.filter(ep => ep.flight === 'B')

  async function setWinner(gameType, holeNumber, playerId, flight) {
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
    return sideGames.find(g =>
      g.game_type === gameType
      && g.hole_number === (holeNumber ?? null)
      && (flight ? g.flight === flight : true)
    )?.winner_player_id ?? ''
  }

  const sides      = event.side_game_options ?? []
  const useFlights = event.use_flights ?? false
  const hasLdA     = sides.includes('long_drive_a')
  const hasLdB     = sides.includes('long_drive_b')
  const hasLd      = sides.includes('long_drive')
  const hasCtp     = sides.includes('ctp')

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
      {hasCtp && par3Holes.length > 0 && (
        <Card>
          <CardHeader title="Closest to Pin" subtitle="One winner per par-3 hole" />
          <div className="space-y-3">
            {par3Holes.map(h => (
              <div key={h.hole} className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 w-16">Hole {h.hole}</span>
                <SideGameSelect
                  players={eventPlayers}
                  value={getWinner('ctp', h.hole)}
                  onChange={v => setWinner('ctp', h.hole, v, 'overall')}
                />
              </div>
            ))}
          </div>
        </Card>
      )}
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
      <option value="">— No winner yet —</option>
      {players.map(ep => (
        <option key={ep.player_id} value={ep.player_id}>
          {ep.player?.last_name}, {ep.player?.first_name}
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
  const flightCounts  = { A: nonGuestEPs.filter(ep => ep.flight === 'A').length, B: nonGuestEPs.filter(ep => ep.flight === 'B').length }
  const leaderboards  = computeLeaderboards(nonGuestEPs, allScores, course)
  const skinsResults  = computeAllSkins(nonGuestEPs, allScores, course.stroke_index)
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
const EDIT_FORMAT_OPTIONS = [
  { group: 'Net Stroke Play', options: [
    { value: 'net_stroke',        label: '18-Hole Overall Net' },
    { value: 'net_stroke_front9', label: 'Front Nine Net' },
    { value: 'net_stroke_back9',  label: 'Back Nine Net' },
  ]},
  { group: 'Other Formats', options: [
    { value: 'stableford',   label: 'Stableford' },
    { value: 'match_points', label: 'Match Play Points' },
    { value: 'ryder_cup',    label: 'Ryder Cup' },
  ]},
]

const EDIT_SIDE_GAME_OPTIONS = [
  { key: 'skins',         label: 'Skins',                  flightsOff: true,  flightsOn: false },
  { key: 'skins_a',       label: 'Skins — Flight A',       flightsOff: false, flightsOn: true  },
  { key: 'skins_b',       label: 'Skins — Flight B',       flightsOff: false, flightsOn: true  },
  { key: 'long_drive',    label: 'Long Drive',             flightsOff: true,  flightsOn: false },
  { key: 'long_drive_a',  label: 'Long Drive — Flight A',  flightsOff: false, flightsOn: true  },
  { key: 'long_drive_b',  label: 'Long Drive — Flight B',  flightsOff: false, flightsOn: true  },
  { key: 'low_putts',     label: 'Low Putts',              flightsOff: true,  flightsOn: true  },
  { key: 'ctp',           label: 'Closest to Pin (par 3s)',flightsOff: true,  flightsOn: true  },
  { key: 'track_putts',   label: 'Track Putts on Scorecard',flightsOff: true, flightsOn: true  },
]

function EditEventModal({ open, onClose, event, onSaved }) {
  const [eventDate,     setEventDate]     = useState('')
  const [eventName,     setEventName]     = useState('')
  const [eventNumber,   setEventNumber]   = useState('')
  const [entryFee,      setEntryFee]      = useState('')
  const [tournamentFee, setTournamentFee] = useState('')
  const [startTime,   setStartTime]   = useState('')
  const [interval,    setInterval]    = useState(10)
  const [formats,     setFormats]     = useState(new Set(['net_stroke']))
  const [sideGames,   setSideGames]   = useState(new Set())
  const [useFlights,  setUseFlights]  = useState(false)
  const [payoutBasis, setPayoutBasis] = useState('per_player')
  const [payoutFixed, setPayoutFixed] = useState('')
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    if (event && open) {
      setEventDate(event.event_date ?? '')
      setEventName(event.name ?? '')
      setEventNumber(event.event_number ?? '')
      setEntryFee(event.entry_fee ?? '')
      setTournamentFee(event.tournament_fee ?? '')
      setStartTime(event.start_time ? event.start_time.slice(0, 5) : '')
      setInterval(event.tee_time_interval_mins ?? 10)
      setFormats(new Set(event.formats?.length ? event.formats : [event.format ?? 'net_stroke']))
      setSideGames(new Set(event.side_game_options ?? []))
      setUseFlights(event.use_flights ?? false)
      setPayoutBasis(event.payout_basis ?? 'per_player')
      setPayoutFixed(event.payout_fixed_total ?? '')
    }
  }, [event, open])

  function toggleFormat(key) {
    setFormats(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function toggleSideGame(key) {
    setSideGames(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (formats.size === 0) return
    setSaving(true)
    const formatsArr = [...formats]
    const { error } = await supabase.from('events')
      .update({
        event_date:             eventDate,
        name:                   eventName.trim() || null,
        event_number:           parseInt(eventNumber, 10),
        entry_fee:              parseFloat(entryFee),
        tournament_fee:         tournamentFee !== '' ? parseFloat(tournamentFee) : null,
        start_time:             startTime || null,
        tee_time_interval_mins: parseInt(interval, 10),
        format:                 formatsArr[0],
        formats:                formatsArr,
        side_game_options:      [...sideGames],
        use_flights:            useFlights,
        payout_basis:           payoutBasis,
        payout_fixed_total:     payoutBasis === 'fixed' ? parseFloat(payoutFixed) || 0 : null,
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
        <div className="grid grid-cols-2 gap-4">
          <Input label="Event Name (optional)" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. Spring Opener…" />
          <Input label="Event #" type="number" min="1" value={eventNumber} onChange={e => setEventNumber(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Entry Fee ($)" type="number" step="0.01" min="0" value={entryFee} onChange={e => setEntryFee(e.target.value)} required />
          <Input label="Tournament Entry Fee ($)" type="number" step="0.01" min="0" value={tournamentFee} onChange={e => setTournamentFee(e.target.value)} placeholder="Charged at registration" />
        </div>
        <p className="text-xs text-gray-400 -mt-2">Entry Fee drives payouts. Tournament Entry Fee is what players pay to register.</p>

        {/* Use Flights toggle */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-800">Use Flights (A &amp; B)?</div>
            <div className="text-xs text-gray-400 mt-0.5">Enable if splitting players into two competitive flights</div>
          </div>
          <button
            type="button"
            onClick={() => setUseFlights(v => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${useFlights ? 'bg-fairway-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${useFlights ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Scoring Formats */}
        <div>
          <label className="label">Scoring Formats</label>
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-3">
            {EDIT_FORMAT_OPTIONS.map(group => (
              <div key={group.group}>
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">{group.group}</div>
                <div className="space-y-1.5">
                  {group.options.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={formats.has(opt.value)} onChange={() => toggleFormat(opt.value)} className="accent-fairway-600 w-4 h-4" />
                      <span className="text-sm text-gray-800">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {formats.size === 0 && <p className="text-xs text-red-500 mt-1">Select at least one format.</p>}
        </div>

        {/* Side Games */}
        <div>
          <label className="label">Side Games / Competitions</label>
          <div className="space-y-1.5 bg-gray-50 rounded-xl px-4 py-3">
            {EDIT_SIDE_GAME_OPTIONS
              .filter(opt => useFlights ? opt.flightsOn : opt.flightsOff)
              .map(opt => (
                <label key={opt.key} className="flex items-center gap-2.5 py-0.5 cursor-pointer">
                  <input type="checkbox" checked={sideGames.has(opt.key)} onChange={() => toggleSideGame(opt.key)} className="accent-fairway-600 w-4 h-4" />
                  <span className="text-sm text-gray-800">{opt.label}</span>
                </label>
              ))
            }
          </div>
        </div>

        <Input label="Tee Interval (min)" type="number" min="1" max="60" value={interval} onChange={e => setInterval(e.target.value)} />

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
function TabRegistrations({ event, onUpdated }) {
  const [regs,    setRegs]    = useState([])
  const [loading, setLoading] = useState(true)

  const regUrl = `${window.location.origin}/register/${event.id}`

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
        .insert({ first_name: reg.first_name, last_name: reg.last_name, email: reg.email ?? null, handicap_index: reg.handicap_index ?? 0 })
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

  const pending   = regs.filter(r => r.status === 'pending')
  const confirmed = regs.filter(r => r.status === 'confirmed')
  const cancelled = regs.filter(r => r.status === 'cancelled')

  const STATUS_COLORS = {
    pending:   'bg-amber-100 text-amber-700',
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  }

  function RegRow({ reg }) {
    return (
      <div className="flex items-start justify-between py-3 gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {reg.first_name} {reg.last_name}
            {reg.flight && <span className="ml-2 text-xs text-gray-400">Flight {reg.flight}</span>}
          </p>
          <p className="text-xs text-gray-500">
            {reg.email && <span className="mr-3">{reg.email}</span>}
            {reg.handicap_index != null && <span>HI: {reg.handicap_index}</span>}
          </p>
          {reg.notes && <p className="text-xs text-gray-400 italic mt-0.5">"{reg.notes}"</p>}
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(reg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[reg.status]}`}>
            {reg.status}
          </span>
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
        {!event.venmo_handle && (
          <p className="text-xs text-amber-600 px-4 pb-3">
            ⚠ No Venmo handle set on this event — players won't see a payment button. Add one in Event Settings.
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
              <CardHeader title={`Confirmed (${confirmed.length})`} />
              <div className="divide-y divide-gray-100 px-4">{confirmed.map(r => <RegRow key={r.id} reg={r} />)}</div>
            </Card>
          )}

          {cancelled.length > 0 && (
            <Card>
              <CardHeader title={`Cancelled (${cancelled.length})`} />
              <div className="divide-y divide-gray-100 px-4">{cancelled.map(r => <RegRow key={r.id} reg={r} />)}</div>
            </Card>
          )}
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
  net_stroke:   'Net Stroke Play',
  stableford:   'Stableford',
  match_points: 'Match Play Points',
  ryder_cup:    'Ryder Cup',
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
      const ranked = lb.net?.ranked ?? lb.gross?.ranked ?? []
      if (!ranked.length) return null
      // Attach player info to ranked entries
      const epMap = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep]))
      const rankedWithPlayer = ranked.map(r => ({
        ...r,
        player: epMap[r.player_id]?.player ?? null,
      }))
      return computeTGLEventResults(rankedWithPlayer, tglSelections, tglTeams, tglMembers)
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
            <h3 className="text-sm font-semibold text-gray-800">TGL Teams</h3>
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
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Event TGL Scores</span>
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
        <Modal open={showTeamModal} title="New TGL Team" onClose={() => setShowTeamModal(false)}>
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

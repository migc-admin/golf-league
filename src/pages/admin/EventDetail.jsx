import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { computePayouts, DEFAULT_PAYOUT_CONFIG, CATEGORY_LABELS, ctpLabel } from '../../lib/engines/payouts'
import { computeLeaderboards } from '../../lib/engines/scoring'
import { computeAllSkins } from '../../lib/engines/skins'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import Badge, { FlightBadge, StatusBadge } from '../../components/ui/Badge'

const TABS = ['Overview', 'Players & Flights', 'Groups', 'Payout Config', 'Side Games', 'Payout Summary']

export default function EventDetail() {
  const { id } = useParams()
  const [event,        setEvent]        = useState(null)
  const [eventPlayers, setEventPlayers] = useState([])
  const [allScores,    setAllScores]    = useState([])
  const [sideGames,    setSideGames]    = useState([])
  const [course,       setCourse]       = useState(null)
  const [leagues,      setLeagues]      = useState([])
  const [allPlayers,   setAllPlayers]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState('Overview')

  const load = useCallback(async () => {
    const [
      { data: ev },
      { data: eps },
      { data: sc },
      { data: sg },
      { data: allP },
    ] = await Promise.all([
      supabase.from('events').select('*, league:leagues(*), course:courses(*)').eq('id', id).single(),
      supabase.from('event_players').select('*, player:players(*)').eq('event_id', id).order('flight').order('adjusted_handicap_index'),
      supabase.from('scores').select('*').eq('event_id', id),
      supabase.from('side_games').select('*, winner:players(first_name,last_name)').eq('event_id', id),
      supabase.from('players').select('*').order('last_name'),
    ])

    setEvent(ev)
    setEventPlayers(eps ?? [])
    setAllScores(sc ?? [])
    setSideGames(sg ?? [])
    setCourse(ev?.course ?? null)
    setAllPlayers(allP ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-10 w-64 bg-gray-200 rounded" /><div className="h-48 bg-gray-200 rounded-xl" /></div>
  if (!event)  return <p className="text-gray-500">Event not found.</p>

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 flex items-center gap-1.5">
        <Link to="/admin" className="hover:text-gray-700">Dashboard</Link>
        <span>/</span>
        <Link to="/admin/leagues" className="hover:text-gray-700">Leagues</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Event #{event.event_number}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {event.league?.name} — Event #{event.event_number}
            </h1>
            <StatusBadge status={event.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {event.course?.name} · {formatDate(event.event_date)} · Entry: ${event.entry_fee}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to={`/schedule/${event.id}`} className="btn-secondary btn-sm btn">
            Pairings ↗
          </Link>
          <Link to={`/leaderboard/${event.id}`} className="btn-secondary btn-sm btn">
            Leaderboard ↗
          </Link>
          <EventStatusControl event={event} onUpdated={load} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
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
      {activeTab === 'Overview'        && <TabOverview event={event} eventPlayers={eventPlayers} allScores={allScores} course={course} onUpdated={load} leagues={leagues} />}
      {activeTab === 'Players & Flights' && <TabFlights event={event} eventPlayers={eventPlayers} course={course} allPlayers={allPlayers} onUpdated={load} />}
      {activeTab === 'Groups'          && <TabGroups  event={event} eventPlayers={eventPlayers} onUpdated={load} />}
      {activeTab === 'Payout Config'   && <TabPayoutConfig event={event} eventPlayers={eventPlayers} course={course} onUpdated={load} />}
      {activeTab === 'Side Games'      && <TabSideGames event={event} eventPlayers={eventPlayers} course={course} sideGames={sideGames} onUpdated={load} />}
      {activeTab === 'Payout Summary'  && <TabPayoutSummary event={event} eventPlayers={eventPlayers} allScores={allScores} sideGames={sideGames} course={course} />}
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
function TabOverview({ event, eventPlayers, allScores, course, onUpdated }) {
  const [editModal,   setEditModal]   = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)

  const holesEntered = new Set(allScores.map(s => `${s.player_id}-${s.hole_number}`)).size
  const flightA = eventPlayers.filter(e => e.flight === 'A').length
  const flightB = eventPlayers.filter(e => e.flight === 'B').length

  // Scorecard link shown when event is active
  const scorecardUrl = `${window.location.origin}/scorecard/${event.id}`

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Card>
        <CardHeader
          title="Event Details"
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => exportScoresCSV(event, eventPlayers, allScores, course)}>
                ⬇ Export Scores
              </Button>
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
          <Row label="Entry Fee"    value={`$${event.entry_fee}`} />
          <Row label="Status"       value={<StatusBadge status={event.status} />} />
        </dl>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Players" />
          <dl className="space-y-2 text-sm">
            <Row label="Total Players"  value={eventPlayers.length} />
            <Row label="Flight A"       value={flightA} />
            <Row label="Flight B"       value={flightB} />
            <Row label="Scores Entered" value={`${holesEntered} hole entries`} />
            <Row label="Total Pot"      value={`$${(event.entry_fee * eventPlayers.length).toFixed(2)}`} />
          </dl>
        </Card>

        {/* Scorecard link — shown when active */}
        {event.status === 'active' && (
          <Card>
            <CardHeader title="Scorecard Link" subtitle="Share with scorekeepers to enter scores" />
            <div className="flex items-center gap-2 mt-1">
              <input
                readOnly
                value={scorecardUrl}
                className="input text-xs flex-1 bg-gray-50"
                onFocus={e => e.target.select()}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(scorecardUrl)
                  toast.success('Link copied!')
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Scorekeepers must have an account and be assigned to a group to enter scores.
            </p>
          </Card>
        )}
      </div>

      <EditEventModal open={editModal} onClose={() => setEditModal(false)} event={event} onSaved={onUpdated} />
      <DeleteEventModal open={deleteModal} onClose={() => setDeleteModal(false)} event={event} />
    </div>
  )
}

// ─── Tab: Players & Flights ────────────────────────────────────────
function TabFlights({ event, eventPlayers, course, allPlayers, onUpdated }) {
  const [addModal, setAddModal] = useState(false)

  const rostered = new Set(eventPlayers.map(ep => ep.player_id))
  const available = allPlayers.filter(p => !rostered.has(p.id))

  async function overrideFlight(epId, newFlight) {
    const { error } = await supabase.from('event_players').update({ flight: newFlight }).eq('id', epId)
    if (error) toast.error(error.message)
    else onUpdated()
  }

  async function removePlayer(epId) {
    if (!confirm('Remove player from this event?')) return
    const { error } = await supabase.from('event_players').delete().eq('id', epId)
    if (error) toast.error(error.message)
    else { toast.success('Player removed'); onUpdated() }
  }

  const flightA = eventPlayers.filter(e => e.flight === 'A')
  const flightB = eventPlayers.filter(e => e.flight === 'B')
  const unassigned = eventPlayers.filter(e => !e.flight)

  const courseTees = course?.tees ?? []

  async function saveTeeAssignment(field, value) {
    const { error } = await supabase.from('events').update({ [field]: value || null }).eq('id', event.id)
    if (error) toast.error(error.message)
    else onUpdated()
  }

  return (
    <div className="space-y-4">
      {/* Tee Assignment per Flight */}
      {courseTees.length > 0 && (
        <Card>
          <CardHeader title="Tee Assignment" subtitle="Which tees each flight plays from" />
          <div className="grid sm:grid-cols-2 gap-4 mt-1">
            {['A', 'B'].map(flight => {
              const field = `tee_flight_${flight.toLowerCase()}`
              const current = event[field] ?? ''
              return (
                <div key={flight}>
                  <label className="label">Flight {flight} Tee</label>
                  <select
                    value={current}
                    onChange={e => saveTeeAssignment(field, e.target.value)}
                    className="input bg-white"
                  >
                    <option value="">— Not assigned —</option>
                    {courseTees.map(t => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.color}) — Slope {t.slope} / Rating {t.rating}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={() => setAddModal(true)} variant="secondary">+ Add Player to Event</Button>
        {eventPlayers.length > 0 && (
          <span className="text-sm text-gray-500">
            {eventPlayers.length} players · Flight A: {flightA.length} · Flight B: {flightB.length}
          </span>
        )}
      </div>

      {unassigned.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
          {unassigned.length} player{unassigned.length !== 1 ? 's' : ''} not yet assigned to a flight. Use the dropdown to assign flights manually.
        </div>
      )}

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
              {list.map(ep => (
                <div key={ep.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {ep.player?.last_name}, {ep.player?.first_name}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                      <span>HI: {ep.handicap_index}</span>
                      {ep.adjusted_handicap_index != null && ep.adjusted_handicap_index !== ep.handicap_index && (
                        <span className="text-orange-600">Adj: {ep.adjusted_handicap_index}</span>
                      )}
                      {ep.course_handicap != null && <span>CH: {ep.course_handicap}</span>}
                      {ep.tournament_wins_prior > 0 && (
                        <span className="text-fairway-700 font-medium">{ep.tournament_wins_prior} win{ep.tournament_wins_prior !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={ep.flight ?? ''}
                      onChange={e => overrideFlight(ep.id, e.target.value)}
                      className="input py-1 text-xs w-24"
                    >
                      <option value="">—</option>
                      <option value="A">Flight A</option>
                      <option value="B">Flight B</option>
                    </select>
                    <button onClick={() => removePlayer(ep.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      })}

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
        onSaved={onUpdated}
      />
    </div>
  )
}

function AddPlayerModal({ open, onClose, eventId, available, course, onSaved }) {
  // bulk: { [playerId]: { hi, flight, checked } }
  const [bulk,    setBulk]    = useState({})
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (!open) { setBulk({}) }
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
    available.forEach(p => { next[p.id] = bulk[p.id] ?? { hi: '', flight: '', autoHC: true, ch: '' } })
    setBulk(next)
  }

  function clearAll() { setBulk({}) }

  const selected = Object.entries(bulk)
  const allValid = selected.length > 0 && selected.every(([, v]) =>
    v.hi !== '' && !isNaN(parseFloat(v.hi)) &&
    (v.autoHC || (v.ch !== '' && !isNaN(parseInt(v.ch, 10))))
  )

  async function handleSave(e) {
    e.preventDefault()
    if (!allValid) return
    setSaving(true)

    for (const [playerId, { hi, flight, autoHC, ch }] of selected) {
      const hiVal = parseFloat(hi)
      let course_handicap = null
      if (autoHC && course) {
        const { slope, rating, par } = course
        course_handicap = Math.round((hiVal * slope / 113) + (rating - par))
      } else if (!autoHC && ch !== '') {
        course_handicap = parseInt(ch, 10)
      }
      await supabase.from('event_players').insert({
        event_id:                eventId,
        player_id:               playerId,
        handicap_index:          hiVal,
        adjusted_handicap_index: hiVal,
        course_handicap,
        flight:                  flight || null,
      })
    }

    setSaving(false)
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
          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
            {available.map(p => {
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
                      <input
                        type="number" step="0.1" min="-10" max="54"
                        value={vals.hi}
                        onChange={e => setField(p.id, 'hi', e.target.value)}
                        placeholder="HI"
                        className="input py-1 text-xs w-16 shrink-0"
                        required
                      />
                      <select
                        value={vals.flight}
                        onChange={e => setField(p.id, 'flight', e.target.value)}
                        className="input py-1 text-xs w-20 shrink-0 bg-white"
                      >
                        <option value="">Flight?</option>
                        <option value="A">Flight A</option>
                        <option value="B">Flight B</option>
                      </select>
                      {/* Course handicap: auto or manual */}
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
                </div>
              )
            })}
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
function TabGroups({ event, eventPlayers, onUpdated }) {
  const groups = groupBy(eventPlayers, 'group_number')
  const ungrouped = eventPlayers.filter(ep => !ep.group_number)
  const maxGroup = Math.max(0, ...eventPlayers.map(ep => ep.group_number ?? 0))

  async function setGroup(epId, group) {
    const { error } = await supabase.from('event_players').update({ group_number: group || null }).eq('id', epId)
    if (error) { toast.error(error.message); return }

    // If assigning to a group, auto-set as scorekeeper if none exists in that group yet
    if (group) {
      const groupMembers = eventPlayers.filter(ep => ep.group_number === parseInt(group, 10))
      const hasScorekeeper = groupMembers.some(ep => ep.is_scorekeeper)
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Assign players to groups (2–4 per group). Mark one player per group as scorekeeper — they will enter scores for the group.
      </p>

      {/* Ungrouped */}
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

      {/* Groups */}
      {Object.entries(groups).sort(([a],[b]) => parseInt(a)-parseInt(b)).map(([g, members]) => (
        <Card key={g}>
          <CardHeader title={`Group ${g}`} subtitle={`${members.length} player${members.length !== 1 ? 's' : ''}`} />
          <div className="space-y-2">
            {members.map(ep => (
              <GroupRow key={ep.id} ep={ep} maxGroup={maxGroup} onSetGroup={setGroup} onToggleSK={toggleScorekeeper} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

function GroupRow({ ep, maxGroup, onSetGroup, onToggleSK }) {
  const groupOptions = Array.from({ length: Math.max(maxGroup + 1, 5) }, (_, i) => i + 1)

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-3">
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
  const [config, setConfig] = useState({})
  const [saving, setSaving] = useState(false)

  const flightA = eventPlayers.filter(e => e.flight === 'A').length
  const flightB = eventPlayers.filter(e => e.flight === 'B').length

  const par3Holes = course
    ? course.par_per_hole.map((p, i) => ({ hole: i+1, par: p })).filter(h => h.par === 3)
    : []

  useEffect(() => {
    const base = { ...DEFAULT_PAYOUT_CONFIG }
    // CTP keys are per-flight: ctp_5_a, ctp_5_b
    par3Holes.forEach(h => {
      base[`ctp_${h.hole}_a`] = 0
      base[`ctp_${h.hole}_b`] = 0
    })
    const merged = { ...base, ...(event.payout_config ?? {}) }
    setConfig(merged)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id])

  function setVal(key, val) {
    setConfig(c => ({ ...c, [key]: parseFloat(val) || 0 }))
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('events').update({ payout_config: config }).eq('id', event.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Payout config saved'); onUpdated() }
  }

  function getMultiplier(key) {
    const isB = key.endsWith('_b') || key.includes('_b_') || key === 'skins_b'
    return isB ? flightB : flightA
  }

  const totalAllocated = Object.entries(config).reduce((sum, [k, v]) => sum + ((v || 0) * getMultiplier(k)), 0)
  const totalPot       = event.entry_fee * eventPlayers.length
  const overBudget     = totalAllocated > totalPot

  const rows = Object.entries(config).map(([key, val]) => {
    const isFlightB = key.endsWith('_b') || key.includes('_b_') || key === 'skins_b'
    const mult  = getMultiplier(key)
    const total = (val || 0) * mult
    const label = key.startsWith('ctp_')
      ? (() => { const parts = key.split('_'); return ctpLabel(parseInt(parts[1], 10), parts[2]?.toUpperCase()) })()
      : (CATEGORY_LABELS[key] ?? key)
    return { key, val, label, isFlightB, mult, total }
  })

  const rowsA = rows.filter(r => !r.isFlightB)
  const rowsB = rows.filter(r =>  r.isFlightB)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-gray-600 space-y-0.5">
          <p>Flight A: <strong>{flightA} players</strong> · Flight B: <strong>{flightB} players</strong> · Total Pot: <strong>${totalPot.toFixed(2)}</strong></p>
          <p className={overBudget ? 'text-red-600 font-medium' : 'text-fairway-700 font-medium'}>
            Total Allocated: ${totalAllocated.toFixed(2)}{overBudget ? ' — exceeds pot!' : ` of $${totalPot.toFixed(2)}`}
          </p>
        </div>
        <Button onClick={handleSave} loading={saving}>Save Config</Button>
      </div>

      <p className="text-xs text-gray-500">
        All values are <strong>$ per player</strong> in that flight — total = amount × players in flight.
      </p>

      {/* Flight A categories */}
      <Card className="overflow-hidden p-0">
        <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100">
          <h3 className="text-xs font-semibold text-blue-700">Flight A ({flightA} players)</h3>
        </div>
        <PayoutTable rows={rowsA} onChange={setVal} flightLabel="A" />
      </Card>

      {/* Flight B categories */}
      <Card className="overflow-hidden p-0">
        <div className="px-4 py-2.5 bg-purple-50 border-b border-purple-100">
          <h3 className="text-xs font-semibold text-purple-700">Flight B ({flightB} players)</h3>
        </div>
        <PayoutTable rows={rowsB} onChange={setVal} flightLabel="B" />
      </Card>
    </div>
  )
}

function PayoutTable({ rows, onChange, flightLabel }) {
  if (rows.length === 0) return <p className="px-4 py-3 text-xs text-gray-400">None</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs font-semibold text-gray-400 border-b border-gray-100">
          <th className="px-4 py-2">Category</th>
          <th className="px-3 py-2 w-32">$ per player (Flt {flightLabel})</th>
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
            <td className="px-3 py-2 text-xs text-gray-400">× {mult}</td>
            <td className="px-3 py-2 text-xs font-semibold text-gray-800 text-right">${total.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Tab: Side Games ──────────────────────────────────────────────
function TabSideGames({ event, eventPlayers, course, sideGames, onUpdated }) {
  const par3Holes = course
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Enter manual side game winners. Low putts can be auto-calculated from scores.</p>

      {/* Long Drive — separate A/B */}
      <Card>
        <CardHeader title="Long Drive" />
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-blue-600 w-16">Flight A</span>
            <SideGameSelect
              players={flightA.length ? flightA : eventPlayers}
              value={getWinner('long_drive', null, 'A')}
              onChange={v => setWinner('long_drive', null, v, 'A')}
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-purple-600 w-16">Flight B</span>
            <SideGameSelect
              players={flightB.length ? flightB : eventPlayers}
              value={getWinner('long_drive', null, 'B')}
              onChange={v => setWinner('long_drive', null, v, 'B')}
            />
          </div>
        </div>
      </Card>

      {/* CTP per par-3 */}
      {par3Holes.length > 0 && (
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

  const flightCounts  = { A: eventPlayers.filter(ep => ep.flight === 'A').length, B: eventPlayers.filter(ep => ep.flight === 'B').length }
  const leaderboards  = computeLeaderboards(eventPlayers, allScores, course)
  const skinsResults  = computeAllSkins(eventPlayers, allScores, course.stroke_index)
  const { totalPot, byCategory, byPlayer, totalAllocated } = computePayouts(
    event, eventPlayers.length, leaderboards, sideGames, skinsResults, flightCounts
  )

  const playerMap = Object.fromEntries(
    eventPlayers.map(ep => [ep.player_id, ep.player])
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-gray-900">Total Pot: ${totalPot.toFixed(2)}</p>
          <p className="text-sm text-gray-500">{eventPlayers.length} players × ${event.entry_fee}</p>
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
function EditEventModal({ open, onClose, event, onSaved }) {
  const [eventDate, setEventDate] = useState('')
  const [entryFee,  setEntryFee]  = useState('')
  const [format,    setFormat]    = useState('net_stroke')
  const [startTime, setStartTime] = useState('')
  const [interval,  setInterval]  = useState(10)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (event && open) {
      setEventDate(event.event_date ?? '')
      setEntryFee(event.entry_fee)
      setFormat(event.format ?? 'net_stroke')
      setStartTime(event.start_time ? event.start_time.slice(0, 5) : '')
      setInterval(event.tee_time_interval_mins ?? 10)
    }
  }, [event, open])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('events')
      .update({
        event_date:             eventDate,
        entry_fee:              parseFloat(entryFee),
        format,
        start_time:             startTime || null,
        tee_time_interval_mins: parseInt(interval, 10),
      })
      .eq('id', event.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Event updated'); onSaved(); onClose() }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Event">
      <form onSubmit={handleSave} className="space-y-4">
        <Input
          label="Event Date"
          type="date"
          value={eventDate}
          onChange={e => setEventDate(e.target.value)}
          required
        />
        <div>
          <label className="label">Format</label>
          <select value={format} onChange={e => setFormat(e.target.value)} className="input bg-white">
            <option value="net_stroke">Net Stroke Play</option>
            <option value="stableford">Stableford</option>
            <option value="match_points">Match Play Points</option>
            <option value="ryder_cup">Ryder Cup</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Time"
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
          />
          <Input
            label="Tee Interval (min)"
            type="number" min="1" max="60"
            value={interval}
            onChange={e => setInterval(e.target.value)}
          />
        </div>
        <Input label="Entry Fee ($)" type="number" step="0.01" min="0" value={entryFee} onChange={e => setEntryFee(e.target.value)} required />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save</Button>
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

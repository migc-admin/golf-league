import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import { StatusBadge } from '../../components/ui/Badge'

const CURRENT_YEAR = new Date().getFullYear()

export default function Leagues() {
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)
  const [leagueModal, setLeagueModal] = useState(false)
  const [editingLeague, setEditingLeague] = useState(null)
  const [eventModal, setEventModal] = useState(false)
  const [eventLeague, setEventLeague] = useState(null)

  async function load() {
    const { data } = await supabase
      .from('leagues')
      .select(`
        id, name, season_year, created_at,
        events(id, event_number, event_date, status, course:courses(name))
      `)
      .order('season_year', { ascending: false })
    setLeagues(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreateLeague()  { setEditingLeague(null); setLeagueModal(true) }
  function openEditLeague(l)   { setEditingLeague(l);    setLeagueModal(true) }
  function openCreateEvent(l)  { setEventLeague(l);      setEventModal(true)  }

  async function handleDeleteLeague(id) {
    if (!confirm('Delete this league? All events and earnings will be deleted.')) return
    const { error } = await supabase.from('leagues').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('League deleted'); load() }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leagues</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage leagues and their events</p>
        </div>
        <Button onClick={openCreateLeague}>+ New League</Button>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[0,1].map(i => <div key={i} className="h-40 bg-gray-200 rounded-xl" />)}
        </div>
      ) : leagues.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-4xl mb-3">🏌️</div>
          <p className="text-gray-500 font-medium">No leagues yet</p>
          <Button className="mt-4" onClick={openCreateLeague}>Create First League</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {leagues.map(league => {
            const events = [...(league.events ?? [])].sort((a,b) => b.event_number - a.event_number)
            return (
              <Card key={league.id} className="overflow-hidden p-0">
                {/* League header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div>
                    <div className="font-bold text-gray-900 text-base">{league.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Season {league.season_year} · {events.length} event{events.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={`/standings/${league.id}`} className="btn btn-secondary btn-sm">Standings</Link>
                    <Button size="sm" onClick={() => openCreateEvent(league)}>+ Event</Button>
                    <Button size="sm" variant="secondary" onClick={() => openEditLeague(league)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDeleteLeague(league.id)}>Delete</Button>
                  </div>
                </div>

                {/* Events list */}
                {events.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-gray-400">
                    No events yet. <button onClick={() => openCreateEvent(league)} className="text-fairway-700 hover:underline font-medium">Add first event →</button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {events.map(ev => (
                      <Link
                        key={ev.id}
                        to={`/admin/events/${ev.id}`}
                        className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <span className="text-sm font-medium text-gray-900">Event #{ev.event_number}</span>
                          <span className="text-xs text-gray-500 ml-3">{ev.course?.name}</span>
                          <span className="text-xs text-gray-400 ml-3">{formatDate(ev.event_date)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/leaderboard/${ev.id}`}
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-fairway-700 hover:underline"
                          >
                            Leaderboard
                          </Link>
                          <StatusBadge status={ev.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <LeagueModal
        open={leagueModal}
        onClose={() => setLeagueModal(false)}
        editing={editingLeague}
        onSaved={() => { setLeagueModal(false); load() }}
      />
      <EventModal
        open={eventModal}
        onClose={() => setEventModal(false)}
        league={eventLeague}
        onSaved={() => { setEventModal(false); load() }}
      />
    </div>
  )
}

function LeagueModal({ open, onClose, editing, onSaved }) {
  const [name, setName] = useState('')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) { setName(editing.name); setYear(editing.season_year) }
    else         { setName('');           setYear(CURRENT_YEAR) }
  }, [editing, open])

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { error } = editing
      ? await supabase.from('leagues').update({ name: name.trim(), season_year: +year }).eq('id', editing.id)
      : await supabase.from('leagues').insert({ name: name.trim(), season_year: +year })
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success(editing ? 'League updated' : 'League created'); onSaved() }
  }

  const years = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i)
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit League' : 'New League'}>
      <form onSubmit={handleSave} className="space-y-4">
        <Input label="League Name" value={name} onChange={e => setName(e.target.value)} placeholder="Tuesday Evening League" required />
        <Select label="Season Year" value={year} onChange={e => setYear(e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{editing ? 'Save' : 'Create League'}</Button>
        </div>
      </form>
    </Modal>
  )
}

const SIDE_GAME_OPTIONS = [
  { key: 'skins_a',    label: 'Skins — Flight A' },
  { key: 'skins_b',    label: 'Skins — Flight B' },
  { key: 'long_drive', label: 'Long Drive (A & B)' },
  { key: 'low_putts',  label: 'Low Putts' },
  { key: 'ctp',        label: 'Closest to Pin (par 3s)' },
]

function EventModal({ open, onClose, league, onSaved }) {
  const [courses,    setCourses]    = useState([])
  const [courseId,   setCourseId]   = useState('')
  const [eventDate,  setEventDate]  = useState('')
  const [eventNum,   setEventNum]   = useState(1)
  const [entryFee,   setEntryFee]   = useState('20')
  const [format,     setFormat]     = useState('net_stroke')
  const [sideGames,  setSideGames]  = useState(new Set())
  const [startTime,  setStartTime]  = useState('')
  const [interval,   setInterval]   = useState(10)
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.from('courses').select('id, name').order('name').then(({ data }) => setCourses(data ?? []))
    if (league) {
      supabase.from('events').select('event_number').eq('league_id', league.id).order('event_number', { ascending: false }).limit(1)
        .then(({ data }) => setEventNum(data?.[0]?.event_number ? data[0].event_number + 1 : 1))
    }
    setEventDate('')
    setCourseId('')
    setEntryFee('20')
    setFormat('net_stroke')
    setSideGames(new Set())
    setStartTime('')
    setInterval(10)
  }, [open, league])

  function toggleSideGame(key) {
    setSideGames(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!courseId || !eventDate) return
    setSaving(true)
    const { error } = await supabase.from('events').insert({
      league_id:              league.id,
      course_id:              courseId,
      event_date:             eventDate,
      event_number:           parseInt(eventNum, 10),
      entry_fee:              parseFloat(entryFee),
      format,
      side_game_options:      [...sideGames],
      start_time:             startTime || null,
      tee_time_interval_mins: parseInt(interval, 10),
      status:                 'upcoming',
    })
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Event created'); onSaved() }
  }

  const FORMAT_OPTIONS = [
    { group: 'Net Stroke Play', options: [
      { value: 'net_stroke',       label: '18-Hole Overall Net' },
      { value: 'net_stroke_front9', label: 'Front Nine Net' },
      { value: 'net_stroke_back9',  label: 'Back Nine Net' },
    ]},
    { group: 'Other Formats', options: [
      { value: 'stableford',   label: 'Stableford' },
      { value: 'match_points', label: 'Match Play Points' },
      { value: 'ryder_cup',    label: 'Ryder Cup' },
    ]},
  ]

  return (
    <Modal open={open} onClose={onClose} title={`New Event — ${league?.name ?? ''}`} maxWidth="max-w-lg">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Event #" type="number" min="1" value={eventNum} onChange={e => setEventNum(e.target.value)} required />
          <Input label="Date" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
        </div>
        <div>
          <label className="label">Course</label>
          <select value={courseId} onChange={e => setCourseId(e.target.value)} className="input bg-white" required>
            <option value="">Select course…</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Primary Format */}
        <div>
          <label className="label">Primary Format</label>
          <div className="space-y-1.5">
            {FORMAT_OPTIONS.map(group => (
              <div key={group.group}>
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{group.group}</div>
                {group.options.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2.5 py-1 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value={opt.value}
                      checked={format === opt.value}
                      onChange={() => setFormat(opt.value)}
                      className="accent-fairway-600"
                    />
                    <span className="text-sm text-gray-800">{opt.label}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Side Games */}
        <div>
          <label className="label">Side Games / Competitions</label>
          <div className="space-y-1.5 bg-gray-50 rounded-xl px-4 py-3">
            {SIDE_GAME_OPTIONS.map(opt => (
              <label key={opt.key} className="flex items-center gap-2.5 py-0.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sideGames.has(opt.key)}
                  onChange={() => toggleSideGame(opt.key)}
                  className="accent-fairway-600 w-4 h-4"
                />
                <span className="text-sm text-gray-800">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          <Input label="Tee Interval (min)" type="number" min="1" max="60" value={interval} onChange={e => setInterval(e.target.value)} />
        </div>
        <Input label="Entry Fee ($)" type="number" step="0.01" min="0" value={entryFee} onChange={e => setEntryFee(e.target.value)} required />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Create Event</Button>
        </div>
      </form>
    </Modal>
  )
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

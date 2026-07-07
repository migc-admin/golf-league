import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import { StatusBadge } from '../../components/ui/Badge'
import ImageUpload from '../../components/ui/ImageUpload'

const CURRENT_YEAR = new Date().getFullYear()

export default function Leagues() {
  const { user } = useAuth()
  const [leagues,      setLeagues]      = useState([])
  const [orgSlug,      setOrgSlug]      = useState(null)
  const [orgId,        setOrgId]        = useState(null)
  const [orgLogoUrl,   setOrgLogoUrl]   = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [leagueModal,  setLeagueModal]  = useState(false)
  const [editingLeague,setEditingLeague]= useState(null)
  const [eventModal,   setEventModal]   = useState(false)
  const [eventLeague,  setEventLeague]  = useState(null)
  const [tglModal,     setTglModal]     = useState(false)
  const [tglLeague,    setTglLeague]    = useState(null)

  async function load() {
    const { data } = await supabase
      .from('leagues')
      .select(`
        id, name, slug, season_year, created_at,
        events(id, event_number, slug, event_date, status, course:courses(name))
      `)
      .order('season_year', { ascending: false })
    setLeagues(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    async function fetchOrgSlug() {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('org_id').eq('id', user.id).single()
      if (profile?.org_id) {
        const { data: org } = await supabase
          .from('organizations').select('id, slug, logo_url').eq('id', profile.org_id).single()
        if (org?.slug)     setOrgSlug(org.slug)
        if (org?.id)       setOrgId(org.id)
        if (org?.logo_url) setOrgLogoUrl(org.logo_url)
      }
    }
    fetchOrgSlug()
  }, [user])

  function openCreateLeague()  { setEditingLeague(null); setLeagueModal(true) }
  function openEditLeague(l)   { setEditingLeague(l);    setLeagueModal(true) }
  function openCreateEvent(l)  { setEventLeague(l);      setEventModal(true)  }
  function openTGL(l)          { setTglLeague(l);        setTglModal(true)    }

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

      <div className="flex items-center gap-4 mb-2">
        <ImageUpload
          shape="circle"
          path={`orgs/${orgSlug}/logo`}
          currentUrl={orgLogoUrl}
          onUploaded={async (url) => {
            setOrgLogoUrl(url)
            await supabase.from('organizations').update({ logo_url: url }).eq('id', orgId)
          }}
          label="Org Logo"
        />
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
                    <Link to={`/${orgSlug}/${league.slug}/standings`} className="btn btn-secondary btn-sm">Standings</Link>
                    <Button size="sm" variant="secondary" onClick={() => openTGL(league)}>TGL Teams</Button>
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
                        to={`/admin/${orgSlug}/${league.slug}/${ev.slug}`}
                        className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <span className="text-sm font-medium text-gray-900">Event #{ev.event_number}</span>
                          <span className="text-xs text-gray-500 ml-3">{ev.course?.name}</span>
                          <span className="text-xs text-gray-400 ml-3">{formatDate(ev.event_date)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/${orgSlug}/${league.slug}/${ev.slug}/leaderboard`}
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
        orgId={orgId}
        orgSlug={orgSlug}
        onSaved={() => { setLeagueModal(false); load() }}
      />
      <EventModal
        open={eventModal}
        onClose={() => setEventModal(false)}
        league={eventLeague}
        onSaved={() => { setEventModal(false); load() }}
      />
      {tglModal && tglLeague && (
        <TGLTeamsModal
          open={tglModal}
          onClose={() => { setTglModal(false); setTglLeague(null) }}
          league={tglLeague}
        />
      )}
    </div>
  )
}

function LeagueModal({ open, onClose, editing, orgId, orgSlug, onSaved }) {
  const [name,    setName]    = useState('')
  const [year,    setYear]    = useState(CURRENT_YEAR)
  const [logoUrl, setLogoUrl] = useState('')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (editing) { setName(editing.name); setYear(editing.season_year); setLogoUrl(editing.logo_url ?? '') }
    else         { setName('');           setYear(CURRENT_YEAR);        setLogoUrl('') }
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
      ? await supabase.from('leagues').update({ name: name.trim(), season_year: +year, logo_url: logoUrl || null }).eq('id', editing.id)
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
          label="League Logo (optional)"
        />
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
  { key: 'skins',         label: 'Skins',                flightsOff: true,  flightsOn: false },
  { key: 'skins_a',       label: 'Skins — Flight A',     flightsOff: false, flightsOn: true  },
  { key: 'skins_b',       label: 'Skins — Flight B',     flightsOff: false, flightsOn: true  },
  { key: 'long_drive',    label: 'Long Drive',           flightsOff: true,  flightsOn: false },
  { key: 'long_drive_a',  label: 'Long Drive — Flight A',flightsOff: false, flightsOn: true  },
  { key: 'long_drive_b',  label: 'Long Drive — Flight B',flightsOff: false, flightsOn: true  },
  { key: 'low_putts',     label: 'Low Putts',            flightsOff: true,  flightsOn: true  },
  { key: 'ctp',           label: 'Closest to Pin (par 3s)', flightsOff: true, flightsOn: true },
  { key: 'track_putts',   label: 'Track Putts on Scorecard', flightsOff: true, flightsOn: true },
]

const FORMAT_OPTIONS = [
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

function EventModal({ open, onClose, league, onSaved }) {
  const [courses,      setCourses]      = useState([])
  const [courseId,     setCourseId]     = useState('')
  const [eventDate,    setEventDate]    = useState('')
  const [eventNum,     setEventNum]     = useState(1)
  const [eventName,    setEventName]    = useState('')
  const [entryFee,     setEntryFee]     = useState('20')
  const [payoutBasis,  setPayoutBasis]  = useState('per_player')
  const [payoutFixed,  setPayoutFixed]  = useState('')
  const [formats,      setFormats]      = useState(new Set(['net_stroke']))
  const [sideGames,    setSideGames]    = useState(new Set())
  const [useFlights,   setUseFlights]   = useState(false)
  const [startTime,    setStartTime]    = useState('')
  const [interval,     setInterval]     = useState(10)
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.from('courses').select('id, name').order('name').then(({ data }) => setCourses(data ?? []))
    if (league) {
      supabase.from('events').select('event_number').eq('league_id', league.id).order('event_number', { ascending: false }).limit(1)
        .then(({ data }) => setEventNum(data?.[0]?.event_number ? data[0].event_number + 1 : 1))
    }
    setEventDate('')
    setCourseId('')
    setEventName('')
    setEntryFee('20')
    setPayoutBasis('per_player')
    setPayoutFixed('')
    setFormats(new Set(['net_stroke']))
    setSideGames(new Set())
    setUseFlights(false)
    setStartTime('')
    setInterval(10)
  }, [open, league])

  function toggleFormat(key) {
    setFormats(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleSideGame(key) {
    setSideGames(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
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
      entry_fee:              parseFloat(entryFee),
      payout_basis:           payoutBasis,
      payout_fixed_total:     payoutBasis === 'fixed' ? parseFloat(payoutFixed) || 0 : null,
      format:                 formatsArr[0],
      formats:                formatsArr,
      use_flights:            useFlights,
      side_game_options:      [...sideGames],
      start_time:             startTime || null,
      tee_time_interval_mins: parseInt(interval, 10),
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

        {/* Flights toggle */}
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

        {/* Formats — multi-select checkboxes */}
        <div>
          <label className="label">Scoring Formats</label>
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-3">
            {FORMAT_OPTIONS.map(group => (
              <div key={group.group}>
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">{group.group}</div>
                <div className="space-y-1.5">
                  {group.options.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formats.has(opt.value)}
                        onChange={() => toggleFormat(opt.value)}
                        className="accent-fairway-600 w-4 h-4"
                      />
                      <span className="text-sm text-gray-800">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {formats.size === 0 && (
            <p className="text-xs text-red-500 mt-1">Select at least one format.</p>
          )}
        </div>

        {/* Side Games */}
        <div>
          <label className="label">Side Games / Competitions</label>
          <div className="space-y-1.5 bg-gray-50 rounded-xl px-4 py-3">
            {SIDE_GAME_OPTIONS
              .filter(opt => useFlights ? opt.flightsOn : opt.flightsOff)
              .map(opt => (
                <label key={opt.key} className="flex items-center gap-2.5 py-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sideGames.has(opt.key)}
                    onChange={() => toggleSideGame(opt.key)}
                    className="accent-fairway-600 w-4 h-4"
                  />
                  <span className="text-sm text-gray-800">{opt.label}</span>
                </label>
              ))
            }
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          <Input label="Tee Interval (min)" type="number" min="1" max="60" value={interval} onChange={e => setInterval(e.target.value)} />
        </div>
        <Input label="Entry Fee ($)" type="number" step="0.01" min="0" value={entryFee} onChange={e => setEntryFee(e.target.value)} required />
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
      supabase.from('players').select('id, first_name, last_name').order('last_name'),
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
    setNewName('')
    setNewColor('#16a34a')
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
    <Modal open={open} onClose={onClose} title={`TGL Teams — ${league.name}`} maxWidth="max-w-2xl">
      <div className="space-y-5">
        {/* Create new team */}
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

        {/* Team list */}
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
                    <button
                      onClick={() => setRosterTeam(expanded ? null : team.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
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
                          <input
                            type="checkbox"
                            checked={mIds.has(p.id)}
                            onChange={() => toggleMember(team.id, p.id)}
                            className="rounded text-green-600 accent-green-600"
                          />
                          <span className={mIds.has(p.id) ? 'font-medium text-gray-900' : 'text-gray-600'}>
                            {p.last_name}, {p.first_name}
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

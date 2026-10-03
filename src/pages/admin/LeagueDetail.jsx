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
  return <LeagueDetailView leagueSlug={leagueSlug} />
}

export function LeagueDetailView({ leagueSlug, containerLabel = 'League', roundLabel = 'Event', hideSeasonYear = false, backTo = '/admin/leagues', backLabel = 'All Leagues', hideHeader = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [league,       setLeague]       = useState(null)
  const [events,       setEvents]       = useState([])
  const [orgSlug,      setOrgSlug]      = useState(null)
  const [orgId,        setOrgId]        = useState(null)
  const [orgTier,      setOrgTier]      = useState('free')
  const [loading,      setLoading]      = useState(true)
  const [leagueModal,  setLeagueModal]  = useState(false)
  const [tglModal,     setTglModal]     = useState(false)
  const [deleteModal,  setDeleteModal]  = useState(false)

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
        .select('id, name, slug, season_year, logo_url, team_play_label, standings_config')
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
    const { error } = await supabase.from('leagues').delete().eq('id', league.id)
    if (error) toast.error(error.message)
    else { toast.success('League deleted'); navigate('/admin/leagues') }
  }

  async function refreshLeague() {
    const { data: lg } = await supabase
      .from('leagues').select('id, name, slug, season_year, logo_url, team_play_label, standings_config').eq('id', league.id).single()
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
      {!hideHeader && (
        <div>
          <Link to={backTo} className="text-sm text-ink-muted hover:text-ink">← {backLabel}</Link>
        </div>
      )}

      {/* League header card */}
      <div className="card overflow-hidden p-0">
        {hideHeader ? (
          <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-4" style={{ borderBottom: '1px solid #ebe9e4' }}>
            <div>
              <h2 className="text-lg font-bold text-ink" style={{ letterSpacing: '-0.02em' }}>{roundLabel}s</h2>
              <p className="text-sm text-ink-muted mt-0.5">
                {events.length} {roundLabel.toLowerCase()}{events.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
              <Link to={`/admin/leagues/${leagueSlug}/new-event`} className="btn btn-primary btn-sm">+ {roundLabel}</Link>
              <Link to={`/${orgSlug}/${league.slug}/standings`} className="btn btn-secondary btn-sm">Standings</Link>
              {checkFeature(orgTier, 'tgl') ? (
                <Button size="sm" variant="secondary" onClick={() => setTglModal(true)}>{league.team_play_label || 'Team Play'}</Button>
              ) : (
                <span className="text-xs text-ink-muted rounded-full px-3 py-1" style={{ background: '#eceae5' }}>Team Play — Club</span>
              )}
            </div>
          </div>
        ) : (
        <div className="flex items-start gap-5 px-5 py-5" style={{ borderBottom: '1px solid #ebe9e4' }}>
          {/* Logo upload — Club tier only */}
          <div className="shrink-0">
            {checkFeature(orgTier ?? 'free', 'custom_branding') ? (
              <ImageUpload
                shape="circle"
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
            <p className="text-sm text-ink-muted mt-0.5">
              {!hideSeasonYear && <>Season {league.season_year} · </>}
              {events.length} {roundLabel.toLowerCase()}{events.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
            <Link to={`/admin/leagues/${leagueSlug}/new-event`} className="btn btn-primary btn-sm">+ {roundLabel}</Link>
            <Button size="sm" variant="secondary" onClick={() => setLeagueModal(true)}>Edit League</Button>
            <Link to={`/${orgSlug}/${league.slug}/standings`} className="btn btn-secondary btn-sm">Standings</Link>
            {checkFeature(orgTier, 'tgl') ? (
              <Button size="sm" variant="secondary" onClick={() => setTglModal(true)}>{league.team_play_label || 'Team Play'}</Button>
            ) : (
              <span className="text-xs text-ink-muted rounded-full px-3 py-1" style={{ background: '#eceae5' }}>Team Play — Club</span>
            )}
            <Button size="sm" variant="danger" onClick={() => setDeleteModal(true)}>Delete</Button>
          </div>
        </div>
        )}

        {/* Events list */}
        {events.length === 0 ? (
          <div className="px-5 py-6 text-sm text-ink-muted">
            No {roundLabel.toLowerCase()}s yet. <Link to={`/admin/leagues/${leagueSlug}/new-event`} className="text-fairway-700 hover:underline font-semibold">Add first {roundLabel.toLowerCase()} →</Link>
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
                    <StatusBadge status={ev.status} />
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Standings Settings */}
      <StandingsSettings league={league} onSaved={refreshLeague} />

      <LeagueModal
        open={leagueModal}
        onClose={() => setLeagueModal(false)}
        editing={league}
        orgId={orgId}
        orgSlug={orgSlug}
        onSaved={() => { setLeagueModal(false); refreshLeague() }}
      />
      {tglModal && (
        <TGLTeamsModal
          open={tglModal}
          onClose={() => setTglModal(false)}
          league={league}
        />
      )}
      <DeleteLeagueModal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        league={league}
        containerLabel={containerLabel}
        onConfirm={handleDeleteLeague}
      />
    </div>
  )
}

function DeleteLeagueModal({ open, onClose, league, containerLabel = 'League', onConfirm }) {
  const [confirmText, setConfirmText] = useState('')
  const [deleting,    setDeleting]    = useState(false)

  useEffect(() => {
    if (!open) setConfirmText('')
  }, [open])

  async function handleDelete() {
    setDeleting(true)
    await onConfirm()
    setDeleting(false)
  }

  return (
    <Modal open={open} onClose={onClose} title={`Delete ${containerLabel}`}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          This will permanently delete <span className="font-semibold text-ink">{league?.name}</span> and all of its
          events, scores, skins, earnings, and team play data. This cannot be undone.
        </p>
        <Input
          label={<>Type <span className="font-mono font-semibold">DELETE</span> to confirm</>}
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder="DELETE"
          autoFocus
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            variant="danger"
            disabled={confirmText !== 'DELETE'}
            loading={deleting}
            onClick={handleDelete}
          >
            Delete {containerLabel}
          </Button>
        </div>
      </div>
    </Modal>
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
export const PER_FLIGHT_GAMES = [
  { key: 'skins',       label: 'Skins',                       pro: true },
  { key: 'super_skins', label: 'Super Skins',                 pro: true },
  { key: 'long_drive',  label: 'Long Drive',                  pro: true },
  { key: 'low_putts',   label: 'Low Putts',                   pro: true },
  { key: 'ctp',         label: 'Closest to Pin (par 3s)',     pro: true },
  { key: 'super_ctp',   label: 'Super CTP (par 3s)',          pro: true },
]
export const GROUP_GAMES = [
  { key: 'blind_partners', label: 'Blind Partners', pro: true },
]

// Format keys that support per-flight scoring
export const PER_FLIGHT_FORMAT_KEYS = new Set(['net_stroke', 'net_stroke_front9', 'net_stroke_back9', 'low_gross', 'gross_stroke_front9', 'gross_stroke_back9', 'stableford', 'stableford_gross'])

export function buildFormatsArray(enabledFormats, formatScope, numFlights) {
  const result = []
  const letters = Array.from({ length: numFlights }, (_, i) => String.fromCharCode(65 + i))
  for (const fmt of enabledFormats) {
    if (numFlights > 0 && PER_FLIGHT_FORMAT_KEYS.has(fmt) && (formatScope[fmt] ?? 'flight') === 'flight') {
      letters.forEach(l => result.push(`${fmt}_${l.toLowerCase()}`))
    } else {
      result.push(fmt)
    }
  }
  return result
}

/** Convert base game set + scope map + numFlights → side_game_options array for DB */
export function buildSideGameOptions(enabledGames, gameScope, numFlights) {
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
  for (const g of GROUP_GAMES) {
    if (enabledGames.has(g.key)) result.push(g.key)
  }
  return result
}

export const FORMAT_OPTIONS = [
  { group: 'Net Stroke Play', options: [
    { value: 'net_stroke',        label: 'Net — Overall (18)' },
    { value: 'net_stroke_front9', label: 'Net — Front 9' },
    { value: 'net_stroke_back9',  label: 'Net — Back 9' },
  ]},
  { group: 'Gross Stroke Play', options: [
    { value: 'low_gross',           label: 'Gross — Overall (18)' },
    { value: 'gross_stroke_front9', label: 'Gross — Front 9' },
    { value: 'gross_stroke_back9',  label: 'Gross — Back 9' },
  ]},
  { group: 'Nassau', options: [
    { value: 'net_stroke_nassau',   label: 'Nassau — Net' },
    { value: 'gross_stroke_nassau', label: 'Nassau — Gross' },
  ]},
  { group: 'Stableford', options: [
    { value: 'stableford',       label: 'Stableford — Net' },
    { value: 'stableford_gross', label: 'Stableford — Gross' },
  ]},
  { group: 'Team Formats', options: [
    { value: 'best_ball_2', label: 'Best Ball — 2 Person', pro: true },
    { value: 'best_ball_4', label: 'Best Ball — 4 Person', pro: true },
    { value: 'scramble',    label: 'Scramble' },
    { value: 'shamble',     label: 'Shamble' },
  ]},
]

export const PLACES_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

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

// ─── Standings Settings ───────────────────────────────────────────────────────
const STANDINGS_TOGGLES = [
  { key: 'include_scoring',    label: 'Scoring (Net / Gross / Stableford)', description: 'Place finishes from scoring formats count toward season earnings' },
  { key: 'include_skins',      label: 'Skins',                              description: 'Skins hole winnings count toward season earnings' },
  { key: 'include_ctp',        label: 'Closest to Pin (CTP)',               description: 'CTP winnings count toward season earnings' },
  { key: 'include_long_drive', label: 'Long Drive',                         description: 'Long Drive winnings count toward season earnings' },
  { key: 'include_low_putts',  label: 'Low Putts',                          description: 'Low Putts winnings count toward season earnings' },
]

const DEFAULT_STANDINGS_CONFIG = {
  include_scoring:    true,
  include_skins:      true,
  include_ctp:        true,
  include_long_drive: true,
  include_low_putts:  false,
}

function StandingsSettings({ league, onSaved }) {
  const config = { ...DEFAULT_STANDINGS_CONFIG, ...(league?.standings_config ?? {}) }
  const [saving, setSaving] = useState(false)
  const [local,  setLocal]  = useState(config)

  useEffect(() => {
    setLocal({ ...DEFAULT_STANDINGS_CONFIG, ...(league?.standings_config ?? {}) })
  }, [league])

  function toggle(key) {
    setLocal(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('leagues').update({ standings_config: local }).eq('id', league.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Standings settings saved'); onSaved() }
  }

  const dirty = JSON.stringify(local) !== JSON.stringify(config)

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Standings Settings</h2>
          <p className="text-xs text-ink-muted mt-0.5">Choose which categories count toward season earnings on the public standings page.</p>
        </div>
        {dirty && (
          <Button size="sm" loading={saving} onClick={handleSave}>Save</Button>
        )}
      </div>
      <div className="space-y-3">
        {STANDINGS_TOGGLES.map(({ key, label, description }) => (
          <label key={key} className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                className="sr-only"
                checked={local[key]}
                onChange={() => toggle(key)}
              />
              <div
                className="w-9 h-5 rounded-full transition-colors"
                style={{ background: local[key] ? '#1B4332' : '#d1d5db' }}
              />
              <div
                className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ transform: local[key] ? 'translateX(16px)' : 'translateX(0)' }}
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-ink leading-tight">{label}</div>
              <div className="text-xs text-ink-muted mt-0.5">{description}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

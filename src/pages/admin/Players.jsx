import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'

const TABS = ['Roster', 'User Accounts']
const MAX_ADMINS = 3

export default function Players() {
  const { user } = useAuth()
  const [players,      setPlayers]      = useState([])
  const [profiles,     setProfiles]     = useState([])
  const [search,       setSearch]       = useState('')
  const [loading,      setLoading]      = useState(true)
  const [modal,        setModal]        = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [loginModal,   setLoginModal]   = useState(false)
  const [inviteModal,  setInviteModal]  = useState(false)
  const [mergeModal,   setMergeModal]   = useState(false)
  const [mergeSource,  setMergeSource]  = useState(null)  // player to be deleted
  const [activeTab,    setActiveTab]    = useState('Roster')
  const [orgId,        setOrgId]        = useState(null)
  const [orgTier,      setOrgTier]      = useState(null)
  const [leagues,      setLeagues]      = useState([])
  const [participation, setParticipation] = useState({})   // playerId → { [leagueId]: { events, guestEvents } }
  const [leagueFilter, setLeagueFilter] = useState('all')
  const [sort,         setSort]         = useState({ key: 'name', dir: 'asc' })

  async function load() {
    const { data: adminProfile } = await supabase
      .from('profiles').select('org_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single()
    const currentOrgId = adminProfile?.org_id ?? null

    const [{ data: p }, { data: pr }, { data: lg }] = await Promise.all([
      supabase.from('players').select('*').order('first_name'),
      currentOrgId
        ? supabase.from('profiles').select('*').eq('org_id', currentOrgId).order('full_name')
        : Promise.resolve({ data: [] }),
      currentOrgId
        // Oldest first — the org's original league is the default "home" league for members.
        ? supabase.from('leagues').select('id, name, season_year, created_at').eq('org_id', currentOrgId).order('created_at', { ascending: true })
        : Promise.resolve({ data: [] }),
    ])

    // Derive league membership from event participation:
    // event_players → events → leagues
    const part = {}
    const leagueList = lg ?? []
    if (leagueList.length) {
      const { data: evs } = await supabase
        .from('events').select('id, league_id').in('league_id', leagueList.map(l => l.id))
      const evLeague = Object.fromEntries((evs ?? []).map(e => [e.id, e.league_id]))
      const eventIds = Object.keys(evLeague)
      if (eventIds.length) {
        const { data: eps } = await supabase
          .from('event_players').select('player_id, event_id, is_guest').in('event_id', eventIds)
        for (const ep of eps ?? []) {
          const lid = evLeague[ep.event_id]
          if (!lid || !ep.player_id) continue
          const byLeague = (part[ep.player_id] ??= {})
          const rec = (byLeague[lid] ??= { events: 0, guestEvents: 0 })
          rec.events += 1
          if (ep.is_guest) rec.guestEvents += 1
        }
      }
    }

    setPlayers(p ?? [])
    setProfiles(pr ?? [])
    setLeagues(leagueList)
    setParticipation(part)
    setLoading(false)
  }

  useEffect(() => {
    load()
    async function fetchOrg() {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
      if (profile?.org_id) {
        setOrgId(profile.org_id)
        const { data: org } = await supabase.from('organizations').select('tier').eq('id', profile.org_id).single()
        if (org) setOrgTier(org.tier)
      }
    }
    fetchOrg()
  }, [user])

  // One entry per league name — a league running multiple seasons collapses into a
  // single group so a player isn't badged once per season.
  const leagueGroups = leagues
    .filter((l, i, arr) => arr.findIndex(x => x.name === l.name) === i)
    .map(l => ({ name: l.name, ids: leagues.filter(x => x.name === l.name).map(x => x.id) }))

  // The org's original league — members belong here by default.
  const primaryLeague = leagueGroups[0] ?? null

  // Roster-level guest designation, set on the player record via the Edit modal.
  const isGuestPlayer = p => p.intended_role === 'guest'

  function leagueSummary(p) {
    const part = participation[p.id] ?? {}
    const rows = leagueGroups
      .map(g => {
        let events = 0, guestEvents = 0
        for (const id of g.ids) {
          const rec = part[id]
          if (rec) { events += rec.events; guestEvents += rec.guestEvents }
        }
        return { name: g.name, ids: g.ids, events, guestEvents }
      })
      .filter(r => r.events > 0)
      .sort((a, b) => b.events - a.events)

    // Members belong to the primary league whether or not they've played an event yet.
    if (!isGuestPlayer(p) && primaryLeague && !rows.some(r => r.name === primaryLeague.name)) {
      rows.unshift({ ...primaryLeague, events: 0, guestEvents: 0 })
    }

    return rows.map(r => ({ ...r, guestOnly: r.events > 0 && r.guestEvents === r.events }))
  }

  function totalEvents(playerId) {
    return Object.values(participation[playerId] ?? {}).reduce((n, r) => n + r.events, 0)
  }

  function matchesLeagueFilter(p) {
    if (leagueFilter === 'all')    return true
    if (leagueFilter === 'none')   return totalEvents(p.id) === 0
    if (leagueFilter === 'guests') return isGuestPlayer(p) || leagueSummary(p).some(s => s.guestOnly)
    return leagueSummary(p).some(s => s.ids.includes(leagueFilter))
  }

  const searched = players.filter(p =>
    `${p.first_name} ${p.last_name} ${p.email ?? ''} ${p.ghin_number ?? ''} ${p.phone ?? ''}`.toLowerCase()
      .includes(search.toLowerCase())
  )

  // Value a row sorts by, per column. Blanks sort last regardless of direction.
  function sortValue(p, key) {
    if (key === 'league') return leagueSummary(p).map(s => s.name).join(', ')
    if (key === 'name')   return `${p.last_name} ${p.first_name}`.toLowerCase()
    if (key === 'events') return totalEvents(p.id)
    return (p[key] ?? '').toString().toLowerCase()
  }

  const filtered = searched.filter(matchesLeagueFilter).sort((a, b) => {
    const av = sortValue(a, sort.key)
    const bv = sortValue(b, sort.key)
    const blank = v => v === '' || v == null
    if (blank(av) !== blank(bv)) return blank(av) ? 1 : -1
    const cmp = typeof av === 'number' ? av - bv : av.localeCompare(bv)
    return sort.dir === 'asc' ? cmp : -cmp
  })

  function toggleSort(key) {
    setSort(s => s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'events' ? 'desc' : 'asc' })
  }

  function exportLeagueLabel(p) {
    if (isGuestPlayer(p)) return 'Guest'
    const summary = leagueSummary(p)
    // If a player spans multiple leagues, default the export to their primary league only.
    const row = summary.length > 1
      ? (summary.find(s => s.name === primaryLeague?.name) ?? summary[0])
      : summary[0]
    if (!row) return ''
    return row.guestOnly ? `${row.name} (guest)` : row.name
  }

  function exportCsv() {
    const rows = filtered.map(p => [
      exportLeagueLabel(p),
      `${p.first_name} ${p.last_name}`,
      p.email ?? '',
      p.phone ?? '',
      p.ghin_number ?? '',
      totalEvents(p.id),
    ])
    const esc = v => `"${String(v).replace(/"/g, '""')}"`
    const csv = [['League', 'Name', 'Email', 'Phone', 'GHIN', 'Events'], ...rows]
      .map(r => r.map(esc).join(',')).join('\r\n')

    const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a    = document.createElement('a')
    a.href     = url
    a.download = `players-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} player${filtered.length !== 1 ? 's' : ''}`)
  }

  const filterChips = [
    { key: 'all',    label: 'All Players', count: searched.length },
    ...leagueGroups.map(g => ({
      key:   g.ids[0],
      label: g.name,
      count: searched.filter(p => leagueSummary(p).some(s => s.name === g.name)).length,
    })),
    { key: 'guests', label: 'Guests',    count: searched.filter(p => isGuestPlayer(p) || leagueSummary(p).some(s => s.guestOnly)).length },
    { key: 'none',   label: 'No Events', count: searched.filter(p => totalEvents(p.id) === 0).length },
  ]

  async function handleDelete(id) {
    if (!confirm('Remove this player from the global roster?')) return
    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Player removed'); load() }
  }

  async function handleMerge(sourceId, targetId) {
    // Copy supplemental fields from source → target if target is missing them
    const { data: source } = await supabase.from('players').select('email, phone, ghin_number').eq('id', sourceId).single()
    const { data: target } = await supabase.from('players').select('email, phone, ghin_number').eq('id', targetId).single()
    if (source && target) {
      const patch = {}
      if (!target.email      && source.email)       patch.email       = source.email
      if (!target.phone      && source.phone)       patch.phone       = source.phone
      if (!target.ghin_number && source.ghin_number) patch.ghin_number = source.ghin_number
      if (Object.keys(patch).length) {
        await supabase.from('players').update(patch).eq('id', targetId)
      }
    }

    // Reassign all references from source → target, then delete source
    await Promise.all([
      supabase.from('event_players').update({ player_id: targetId }).eq('player_id', sourceId),
      supabase.from('scores').update({ player_id: targetId }).eq('player_id', sourceId),
      supabase.from('registrations').update({ player_id: targetId }).eq('player_id', sourceId),
      supabase.from('tgl_team_members').update({ player_id: targetId }).eq('player_id', sourceId),
      supabase.from('tgl_event_selections').update({ player_id: targetId }).eq('player_id', sourceId),
    ])
    const { error } = await supabase.from('players').delete().eq('id', sourceId)
    if (error) { toast.error('Merge failed: ' + error.message); return }
    toast.success('Players merged successfully')
    setMergeModal(false)
    setMergeSource(null)
    load()
  }

  async function handleRoleChange(profileId, newRole) {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profileId)
    if (error) toast.error(error.message)
    else { toast.success(`Role updated to ${newRole}`); load() }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Players</h1>
          <p className="text-sm text-gray-500 mt-0.5">Roster &amp; user account management</p>
        </div>
        {activeTab === 'Roster' && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>Export CSV</Button>
            <Button onClick={() => { setEditing(null); setModal(true) }}>+ Add Player</Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab ? 'tab-active' : 'tab-inactive'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Roster Tab ── */}
      {activeTab === 'Roster' && (
        <>
          <div className="flex flex-col gap-3">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, or GHIN…"
              className="input w-full sm:w-72"
            />

            <div className="flex flex-wrap gap-1.5">
              {filterChips.map(chip => (
                <button
                  key={chip.key}
                  onClick={() => setLeagueFilter(chip.key)}
                  className={`text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
                    leagueFilter === chip.key
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {chip.label}
                  <span className={leagueFilter === chip.key ? 'ml-1.5 text-gray-300' : 'ml-1.5 text-gray-400'}>
                    {chip.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[0,1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-200 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="text-center py-10">
              <p className="text-gray-500">
                {search || leagueFilter !== 'all' ? 'No players match these filters.' : 'No players yet.'}
              </p>
              {!search && leagueFilter === 'all' && (
                <Button className="mt-3" onClick={() => { setEditing(null); setModal(true) }}>Add First Player</Button>
              )}
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-left">
                      {[
                        { key: 'league',      label: 'League', pad: 'px-5' },
                        { key: 'name',        label: 'Name'   },
                        { key: 'email',       label: 'Email'  },
                        { key: 'phone',       label: 'Phone'  },
                        { key: 'ghin_number', label: 'GHIN'   },
                        { key: 'events',      label: 'Events', align: 'text-right' },
                      ].map(col => (
                        <th key={col.key} className={`${col.pad ?? 'px-4'} py-2.5 ${col.align ?? ''}`}>
                          <button
                            onClick={() => toggleSort(col.key)}
                            className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
                              sort.key === col.key ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {col.label}
                            <span className={sort.key === col.key ? 'text-gray-400' : 'text-gray-300'}>
                              {sort.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </button>
                        </th>
                      ))}
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(p => {
                      const summary = leagueSummary(p)
                      return (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 align-middle">
                            {isGuestPlayer(p) ? (
                              <span
                                title={summary.length
                                  ? `Guest — played in ${summary.map(s => s.name).join(', ')}`
                                  : 'Guest — no events yet'}
                                className="text-xs font-medium rounded-full px-2 py-0.5 border whitespace-nowrap bg-purple-50 text-purple-700 border-purple-200"
                              >
                                Guest
                              </span>
                            ) : summary.length === 0 ? (
                              <span className="text-xs text-gray-400">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {summary.map(s => (
                                  <span
                                    key={s.name}
                                    title={s.events === 0
                                      ? 'Member — no events played yet'
                                      : s.guestOnly
                                        ? `Guest only — ${s.events} event${s.events !== 1 ? 's' : ''}`
                                        : `${s.events} event${s.events !== 1 ? 's' : ''}`}
                                    className={`text-xs font-medium rounded-full px-2 py-0.5 border whitespace-nowrap ${
                                      s.guestOnly
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}
                                  >
                                    {s.name}{s.guestOnly && ' · guest'}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                            {p.last_name}, {p.first_name}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {p.email || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 tabular-nums whitespace-nowrap">
                            {p.phone || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 tabular-nums">
                            {p.ghin_number || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 tabular-nums text-right">
                            {totalEvents(p.id)}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="secondary" size="sm" onClick={() => { setEditing(p); setModal(true) }}>Edit</Button>
                              <Button variant="danger" size="sm" onClick={() => handleDelete(p.id)}>Remove</Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-2 bg-gray-50 text-xs text-gray-400 border-t border-gray-100">
                {filtered.length} player{filtered.length !== 1 ? 's' : ''}
                {leagueFilter !== 'all' && ` · filtered from ${searched.length}`}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── User Accounts Tab ── */}
      {activeTab === 'User Accounts' && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-gray-600">
              Manage login accounts and roles for your organization. <strong>Admin</strong> — full access.{' '}
              <strong>None</strong> — can log in but no access.
            </p>
            {orgTier === 'club' && (
              <div className="shrink-0 text-right">
                <Button
                  onClick={() => setInviteModal(true)}
                  disabled={profiles.filter(p => p.role === 'admin').length >= MAX_ADMINS}
                >
                  + Invite Admin
                </Button>
                <p className="text-xs text-gray-400 mt-1">
                  {profiles.filter(p => p.role === 'admin').length} / {MAX_ADMINS} admins used
                </p>
              </div>
            )}
            {orgTier !== 'club' && (
              <div className="shrink-0">
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-3 py-1">
                  Multiple admins — Club plan only
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[0,1,2].map(i => <div key={i} className="h-14 bg-gray-200 rounded-xl" />)}
            </div>
          ) : profiles.length === 0 ? (
            <Card className="text-center py-10">
              <p className="text-gray-500">No user accounts found.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="divide-y divide-gray-100">
                {profiles.map(pr => (
                  <div key={pr.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {pr.full_name || '—'}
                        <RoleBadge role={pr.role} />
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{pr.email ?? pr.id.slice(0, 12) + '…'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={pr.role ?? 'none'}
                        onChange={e => handleRoleChange(pr.id, e.target.value)}
                        className="input py-1 text-xs w-36 bg-white"
                      >
                        <option value="admin">Admin</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-2 bg-gray-50 text-xs text-gray-400 border-t border-gray-100">
                {profiles.length} user{profiles.length !== 1 ? 's' : ''}
              </div>
            </Card>
          )}
        </div>
      )}

      <PlayerModal
        open={modal}
        onClose={() => setModal(false)}
        editing={editing}
        orgId={orgId}
        onSaved={() => { setModal(false); load() }}
        onOpenMerge={(p) => { setModal(false); setMergeSource(p); setMergeModal(true) }}
      />
      <CreateLoginModal
        open={loginModal}
        onClose={() => setLoginModal(false)}
        players={players}
        orgId={orgId}
        onSaved={() => { setLoginModal(false); load() }}
      />
      <InviteAdminModal
        open={inviteModal}
        onClose={() => setInviteModal(false)}
        orgId={orgId}
        adminCount={profiles.filter(p => p.role === 'admin').length}
        onSaved={() => { setInviteModal(false); load() }}
      />
      <MergePlayerModal
        open={mergeModal}
        onClose={() => { setMergeModal(false); setMergeSource(null) }}
        source={mergeSource}
        players={players}
        onMerge={handleMerge}
      />
    </div>
  )
}

function CreateLoginModal({ open, onClose, players, orgId, onSaved }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState('none')
  const [fullName, setFullName] = useState('')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!open) { setEmail(''); setPassword(''); setRole('none'); setFullName('') }
  }, [open])

  // Auto-fill name from matching player email
  useEffect(() => {
    const match = players.find(p => p.email?.toLowerCase() === email.toLowerCase())
    if (match) setFullName(`${match.first_name} ${match.last_name}`)
  }, [email, players])

  async function handleSave(e) {
    e.preventDefault()
    if (!email || !password || !orgId) return
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setSaving(true)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-player-login`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email: email.trim(), password, fullName: fullName.trim(), role, orgId }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok || json.error) {
      toast.error(json.error ?? 'Failed to create login')
      return
    }

    toast.success(`Login created for ${email}. They can now sign in.`)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Login">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800">
          Creates a Supabase login so the user can sign in to the app. Share the email and temporary password with them — they can change it later.
        </div>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="player@example.com"
          required
        />
        <Input
          label="Full Name"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="First Last"
        />
        <Input
          label="Temporary Password"
          type="text"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Min 8 characters"
          required
        />
        <div>
          <label className="label">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} className="input bg-white">
            <option value="admin">Admin</option>
            <option value="none">None (view only)</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Create Login</Button>
        </div>
      </form>
    </Modal>
  )
}

function InviteAdminModal({ open, onClose, orgId, adminCount, onSaved }) {
  const [email,    setEmail]    = useState('')
  const [fullName, setFullName] = useState('')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!open) { setEmail(''); setFullName('') }
  }, [open])

  async function handleInvite(e) {
    e.preventDefault()
    if (!email || !orgId) return
    if (adminCount >= MAX_ADMINS) {
      toast.error(`Club plan allows up to ${MAX_ADMINS} admins.`)
      return
    }
    setSaving(true)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-admin`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email: email.trim(), orgId, fullName: fullName.trim() }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok || json.error) {
      toast.error(json.error ?? 'Failed to send invite')
    } else {
      toast.success(`Invite sent to ${email}. They'll receive an email to set up their account.`)
      onSaved()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite Admin">
      <form onSubmit={handleInvite} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800">
          An email invite will be sent. When they accept, their account will be linked to your organization with Admin access.
        </div>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="colleague@example.com"
          required
        />
        <Input
          label="Full Name (optional)"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="First Last"
        />
        <p className="text-xs text-gray-400">
          {adminCount} of {MAX_ADMINS} admin seats used on your Club plan.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Send Invite</Button>
        </div>
      </form>
    </Modal>
  )
}

function MergePlayerModal({ open, onClose, source, players, onMerge }) {
  const [targetId, setTargetId] = useState('')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { if (!open) { setTargetId(''); setSaving(false) } }, [open])

  const options = players.filter(p => p.id !== source?.id)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!targetId || !source) return
    if (!window.confirm(
      `Merge "${source.first_name} ${source.last_name}" INTO the selected player?\n\nAll event history will move to the target and "${source.first_name} ${source.last_name}" will be deleted. This cannot be undone.`
    )) return
    setSaving(true)
    await onMerge(source.id, targetId)
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Merge Players">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
          All event history (scores, registrations, Team Play) will be moved from the <strong>duplicate</strong> to the <strong>keep</strong> player. The duplicate will be permanently deleted.
        </div>

        <div>
          <label className="label">Duplicate (will be deleted)</label>
          <div className="input bg-gray-50 text-gray-700">
            {source ? `${source.last_name}, ${source.first_name}${source.email ? ` — ${source.email}` : ''}` : '—'}
          </div>
        </div>

        <div>
          <label className="label">Keep (merge into)</label>
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="input bg-white"
            required
          >
            <option value="">— Select player to keep —</option>
            {options.map(p => (
              <option key={p.id} value={p.id}>
                {p.last_name}, {p.first_name}{p.email ? ` — ${p.email}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" loading={saving}>Merge & Delete Duplicate</Button>
        </div>
      </form>
    </Modal>
  )
}

function RoleBadge({ role }) {
  if (role === 'admin')       return <Badge variant="green">Admin</Badge>
  if (role === 'scorekeeper') return <Badge variant="blue">Scorekeeper</Badge>
  return <Badge variant="gray">No Role</Badge>
}

function PlayerModal({ open, onClose, editing, orgId, onSaved, onOpenMerge }) {
  const [form,   setForm]   = useState({ first_name: '', last_name: '', email: '', phone: '', ghin_number: '', intended_role: 'player' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) setForm({
      first_name:    editing.first_name,
      last_name:     editing.last_name,
      email:         editing.email ?? '',
      phone:         editing.phone ?? '',
      ghin_number:   editing.ghin_number ?? '',
      intended_role: editing.intended_role ?? 'player',
    })
    else setForm({ first_name: '', last_name: '', email: '', phone: '', ghin_number: '', intended_role: 'player' })
  }, [editing, open])

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    let resolvedOrgId = orgId
    if (!resolvedOrgId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
        resolvedOrgId = profile?.org_id ?? null
      }
    }
    const payload = {
      first_name:    form.first_name.trim(),
      last_name:     form.last_name.trim(),
      email:         form.email.trim() || null,
      phone:         form.phone.trim() || null,
      ghin_number:   form.ghin_number.trim() || null,
      intended_role: form.intended_role,
    }
    const { error } = editing
      ? await supabase.from('players').update(payload).eq('id', editing.id)
      : await supabase.from('players').insert({ ...payload, org_id: resolvedOrgId })

    // If an email is provided and role is not 'player', update the matching profile immediately
    if (!error && payload.email && payload.intended_role !== 'player') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', payload.email)
        .maybeSingle()
      if (profile) {
        const roleMap = { admin: 'admin', scorekeeper: 'scorekeeper' }
        await supabase.from('profiles').update({ role: roleMap[payload.intended_role] ?? 'none' }).eq('id', profile.id)
      }
    }

    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success(editing ? 'Player updated' : 'Player added'); onSaved() }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Player' : 'Add Player'}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="First Name" value={form.first_name} onChange={e => setField('first_name', e.target.value)} required />
          <Input label="Last Name"  value={form.last_name}  onChange={e => setField('last_name',  e.target.value)} required />
        </div>
        <Input label="Email (optional)"       type="email" value={form.email}       onChange={e => setField('email',       e.target.value)} placeholder="player@example.com" />
        <Input label="Phone (optional)"       type="tel"   value={form.phone}       onChange={e => setField('phone',       e.target.value)} placeholder="(555) 123-4567" />
        <Input label="GHIN Number (optional)"             value={form.ghin_number} onChange={e => setField('ghin_number', e.target.value)} placeholder="1234567" />
        <div>
          <label className="label">Role</label>
          <select value={form.intended_role} onChange={e => setField('intended_role', e.target.value)} className="input bg-white">
            <option value="player">Member</option>
            <option value="admin">Admin</option>
            <option value="guest">Guest</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Admin role is applied immediately if a matching email account exists.
          </p>
        </div>
        <div className="flex items-center justify-between pt-2">
          {editing && onOpenMerge ? (
            <button
              type="button"
              onClick={() => onOpenMerge(editing)}
              className="text-xs text-ink-muted hover:text-ink underline"
            >
              Merge duplicate…
            </button>
          ) : <span />}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save' : 'Add Player'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

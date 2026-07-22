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

  async function load() {
    const { data: adminProfile } = await supabase
      .from('profiles').select('org_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single()
    const currentOrgId = adminProfile?.org_id ?? null

    const [{ data: p }, { data: pr }] = await Promise.all([
      supabase.from('players').select('*').order('first_name'),
      currentOrgId
        ? supabase.from('profiles').select('*').eq('org_id', currentOrgId).order('full_name')
        : Promise.resolve({ data: [] }),
    ])
    setPlayers(p ?? [])
    setProfiles(pr ?? [])
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

  const filtered = players.filter(p =>
    `${p.first_name} ${p.last_name} ${p.email ?? ''}`.toLowerCase()
      .includes(search.toLowerCase())
  )

  async function handleDelete(id) {
    if (!confirm('Remove this player from the global roster?')) return
    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Player removed'); load() }
  }

  async function handleMerge(sourceId, targetId) {
    // Copy supplemental fields from source → target if target is missing them
    const { data: source } = await supabase.from('players').select('email, ghin_number').eq('id', sourceId).single()
    const { data: target } = await supabase.from('players').select('email, ghin_number').eq('id', targetId).single()
    if (source && target) {
      const patch = {}
      if (!target.email      && source.email)       patch.email       = source.email
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
          <Button onClick={() => { setEditing(null); setModal(true) }}>+ Add Player</Button>
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
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search players…"
            className="input w-full sm:w-72"
          />

          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[0,1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-200 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="text-center py-10">
              <p className="text-gray-500">{search ? 'No players match your search.' : 'No players yet.'}</p>
              {!search && <Button className="mt-3" onClick={() => { setEditing(null); setModal(true) }}>Add First Player</Button>}
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="divide-y divide-gray-100">
                {filtered.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <div className="font-medium text-gray-900">{p.first_name} {p.last_name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                        {p.email && <span>{p.email}</span>}
                        {p.ghin_number && <span>GHIN: {p.ghin_number}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => { setEditing(p); setModal(true) }}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(p.id)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-2 bg-gray-50 text-xs text-gray-400 border-t border-gray-100">
                {filtered.length} player{filtered.length !== 1 ? 's' : ''}
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
  const [form,   setForm]   = useState({ first_name: '', last_name: '', email: '', ghin_number: '', intended_role: 'player' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) setForm({
      first_name:    editing.first_name,
      last_name:     editing.last_name,
      email:         editing.email ?? '',
      ghin_number:   editing.ghin_number ?? '',
      intended_role: editing.intended_role ?? 'player',
    })
    else setForm({ first_name: '', last_name: '', email: '', ghin_number: '', intended_role: 'player' })
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

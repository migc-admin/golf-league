import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'

const TABS = ['Roster', 'User Accounts']

export default function Players() {
  const [players,  setPlayers]  = useState([])
  const [profiles, setProfiles] = useState([])
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [modal,       setModal]       = useState(false)
  const [editing,     setEditing]     = useState(null)
  const [loginModal,  setLoginModal]  = useState(false)
  const [activeTab,   setActiveTab]   = useState('Roster')

  async function load() {
    const [{ data: p }, { data: pr }] = await Promise.all([
      supabase.from('players').select('*').order('last_name'),
      supabase.from('profiles').select('*').order('full_name'),
    ])
    setPlayers(p ?? [])
    setProfiles(pr ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
                      <div className="font-medium text-gray-900">{p.last_name}, {p.first_name}</div>
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
              Manage login accounts and roles. <strong>Admin</strong> — full access.{' '}
              <strong>Scorekeeper</strong> — score entry only.{' '}
              <strong>None</strong> — can log in but no access.
            </p>
            <Button size="sm" onClick={() => setLoginModal(true)} className="shrink-0">+ Create Login</Button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-xs text-yellow-800">
            <strong>Note:</strong> Adding a player to the roster does not create a login. Use <strong>Create Login</strong> to set up an email + password for a user so they can sign in.
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
                        {pr.full_name || pr.id.slice(0, 8) + '…'}
                        <RoleBadge role={pr.role} />
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">ID: {pr.id.slice(0, 12)}…</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={pr.role ?? 'none'}
                        onChange={e => handleRoleChange(pr.id, e.target.value)}
                        className="input py-1 text-xs w-36 bg-white"
                      >
                        <option value="admin">Admin</option>
                        <option value="scorekeeper">Scorekeeper</option>
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
        onSaved={() => { setModal(false); load() }}
      />
      <CreateLoginModal
        open={loginModal}
        onClose={() => setLoginModal(false)}
        players={players}
        onSaved={() => { setLoginModal(false); load() }}
      />
    </div>
  )
}

function CreateLoginModal({ open, onClose, players, onSaved }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState('scorekeeper')
  const [fullName, setFullName] = useState('')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!open) { setEmail(''); setPassword(''); setRole('scorekeeper'); setFullName('') }
  }, [open])

  // Auto-fill name from matching player email
  useEffect(() => {
    const match = players.find(p => p.email?.toLowerCase() === email.toLowerCase())
    if (match) setFullName(`${match.first_name} ${match.last_name}`)
  }, [email, players])

  async function handleSave(e) {
    e.preventDefault()
    if (!email || !password) return
    setSaving(true)

    // Create auth account
    const { data, error } = await supabase.auth.signUp({
      email:    email.trim(),
      password: password,
      options:  { data: { full_name: fullName.trim() } },
    })

    if (error) {
      toast.error(error.message)
      setSaving(false)
      return
    }

    // If a profile was created (email confirm off), set role immediately
    if (data?.user?.id) {
      await supabase.from('profiles').upsert({
        id:        data.user.id,
        full_name: fullName.trim() || email.trim(),
        role,
      }, { onConflict: 'id' })
    }

    setSaving(false)
    toast.success(`Login created for ${email}. ${data?.user?.identities?.length === 0 ? 'Account already exists.' : 'They can now sign in.'}`)
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
          placeholder="Min 6 characters"
          required
        />
        <div>
          <label className="label">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} className="input bg-white">
            <option value="scorekeeper">Scorekeeper</option>
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

function RoleBadge({ role }) {
  if (role === 'admin')       return <Badge variant="green">Admin</Badge>
  if (role === 'scorekeeper') return <Badge variant="blue">Scorekeeper</Badge>
  return <Badge variant="gray">No Role</Badge>
}

function PlayerModal({ open, onClose, editing, onSaved }) {
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
    const payload = {
      first_name:    form.first_name.trim(),
      last_name:     form.last_name.trim(),
      email:         form.email.trim() || null,
      ghin_number:   form.ghin_number.trim() || null,
      intended_role: form.intended_role,
    }
    const { error } = editing
      ? await supabase.from('players').update(payload).eq('id', editing.id)
      : await supabase.from('players').insert(payload)

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
            <option value="player">Player</option>
            <option value="admin">Admin</option>
            <option value="scorekeeper">Scorekeeper</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Admin and Scorekeeper roles are applied immediately if a matching email account exists.
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{editing ? 'Save' : 'Add Player'}</Button>
        </div>
      </form>
    </Modal>
  )
}

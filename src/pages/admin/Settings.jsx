import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user } = useAuth()
  const [org,     setOrg]     = useState(null)
  const [name,    setName]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()
      .then(({ data: p }) => {
        if (!p?.org_id) { setLoading(false); return }
        supabase
          .from('organizations')
          .select('id, name, slug')
          .eq('id', p.org_id)
          .single()
          .then(({ data: o }) => {
            if (o) { setOrg(o); setName(o.name) }
            setLoading(false)
          })
      })
  }, [user])

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    // Generate slug from name
    const newSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    const { error } = await supabase
      .from('organizations')
      .update({ name: name.trim(), slug: newSlug })
      .eq('id', org.id)

    setSaving(false)
    if (error) {
      toast.error('Failed to update: ' + error.message)
    } else {
      setOrg(o => ({ ...o, name: name.trim(), slug: newSlug }))
      toast.success('Organization updated.')
    }
  }

  if (loading) return <div className="text-ink-muted text-sm">Loading…</div>
  if (!org)    return <div className="text-ink-muted text-sm">No organization found.</div>

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-ink mb-6">Settings</h1>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-bold text-ink">Organization</h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Organization Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">URL Slug <span className="font-normal text-gray-400">(auto-generated)</span></label>
            <div className="text-xs text-ink-muted bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              {name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || org.slug}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || name.trim() === org.name}
            className="btn-primary"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

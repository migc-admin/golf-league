/**
 * Onboarding — shown to newly signed-up users who have no org/profile yet.
 * Creates their organization and admin profile, then redirects to /admin.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const GREEN = '#1B4332'

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

export default function Onboarding() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [orgName,  setOrgName]  = useState('')
  const [saving,   setSaving]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!orgName.trim() || !user) return
    setSaving(true)

    try {
      const baseSlug = slugify(orgName)

      // Check for slug collisions and append random suffix if needed
      const { data: existing } = await supabase
        .from('organizations')
        .select('slug')
        .eq('slug', baseSlug)
        .maybeSingle()

      const slug = existing
        ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
        : baseSlug

      // Create org
      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: orgName.trim(), slug, tier: 'free' })
        .select('id, slug')
        .single()

      if (orgErr) throw orgErr

      // Create admin profile
      const fullName = user.user_metadata?.full_name ?? ''
      const { error: profErr } = await supabase
        .from('profiles')
        .upsert({
          id:        user.id,
          org_id:    org.id,
          role:      'admin',
          full_name: fullName,
          email:     user.email,
        })

      if (profErr) throw profErr

      toast.success('Welcome to Scorify Golf!')
      // Hard reload so AuthProvider re-fetches the new profile
      window.location.href = '/admin'
    } catch (err) {
      toast.error(err.message ?? 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#fbfaf8' }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <img src="/logo.png" alt="Scorify Golf" className="w-16 h-16 object-contain mx-auto mb-4" />
          <h1 className="font-bold text-2xl mb-1" style={{ letterSpacing: '-0.03em', color: '#1d1d1f' }}>
            Welcome to Scorify Golf
          </h1>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            Let's set up your organization to get started.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '1.5rem',
          border: '1px solid #ebe9e4',
          boxShadow: '0 20px 60px rgba(0,0,0,.08)',
          padding: '32px 28px',
        }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Organization / Club Name</label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="e.g. Mulligan's Island Golf Club"
                className="input"
                autoFocus
                required
              />
              <p className="text-xs mt-1.5" style={{ color: '#9ca3af' }}>
                This is the name your leagues and events will be listed under.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving || !orgName.trim()}
              className="btn-primary btn-lg w-full"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Setting up…
                </span>
              ) : 'Create my organization →'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#9ca3af' }}>
          Signed in as {user?.email}
        </p>
      </div>
    </div>
  )
}

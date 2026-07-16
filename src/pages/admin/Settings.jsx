import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { TIER_LABELS } from '../../lib/features'
import toast from 'react-hot-toast'

const GREEN = '#1B4332'

const PLAN_FEATURES = [
  { label: 'Leagues',              free: '1',          pro: '3',           club: 'Unlimited' },
  { label: 'Players per event',    free: 'Up to 16',   pro: 'Unlimited',   club: 'Unlimited' },
  { label: 'Digital scoring',      free: true,         pro: true,          club: true        },
  { label: 'Online registration',  free: false,        pro: true,          club: true        },
  { label: 'Public leaderboards',  free: false,        pro: true,          club: true        },
  { label: 'Season standings',     free: false,        pro: true,          club: true        },
  { label: 'Score export (CSV)',   free: false,        pro: true,          club: true        },
  { label: 'Additional admins',    free: false,        pro: false,         club: 'Up to 3'   },
  { label: 'Priority support',     free: false,        pro: false,         club: true        },
]

const TIER_BADGE = {
  free:  { bg: '#f3f4f6', color: '#6b7280' },
  pro:   { bg: '#eff6ff', color: '#1d4ed8' },
  club:  { bg: '#f0fdf4', color: GREEN     },
}

function Check() {
  return (
    <svg className="w-4 h-4" style={{ color: GREEN }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
function Dash() {
  return <span className="text-gray-300 font-bold">—</span>
}

export default function Settings() {
  const { user } = useAuth()
  const [org,          setOrg]          = useState(null)
  const [name,         setName]         = useState('')
  const [saving,       setSaving]       = useState(false)
  const [portalLoading,setPortalLoading]= useState(false)
  const [loading,      setLoading]      = useState(true)

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
          .select('id, name, slug, tier, stripe_customer_id, created_at')
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

  async function handleManageBilling() {
    setPortalLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ return_url: window.location.href }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      toast.error(err.message)
      setPortalLoading(false)
    }
  }

  if (loading) return <div className="text-sm text-gray-400 py-8">Loading…</div>
  if (!org)    return <div className="text-sm text-gray-400 py-8">No organization found.</div>

  const tier      = org.tier ?? 'free'
  const tierLabel = TIER_LABELS[tier] ?? tier
  const badge     = TIER_BADGE[tier] ?? TIER_BADGE.free
  const isPaid    = tier !== 'free'
  const slug      = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || org.slug

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-ink">Settings</h1>

      {/* ── Organization ── */}
      <section className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-6 py-4">
          <h2 className="text-sm font-bold text-ink">Organization</h2>
        </div>
        <div className="px-6 py-5">
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
              <div className="text-xs text-ink-muted bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 font-mono">
                {slug}
              </div>
              {slug !== org.slug && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠ Changing the slug will break existing public links (standings, leaderboard, etc.)
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || name.trim() === org.name}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40 hover:opacity-90"
                style={{ background: GREEN }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Subscription ── */}
      <section className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-6 py-4">
          <h2 className="text-sm font-bold text-ink">Subscription</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Current Plan</p>
              <span
                className="text-sm font-bold px-3 py-1 rounded-full"
                style={{ background: badge.bg, color: badge.color }}
              >
                {tierLabel}
              </span>
            </div>
            {!isPaid && tier !== 'club' && (
              <a
                href="/upgrade"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: GREEN }}
              >
                Upgrade →
              </a>
            )}
          </div>

          {isPaid && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-gray-500">
                {org.stripe_customer_id
                  ? 'Manage billing, update payment method, or cancel anytime.'
                  : 'No active subscription on file.'}
              </p>
              {org.stripe_customer_id && (
                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-300 text-ink hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {portalLoading ? 'Loading…' : 'Manage billing'}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Plan Details ── */}
      <section className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-6 py-4">
          <h2 className="text-sm font-bold text-ink">Plan Details</h2>
        </div>
        <div className="px-6 py-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left py-3 font-semibold">Feature</th>
                <th className="text-center py-3 font-semibold">Starter</th>
                <th className="text-center py-3 font-semibold">Pro</th>
                <th className="text-center py-3 font-semibold">Club</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {PLAN_FEATURES.map(f => (
                <tr key={f.label}>
                  <td className="py-2.5 text-gray-700">{f.label}</td>
                  {['free', 'pro', 'club'].map(t => {
                    const val = f[t]
                    const isCurrentTier = t === tier
                    return (
                      <td key={t} className={`py-2.5 text-center ${isCurrentTier ? 'font-semibold' : ''}`}
                        style={isCurrentTier ? { color: GREEN } : {}}>
                        {val === true  ? <span className="flex justify-center"><Check /></span>
                        : val === false ? <span className="flex justify-center"><Dash /></span>
                        : <span className="text-xs">{val}</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tier !== 'club' && (
          <div className="px-6 py-4 flex justify-end">
            <a
              href="/upgrade"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: GREEN }}
            >
              Upgrade to {tier === 'free' ? 'Pro' : 'Club'} →
            </a>
          </div>
        )}
      </section>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { TIER_LABELS } from '../../lib/features'
import { resolveConfig, BASE_DEFAULTS, TIER_DEFAULTS, FEATURE_TIERS } from '../../lib/tenantConfig'
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

const TIER_ORDER = ['free', 'pro', 'club']
function meetsMinTier(orgTier, minTier) {
  return TIER_ORDER.indexOf(orgTier ?? 'free') >= TIER_ORDER.indexOf(minTier ?? 'free')
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

function LockBadge({ minTier }) {
  return (
    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
      {TIER_LABELS[minTier] ?? minTier} +
    </span>
  )
}

function SectionCard({ title, children }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </section>
  )
}

function ToggleRow({ label, description, value, onChange, locked, minTier }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 flex items-center gap-1">
          {label}
          {locked && <LockBadge minTier={minTier} />}
        </p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => !locked && onChange(!value)}
        disabled={locked}
        className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
          locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
        }`}
        style={{ background: value && !locked ? GREEN : '#d1d5db' }}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
            value ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function SelectRow({ label, description, value, onChange, options, locked, minTier }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 flex items-center gap-1">
          {label}
          {locked && <LockBadge minTier={minTier} />}
        </p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <select
        value={value}
        onChange={e => !locked && onChange(e.target.value)}
        disabled={locked}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function NumberRow({ label, description, value, onChange, min, max, locked, minTier }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 flex items-center gap-1">
          {label}
          {locked && <LockBadge minTier={minTier} />}
        </p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => !locked && onChange(Number(e.target.value))}
        disabled={locked}
        className="w-20 text-sm text-right border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
      />
    </div>
  )
}

function ColorRow({ label, description, value, onChange, locked, minTier }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 flex items-center gap-1">
          {label}
          {locked && <LockBadge minTier={minTier} />}
        </p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={e => !locked && onChange(e.target.value)}
          disabled={locked}
          className="w-8 h-8 rounded cursor-pointer border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <span className="text-xs text-gray-400 font-mono">{value}</span>
      </div>
    </div>
  )
}

// Build a sparse diff — only include keys that differ from base+tier defaults
function buildSparseConfig(draft, tier) {
  const defaults = resolveConfig(tier, {})
  const sparse = {}

  // scoring
  const sc = {}
  if (draft.scoring.handicap_method !== defaults.scoring.handicap_method) sc.handicap_method = draft.scoring.handicap_method
  if (draft.scoring.allowance_pct   !== defaults.scoring.allowance_pct)   sc.allowance_pct   = draft.scoring.allowance_pct
  if (draft.scoring.max_handicap    !== defaults.scoring.max_handicap)     sc.max_handicap    = draft.scoring.max_handicap
  if (draft.scoring.holes_default   !== defaults.scoring.holes_default)    sc.holes_default   = draft.scoring.holes_default
  if (Object.keys(sc).length) sparse.scoring = sc

  // display
  const di = {}
  if (draft.display.show_money_list      !== defaults.display.show_money_list)      di.show_money_list      = draft.display.show_money_list
  if (draft.display.leaderboard_public   !== defaults.display.leaderboard_public)   di.leaderboard_public   = draft.display.leaderboard_public
  if (draft.display.show_course_handicap !== defaults.display.show_course_handicap) di.show_course_handicap = draft.display.show_course_handicap
  if (draft.display.show_flight_labels   !== defaults.display.show_flight_labels)   di.show_flight_labels   = draft.display.show_flight_labels
  if (Object.keys(di).length) sparse.display = di

  // registration
  const re = {}
  if (draft.registration.public_registration !== defaults.registration.public_registration) re.public_registration = draft.registration.public_registration
  if (draft.registration.require_approval    !== defaults.registration.require_approval)    re.require_approval    = draft.registration.require_approval
  if (Object.keys(re).length) sparse.registration = re

  // branding
  const br = {}
  if (draft.branding.primary_color !== defaults.branding.primary_color) br.primary_color = draft.branding.primary_color
  if (draft.branding.accent_color  !== defaults.branding.accent_color)  br.accent_color  = draft.branding.accent_color
  if (Object.keys(br).length) sparse.branding = br

  return sparse
}

export default function Settings() {
  const { user } = useAuth()
  const [org,           setOrg]           = useState(null)
  const [name,          setName]          = useState('')
  const [saving,        setSaving]        = useState(false)
  const [savingConfig,  setSavingConfig]  = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [isPrivileged,  setIsPrivileged]  = useState(false)
  const [configDraft,   setConfigDraft]   = useState(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('org_id, is_owner, is_platform_admin')
      .eq('id', user.id)
      .single()
      .then(({ data: p }) => {
        if (p?.is_owner || p?.is_platform_admin) setIsPrivileged(true)
        if (!p?.org_id) { setLoading(false); return }
        supabase
          .from('organizations')
          .select('id, name, slug, tier, stripe_customer_id, created_at, org_config')
          .eq('id', p.org_id)
          .single()
          .then(({ data: o }) => {
            if (o) {
              setOrg(o)
              setName(o.name)
              // Resolve full merged config for the form initial state
              const merged = resolveConfig(o.tier, o.org_config ?? {})
              setConfigDraft({
                scoring:      { ...merged.scoring },
                display:      { ...merged.display },
                registration: { ...merged.registration },
                branding:     { ...merged.branding },
              })
            }
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

  async function handleSaveConfig() {
    if (!configDraft) return
    setSavingConfig(true)
    const sparse = buildSparseConfig(configDraft, org.tier)
    const { error } = await supabase
      .from('organizations')
      .update({ org_config: sparse })
      .eq('id', org.id)
    setSavingConfig(false)
    if (error) {
      toast.error('Failed to save configuration: ' + error.message)
    } else {
      setOrg(o => ({ ...o, org_config: sparse }))
      toast.success('Configuration saved.')
    }
  }

  function setScoring(key, val) {
    setConfigDraft(d => ({ ...d, scoring: { ...d.scoring, [key]: val } }))
  }
  function setDisplay(key, val) {
    setConfigDraft(d => ({ ...d, display: { ...d.display, [key]: val } }))
  }
  function setRegistration(key, val) {
    setConfigDraft(d => ({ ...d, registration: { ...d.registration, [key]: val } }))
  }
  function setBranding(key, val) {
    setConfigDraft(d => ({ ...d, branding: { ...d.branding, [key]: val } }))
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

  const tier      = (isPrivileged || org.tier === 'club') ? 'club' : (org.tier ?? 'free')
  const tierLabel = TIER_LABELS[tier] ?? tier
  const badge     = TIER_BADGE[tier] ?? TIER_BADGE.free
  const isPaid    = tier !== 'free'
  const slug      = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || org.slug

  const isPro  = meetsMinTier(tier, 'pro')
  const isClub = meetsMinTier(tier, 'club')

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
            {name.trim() !== org.name && (
              <p className="text-xs text-amber-600">
                ⚠ Renaming the org will update your public URL slug and break existing public links (standings, leaderboard, etc.)
              </p>
            )}
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

      {/* ── League Configuration ── */}
      {configDraft && (
        <section className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-ink">League Configuration</h2>
              <p className="text-xs text-gray-500 mt-0.5">Customize defaults for all leagues and events in your organization.</p>
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40 hover:opacity-90"
              style={{ background: GREEN }}
            >
              {savingConfig ? 'Saving…' : 'Save'}
            </button>
          </div>

          {/* Scoring */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Scoring</p>
            <SelectRow
              label="Handicap Method"
              description="How player handicaps are calculated for net scoring."
              value={configDraft.scoring.handicap_method}
              onChange={v => setScoring('handicap_method', v)}
              options={[
                { value: 'usga',     label: 'USGA Handicap Index' },
                { value: 'callaway', label: 'Callaway' },
                { value: 'none',     label: 'No Handicap (gross only)' },
              ]}
            />
            <NumberRow
              label="Handicap Allowance %"
              description="Percentage of handicap applied to net scoring (80–100% typical)."
              value={configDraft.scoring.allowance_pct}
              onChange={v => setScoring('allowance_pct', v)}
              min={50} max={100}
            />
            <NumberRow
              label="Maximum Handicap"
              description="Cap applied to any player's handicap index."
              value={configDraft.scoring.max_handicap}
              onChange={v => setScoring('max_handicap', v)}
              min={0} max={54}
            />
            <SelectRow
              label="Default Holes"
              description="Number of holes played when creating a new event."
              value={String(configDraft.scoring.holes_default)}
              onChange={v => setScoring('holes_default', Number(v))}
              options={[
                { value: '18', label: '18 holes' },
                { value: '9',  label: '9 holes'  },
              ]}
            />
          </div>

          {/* Display */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Display</p>
            <ToggleRow
              label="Public Leaderboard"
              description="Anyone with the event link can view live standings."
              value={configDraft.display.leaderboard_public}
              onChange={v => setDisplay('leaderboard_public', v)}
            />
            <ToggleRow
              label="Show Money List"
              description="Display cumulative season earnings on the standings page."
              value={configDraft.display.show_money_list}
              onChange={v => setDisplay('show_money_list', v)}
            />
            <ToggleRow
              label="Show Course Handicap"
              description="Display each player's course handicap on scorecards."
              value={configDraft.display.show_course_handicap}
              onChange={v => setDisplay('show_course_handicap', v)}
            />
            <ToggleRow
              label="Show Flight Labels"
              description="Display flight names (A, B, C…) on leaderboards."
              value={configDraft.display.show_flight_labels}
              onChange={v => setDisplay('show_flight_labels', v)}
            />
          </div>

          {/* Registration */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Registration</p>
            <ToggleRow
              label="Public Registration"
              description="Allow anyone with the event link to register themselves."
              value={configDraft.registration.public_registration}
              onChange={v => setRegistration('public_registration', v)}
              locked={!isPro}
              minTier="pro"
            />
            <ToggleRow
              label="Require Admin Approval"
              description="New registrations go to a pending state until an admin approves."
              value={configDraft.registration.require_approval}
              onChange={v => setRegistration('require_approval', v)}
              locked={!isPro}
              minTier="pro"
            />
          </div>

          {/* Branding */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Branding</p>
            <ColorRow
              label="Primary Color"
              description="Main brand color used across your public pages."
              value={configDraft.branding.primary_color}
              onChange={v => setBranding('primary_color', v)}
              locked={!isClub}
              minTier="club"
            />
            <ColorRow
              label="Accent Color"
              description="Secondary highlight color for buttons and accents."
              value={configDraft.branding.accent_color}
              onChange={v => setBranding('accent_color', v)}
              locked={!isClub}
              minTier="club"
            />
            {!isClub && (
              <p className="text-xs text-gray-400">
                Custom branding is available on the Club plan.{' '}
                <a href="/upgrade" className="underline" style={{ color: GREEN }}>Upgrade →</a>
              </p>
            )}
          </div>
        </section>
      )}

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
        <div className="px-6 py-2 overflow-x-auto">
          <table className="w-full text-sm min-w-[340px]">
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

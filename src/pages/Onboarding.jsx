/**
 * Onboarding — shown to newly signed-up users who have no org/profile yet.
 * Step 1: choose tier + billing. Step 2: name the org.
 * Free → /admin. Paid → Stripe payment link with org ID attached.
 */
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const GREEN = '#1B4332'
const INK   = '#1d1d1f'

const STRIPE_LINKS = {
  pro_monthly:  'https://buy.stripe.com/test_14AeVcfAhdCReRZ7mU2cg03',
  pro_yearly:   'https://buy.stripe.com/test_cNi4gyfAh2Yd9xFePm2cg02',
  club_monthly: 'https://buy.stripe.com/test_28EcN49bTcyN11936E2cg01',
  club_yearly:  'https://buy.stripe.com/test_3cI7sK1JraqFh075eM2cg00',
}

const TIERS = [
  {
    id: 'free',
    name: 'Starter',
    monthlyPrice: 'Free',
    yearlyPrice: 'Free',
    sub: 'forever free',
    features: [
      '1 league',
      'Up to 24 players',
      'Digital scoring & leaderboards',
      'Season standings',
      'Printable scorecards',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: '$29',
    yearlyPrice: '$199',
    monthlySub: '/mo',
    yearlySub: '/yr · save $149',
    popular: true,
    features: [
      'Unlimited leagues & players',
      'Everything in Starter',
      'Flights A & B',
      'Skins, CTP & side games',
      'Score export (CSV)',
      'Priority support',
    ],
  },
  {
    id: 'club',
    name: 'Club',
    monthlyPrice: '$79',
    yearlyPrice: '$549',
    monthlySub: '/mo',
    yearlySub: '/yr · save $399',
    features: [
      'Everything in Pro',
      'Multiple admins',
      'TGL team scoring',
      'Custom branding',
      'Online registration',
      'Dedicated onboarding',
    ],
  },
]

function Check() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
      style={{ color: GREEN, flexShrink: 0, marginTop: 2 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

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

  const [step,     setStep]     = useState(1)
  const [tier,     setTier]     = useState('free')
  const [billing,  setBilling]  = useState('monthly') // 'monthly' | 'yearly'
  const [orgName,  setOrgName]  = useState('')
  const [saving,   setSaving]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!orgName.trim() || !user) return
    setSaving(true)

    try {
      const baseSlug = slugify(orgName)

      const { data: existing } = await supabase
        .from('organizations')
        .select('slug')
        .eq('slug', baseSlug)
        .maybeSingle()

      const slug = existing
        ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
        : baseSlug

      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: orgName.trim(), slug, tier })
        .select('id, slug')
        .single()

      if (orgErr) throw orgErr

      const fullName = user.user_metadata?.full_name ?? ''
      const { error: profErr } = await supabase
        .from('profiles')
        .upsert({
          id:        user.id,
          org_id:    org.id,
          role:      'admin',
          full_name: fullName,
        }, { onConflict: 'id' })

      if (profErr) throw new Error(`Profile error: ${profErr.message}. Contact support at admin@scorifygolf.com`)

      if (tier === 'free') {
        toast.success('Welcome to Scorify Golf!')
        window.location.href = '/admin'
      } else {
        const linkKey = `${tier}_${billing}`
        const baseUrl = STRIPE_LINKS[linkKey]
        // Pass org ID so webhook can upgrade the right org after payment
        window.location.href = `${baseUrl}?client_reference_id=${org.id}`
      }
    } catch (err) {
      toast.error(err.message ?? 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  const selectedTier = TIERS.find(t => t.id === tier)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#fbfaf8' }}>
      <div className="w-full" style={{ maxWidth: step === 1 ? 860 : 440 }}>

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Scorify Golf" className="w-16 h-16 object-contain mx-auto mb-4" />
          <h1 className="font-bold text-2xl mb-1" style={{ letterSpacing: '-0.03em', color: INK }}>
            {step === 1 ? 'Choose your plan' : 'Name your organization'}
          </h1>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            {step === 1
              ? 'You can upgrade or change your plan at any time.'
              : 'This is the name your leagues and events will be listed under.'}
          </p>
        </div>

        {/* ── Step 1: Tier picker ── */}
        {step === 1 && (
          <>
            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => setBilling('monthly')}
                className="text-sm font-semibold px-4 py-1.5 rounded-full transition-all"
                style={{
                  background: billing === 'monthly' ? INK : 'transparent',
                  color: billing === 'monthly' ? '#fff' : '#9ca3af',
                }}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilling('yearly')}
                className="text-sm font-semibold px-4 py-1.5 rounded-full transition-all"
                style={{
                  background: billing === 'yearly' ? GREEN : 'transparent',
                  color: billing === 'yearly' ? '#fff' : '#9ca3af',
                }}
              >
                Annual <span style={{ fontWeight: 400, fontSize: '0.7rem' }}>· save up to 43%</span>
              </button>
            </div>

            {/* Tier cards */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {TIERS.map(t => {
                const selected = tier === t.id
                const price = billing === 'yearly' ? t.yearlyPrice : t.monthlyPrice
                const sub   = t.id === 'free' ? t.sub : (billing === 'yearly' ? t.yearlySub : t.monthlySub)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTier(t.id)}
                    style={{
                      position: 'relative',
                      background: '#ffffff',
                      borderRadius: '1.25rem',
                      border: selected ? `2px solid ${GREEN}` : '1.5px solid #ebe9e4',
                      padding: '1.5rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      boxShadow: selected
                        ? '0 8px 32px rgba(27,67,50,0.15)'
                        : '0 2px 8px rgba(0,0,0,0.04)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {t.popular && (
                      <span style={{
                        position: 'absolute',
                        top: 0, right: 0,
                        background: GREEN,
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '0 1.25rem 0 0.6rem',
                      }}>
                        Popular
                      </span>
                    )}

                    <div style={{
                      width: 20, height: 20,
                      borderRadius: '50%',
                      border: selected ? `6px solid ${GREEN}` : '2px solid #d1d5db',
                      marginBottom: '1rem',
                      transition: 'all 0.2s',
                    }} />

                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#9ca3af' }}>
                      {t.name}
                    </p>
                    <div className="flex items-end gap-1 mb-0.5">
                      <span className="font-bold" style={{ fontSize: '1.75rem', color: INK, letterSpacing: '-0.02em' }}>
                        {price}
                      </span>
                    </div>
                    <p className="text-xs mb-4" style={{ color: GREEN, fontWeight: 600 }}>{sub}</p>

                    <ul className="space-y-2">
                      {t.features.map(f => (
                        <li key={f} className="flex items-start gap-2 text-xs" style={{ color: '#4b5563' }}>
                          <Check />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn-primary btn-lg"
                style={{ minWidth: 240 }}
              >
                Continue with {selectedTier?.name} →
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Org name ── */}
        {step === 2 && (
          <div style={{
            background: '#ffffff',
            borderRadius: '1.5rem',
            border: '1px solid #ebe9e4',
            boxShadow: '0 20px 60px rgba(0,0,0,.08)',
            padding: '32px 28px',
          }}>
            {/* Selected plan badge */}
            <div className="flex items-center gap-2 mb-6 pb-5" style={{ borderBottom: '1px solid #ebe9e4' }}>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9ca3af' }}>Plan:</span>
              <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: '#f0fdf4', color: GREEN }}>
                {selectedTier?.name}
                {tier !== 'free' && ` · ${billing === 'yearly' ? 'Annual' : 'Monthly'}`}
              </span>
              <button type="button" onClick={() => setStep(1)} className="text-xs underline ml-auto" style={{ color: '#9ca3af' }}>
                Change
              </button>
            </div>

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
                ) : tier === 'free' ? 'Create my organization →' : 'Continue to payment →'}
              </button>

              {tier !== 'free' && (
                <p className="text-xs text-center" style={{ color: '#9ca3af' }}>
                  You'll be redirected to Stripe to complete payment. Your org is created first so your data is saved.
                </p>
              )}
            </form>
          </div>
        )}

        <p className="text-center text-xs mt-6" style={{ color: '#9ca3af' }}>
          Signed in as {user?.email}
        </p>
      </div>
    </div>
  )
}

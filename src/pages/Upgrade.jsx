/**
 * Upgrade — for existing users who want to upgrade their org's tier.
 * Shows plan picker (billing toggle), then sends user straight to Stripe
 * with their org ID pre-filled as client_reference_id.
 * Does NOT ask for org name — they already have one.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'

const STRIPE_LINKS = {
  pro_monthly:  'https://buy.stripe.com/test_14AfZgco5eGV25dePm2cg05',
  pro_yearly:   'https://buy.stripe.com/test_cNieVc1Jr9mB8tBaz62cg06',
  club_monthly: 'https://buy.stripe.com/test_28E14mgElfKZ6ltaz62cg07',
  club_yearly:  'https://buy.stripe.com/test_8x2fZgewdbuJdNV5eM2cg08',
}

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: '$9',
    yearlyPrice: '$90',
    sub: 'per month',
    yearSub: 'per year — save $18',
    features: [
      'Unlimited players',
      '3 leagues',
      'Online registration',
      'Public leaderboards & standings',
      'Score export (CSV)',
      'Custom course handicaps',
    ],
  },
  {
    id: 'club',
    name: 'Club',
    monthlyPrice: '$19',
    yearlyPrice: '$190',
    sub: 'per month',
    yearSub: 'per year — save $38',
    features: [
      'Everything in Pro',
      'Unlimited leagues',
      'Up to 3 admins',
      'Sponsor integration',
      'Priority support',
    ],
    highlight: true,
  },
]

export default function Upgrade() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [yearly,  setYearly]  = useState(false)
  const [orgId,   setOrgId]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setOrgId(data?.org_id ?? null)
        setLoading(false)
      })
  }, [user])

  function handleSelect(planId) {
    if (!orgId) return
    const key     = `${planId}_${yearly ? 'yearly' : 'monthly'}`
    const baseUrl = STRIPE_LINKS[key]
    window.location.href = `${baseUrl}?client_reference_id=${orgId}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9fafb' }}>
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-16 px-4" style={{ background: '#f9fafb' }}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
            Upgrade Your Plan
          </h1>
          <p className="text-gray-500 mt-2">Choose the plan that fits your league.</p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`text-sm font-medium ${!yearly ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
            <button
              onClick={() => setYearly(y => !y)}
              className={`relative w-12 h-6 rounded-full transition-colors ${yearly ? 'bg-green-700' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${yearly ? 'translate-x-6' : ''}`} />
            </button>
            <span className={`text-sm font-medium ${yearly ? 'text-gray-900' : 'text-gray-400'}`}>
              Yearly <span className="text-green-700 font-semibold">Save ~17%</span>
            </span>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 shadow-md border-2 flex flex-col ${plan.highlight ? 'border-yellow-400 bg-white' : 'border-gray-200 bg-white'}`}
            >
              {plan.highlight && (
                <div className="text-xs font-bold uppercase tracking-widest mb-3 text-center" style={{ color: GOLD }}>
                  Most Popular
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
              <div className="mt-2 mb-1">
                <span className="text-3xl font-extrabold text-gray-900">
                  {yearly ? plan.yearlyPrice : plan.monthlyPrice}
                </span>
                <span className="text-gray-400 text-sm ml-1">{yearly ? plan.yearSub : plan.sub}</span>
              </div>

              <ul className="mt-4 space-y-2 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 mt-0.5 shrink-0 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(plan.id)}
                className="mt-6 w-full py-3 rounded-xl font-bold text-white text-sm transition-opacity hover:opacity-90"
                style={{ background: plan.highlight ? GOLD : GREEN }}
              >
                Upgrade to {plan.name}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          3-day free trial included. Cancel anytime.{' '}
          <a href="/refund-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">Refund policy</a>
          {' · '}
          <button onClick={() => navigate(-1)} className="underline hover:text-gray-600">Go back</button>
        </p>
      </div>
    </div>
  )
}

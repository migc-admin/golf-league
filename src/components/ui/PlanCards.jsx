// Detailed pricing cards for Starter, Pro, and Club with a monthly/yearly
// switch. Content comes from src/lib/planComparison.js; prices from plans.js.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PLAN_DETAILS } from '../../lib/planComparison'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'
const INK   = '#1d1d1f'
const MUTED = '#6b7280'
const LINE  = '#ebe9e4'

export default function PlanCards() {
  const [yearly, setYearly] = useState(false)
  const bestSaving = Math.max(...PLAN_DETAILS.map(d => (d.plan.price ? 1 - d.plan.yearlyPrice / (d.plan.price * 12) : 0)))

  return (
    <div>
      {/* Billing switch */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-full p-1" style={{ background: '#f1efea' }} role="group" aria-label="Billing period">
          {[['Monthly', false], [`Yearly · save up to ${Math.round(bestSaving * 100)}%`, true]].map(([label, val]) => (
            <button key={label} type="button" onClick={() => setYearly(val)} aria-pressed={yearly === val}
              className="min-h-[44px] px-4 rounded-full text-sm font-bold transition-colors"
              style={yearly === val ? { background: '#fff', color: INK, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : { color: MUTED }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5 items-stretch">
        {PLAN_DETAILS.map(({ tier, plan, tagline, heading, items }) => {
          const free = plan.price === 0
          const featured = plan.isPopular
          const price = free ? '$0' : yearly ? `$${plan.yearlyPrice}` : `$${plan.price}`
          const per = free ? 'forever' : yearly ? 'per year' : 'per month'
          const sub = free ? 'No credit card required'
            : yearly ? `Saves $${plan.price * 12 - plan.yearlyPrice} vs. monthly` : `or $${plan.yearlyPrice} billed yearly`
          return (
            <div key={tier} className="relative flex flex-col rounded-2xl bg-white p-6 lg:p-7"
              style={{ border: featured ? `2px solid ${GREEN}` : `1px solid ${LINE}`, boxShadow: featured ? '0 18px 40px rgba(27,67,50,0.12)' : 'none' }}>
              {featured && (
                <span className="absolute -top-3 left-6 text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full" style={{ background: GOLD, color: '#1a1a1a' }}>
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-bold" style={{ color: INK }}>{plan.name}</h3>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="text-4xl font-bold" style={{ color: INK, fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.02em' }}>{price}</span>
                <span className="text-sm" style={{ color: MUTED }}>{per}</span>
              </p>
              <p className="text-xs mt-1" style={{ color: MUTED }}>{sub}</p>
              <p className="text-sm mt-4 mb-5 md:min-h-[2.5rem]" style={{ color: '#374151' }}>{tagline}</p>

              <Link to={plan.href} className="flex min-h-[44px] items-center justify-center text-center px-5 rounded-full font-bold text-sm transition-opacity hover:opacity-90"
                style={featured ? { background: GREEN, color: '#fff' } : { border: `1.5px solid ${GREEN}`, color: GREEN }}>
                {plan.buttonText}
              </Link>

              <p className="text-[11px] font-bold uppercase tracking-widest mt-6 mb-3" style={{ color: MUTED }}>{heading}</p>
              <ul className="space-y-3.5">
                {items.map(it => (
                  <li key={it.title} className="flex gap-2.5">
                    <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                    <span>
                      <span className="block text-sm font-semibold" style={{ color: INK }}>{it.title}</span>
                      <span className="block text-xs leading-relaxed mt-0.5" style={{ color: MUTED }}>{it.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

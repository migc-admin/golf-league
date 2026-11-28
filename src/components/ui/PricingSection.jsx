// Plan cards (monthly/annual toggle) plus the one-time Tournament and Golf Trip
// packages. Shared by the homepage pricing section and the /pricing page, so
// both always show the same plans. Prices live in src/lib/plans.js.
import { Link } from 'react-router-dom'
import PlanCards from './PlanCards'
import { ONE_TIME } from '../../lib/plans'

const GREEN = '#1B4332'
const INK   = '#1d1d1f'

export default function PricingSection({ eyebrow = true }) {
  return (
    <>
      {eyebrow && (
        <div className="text-center mb-2">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>Pricing</p>
        </div>
      )}
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: INK }}>
          Simple, transparent pricing
        </h2>
        <p className="mt-3 text-base" style={{ color: '#6b7280' }}>Start free. Upgrade when your league grows.</p>
        <p className="mt-2 text-sm max-w-xl mx-auto" style={{ color: '#6b7280' }}>
          Scorify is built for independent league organizers, most running 10 to 60 players — not country clubs or tournament companies.
        </p>
      </div>
      <PlanCards />

      {/* One-time options */}
      <div style={{ borderTop: '1px solid #ebe9e4', paddingTop: '3rem', marginTop: '4rem' }}>
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#9ca3af' }}>One-Time Purchases</p>
          <h3 className="text-2xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: INK }}>
            Just need it for one event?
          </h3>
          <p className="text-sm mt-2" style={{ color: '#6b7280' }}>No subscription. Pay once, use it for your event.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {ONE_TIME.map(opt => (
            <div key={opt.name} className="rounded-2xl p-7 flex flex-col" style={{ border: '1px solid #ebe9e4', background: '#fbfaf8' }}>
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#9ca3af' }}>{opt.name}</p>
                <div className="flex flex-col">
                  <span className="text-3xl font-bold" style={{ color: INK, fontFamily: "'Manrope', sans-serif" }}>{opt.price}</span>
                  <span className="text-sm font-semibold mt-1" style={{ color: '#92611a' }}>{opt.sub}</span>
                </div>
              </div>
              <p className="text-sm mb-4 leading-relaxed" style={{ color: '#6b7280' }}>{opt.description}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {opt.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#4b5563' }}>
                    <svg className="mt-0.5 shrink-0" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: GREEN }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {opt.ctaTo.startsWith('mailto') ? (
                <a href={opt.ctaTo}
                  className="block text-center py-3 rounded-full font-bold text-sm transition-opacity hover:opacity-90"
                  style={{ background: GREEN, color: '#fff' }}>
                  {opt.cta}
                </a>
              ) : (
                <Link to={opt.ctaTo}
                  className="block text-center py-3 rounded-full font-bold text-sm transition-opacity hover:opacity-90"
                  style={{ background: GREEN, color: '#fff' }}>
                  {opt.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

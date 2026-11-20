// Shared bits for the homepage "Try it" round demo.
export const GREEN = '#1B4332'
export const GOLD  = '#D4AF37'
export const INK   = '#1d1d1f'
export const MUTED = '#6b7280'
export const LINE  = '#ebe9e4'
export const WIN   = '#15803d'

export function FlightBadge({ flight }) {
  const a = flight === 'A'
  return (
    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
      style={a ? { background: '#eff6ff', color: '#1d4ed8' } : { background: '#faf5ff', color: '#7e22ce' }}>
      {flight}
    </span>
  )
}

/** White panel used for every step's content. */
export function Panel({ title, aside, children, className = '' }) {
  return (
    <div className={`rounded-2xl bg-white overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: `1px solid ${LINE}` }}>
          <p className="font-bold text-sm" style={{ color: INK }}>{title}</p>
          {aside}
        </div>
      )}
      {children}
    </div>
  )
}

/** Shown on Payouts/Standings until all three holes are scored. */
export function NeedsScores({ onFill, onGoScore }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-bold mb-2" style={{ color: INK }}>Finish the round first</p>
      <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: MUTED }}>
        Payouts and standings settle the moment the last score is in. Score the holes yourself, or let us fill in the rest.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <button type="button" onClick={onFill} className="text-sm font-bold px-5 py-2.5 rounded-full text-white" style={{ background: INK }}>
          Fill in the round for me
        </button>
        <button type="button" onClick={onGoScore} className="text-sm font-bold px-5 py-2.5 rounded-full" style={{ border: `1px solid ${LINE}`, color: INK }}>
          Score it myself
        </button>
      </div>
    </div>
  )
}

/** Plausible scores for "Fill in for me", per hole, in DEMO_GROUP order. */
export const SAMPLE = { 1: [5, 4, 4, 6], 2: [3, 3, 4, 3], 3: [6, 5, 6, 5] }

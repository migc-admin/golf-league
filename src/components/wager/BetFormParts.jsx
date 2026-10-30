/**
 * Parts of the public bet form (presentation only). The page keeps all the state and the submit
 * handler; these just render a pick: the bet-type switch, the player or match, and the $5 stepper.
 * Tap targets are 48px on this phone-first page.
 */

import { MIN_BET, STEP, amountOf, stepAmount, snapAmount } from '../../lib/betAmount'

export const fmt = n => `$${Number(n).toFixed(2)}`

const field = 'h-12 w-full rounded-sm border border-surface-highest bg-white px-3 text-[15px] text-ink placeholder:text-ink-muted focus:border-fairway-700 focus:outline-none focus:ring-2 focus:ring-fairway-500'

export const TYPES = [
  { value: 'win',   label: 'WIN',   hint: 'Low net' },
  { value: 'place', label: 'PLACE', hint: 'Top 2' },
  { value: 'match', label: 'MATCH', hint: 'Head-to-head' },
]

export function PickTypeToggle({ value, onChange, withMatch }) {
  const options = withMatch ? TYPES : TYPES.slice(0, 2)
  return (
    <div role="group" aria-label="Bet type" className="flex overflow-hidden rounded-sm border border-surface-highest bg-white">
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
            className={`flex min-h-[52px] flex-1 flex-col items-center justify-center px-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 ${i > 0 ? 'border-l border-surface-highest' : ''} ${on ? 'bg-fairway-700 text-white' : 'bg-white text-ink hover:bg-surface-dim'}`}
          >
            <span className="text-sm font-bold">{o.label}</span>
            <span className={`text-[11px] ${on ? 'text-fairway-200' : 'text-ink-muted'}`}>{o.hint}</span>
          </button>
        )
      })}
    </div>
  )
}

export function AmountStepper({ value, onChange, id }) {
  const n = amountOf(value)
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-ink-muted">Amount</label>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Decrease by $5" disabled={n <= MIN_BET} onClick={() => onChange(stepAmount(value, -1))}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-surface-highest bg-white text-xl font-semibold text-ink hover:bg-surface-dim disabled:cursor-not-allowed disabled:text-ink-muted disabled:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500">−</button>
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-ink-muted">$</span>
          <input
            id={id} type="text" inputMode="numeric" pattern="[0-9]*" value={value}
            onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => onChange(snapAmount(value))}
            aria-describedby={`${id}-help`}
            className={`${field} pl-7 text-center font-bold tabular-nums`}
          />
        </div>
        <button type="button" aria-label="Increase by $5" onClick={() => onChange(stepAmount(value, 1))}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-surface-highest bg-white text-xl font-semibold text-ink hover:bg-surface-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500">+</button>
      </div>
      <p id={`${id}-help`} className="mt-1 text-xs text-ink-muted">Minimum ${MIN_BET}, in ${STEP} steps</p>
    </div>
  )
}

export function PickCard({ index, canRemove, onRemove, children }) {
  return (
    <div className="rounded-sm border border-surface-border bg-surface-dim p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Pick {index + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500">Remove</button>
        )}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

export const selectClass = field
export const labelClass = 'mb-1 block text-xs font-semibold text-ink-muted'

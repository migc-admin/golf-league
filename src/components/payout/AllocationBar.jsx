/**
 * AllocationBar — sticks to the bottom of the Setup tab: how much of the pot is allocated, whether
 * it balances, a stacked bar by Flight A / Flight B / Full field, and the Save button.
 *
 *   $798.00 allocated of $798.00   ✓ Balanced        [ ████ A ██ B █ field ]   [Save payout setup]
 *
 * Presentational: `allocated`, `pot` and `segments` are worked out by the page from the config being
 * edited (same arithmetic as the old "Allocated" line). Colors are existing tokens: forest green
 * (Flight A), a lighter green (Flight B), gold text tint (Full field). When `locked` the Save button is gone.
 */

import { ActionButton } from '../ui/Button'
import { allocation, money } from '../../lib/payoutView'

const SEGMENTS = [
  { key: 'flightA', label: 'Flight A',   dot: 'bg-fairway-700' },
  { key: 'flightB', label: 'Flight B',   dot: 'bg-fairway-300' },
  { key: 'other',   label: 'Other flights', dot: 'bg-surface-outline' },
  { key: 'field',   label: 'Full field', dot: 'bg-status-upcoming-text' },
]

function StatusIcon({ status }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {status === 'balanced' ? <path d="M5 12l5 5L20 7" /> : <path d="M12 8v5M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />}
    </svg>
  )
}

export default function AllocationBar({ allocated, pot, segments, onSave, saving = false, locked = false, className = '' }) {
  const a = allocation(pot, allocated)
  const scale = Math.max(Number(pot) || 0, Number(allocated) || 0) || 1
  const shown = SEGMENTS.filter(s => (segments[s.key] ?? 0) > 0)
  const summary = `Allocated ${money(allocated)} of ${money(pot)}. ${shown.map(s => `${s.label} ${money(segments[s.key])}`).join(', ') || 'Nothing allocated yet'}.`

  return (
    <div className={`sticky bottom-0 z-10 -mx-4 border-t border-surface-border bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] sm:mx-0 sm:rounded-sm sm:border ${className}`.trim()}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-sm font-semibold tabular-nums text-ink">{money(allocated)} allocated of {money(pot)}</p>
            <p className={`inline-flex items-center gap-1 text-sm font-semibold ${a.status === 'balanced' ? 'text-status-active-text' : 'text-status-upcoming-text'}`}>
              <StatusIcon status={a.status} />
              {a.text}
            </p>
          </div>
          <div role="img" aria-label={summary} className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-high">
            {shown.map(s => (
              <div key={s.key} className={s.dot} style={{ width: `${(segments[s.key] / scale) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            {shown.map(s => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${s.dot}`} />
                {s.label} <span className="tabular-nums">{money(segments[s.key])}</span>
              </li>
            ))}
          </ul>
        </div>
        {!locked && <ActionButton loading={saving} onClick={onSave} className="shrink-0">Save payout setup</ActionButton>}
      </div>
    </div>
  )
}

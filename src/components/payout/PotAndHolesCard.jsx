/**
 * PotAndHolesCard — "Pot & contest holes": three areas side by side (stacked on phones):
 *   1. Prize pool: "By attendance" (pot contribution × players) or a "Fixed total".
 *   2. Long drive hole (highlighted on scorecards) — only when the event has Long Drive.
 *   3. Closest to pin holes as removable chips + a hole box + Add + "Add all par 3s" — only with CTP.
 *
 * Presentational and controlled; every handler is the page's existing one (pot mode, long drive hole,
 * add / remove CTP hole, auto-add par 3s). When `locked` (event complete) everything is read-only and
 * the chip ×, Add and Add-all buttons are hidden.
 */

import { useId } from 'react'
import { ActionButton } from '../ui/Button'
import { money } from '../../lib/payoutView'

function Area({ title, children }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </div>
  )
}

export default function PotAndHolesCard({
  locked = false,
  basis, onBasis, fixedTotal, onFixedTotal, attendancePot, potContribution, playerCount,
  hasLongDrive, longDriveHole, onLongDriveHole,
  hasCtp, ctpHoles, onRemoveHole, ctpInput, onCtpInput, onAddHole, canAddPar3s, onAddAllPar3s,
  className = '',
}) {
  const fixedId = useId()
  const ldId = useId()
  const holeId = useId()
  const areas = 1 + (hasLongDrive ? 1 : 0) + (hasCtp ? 1 : 0)

  return (
    <section id="pot-holes" className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-4">
        <h2 className="text-lg font-bold text-ink">Pot &amp; contest holes</h2>
        <p className="mt-0.5 text-sm text-ink-muted">How big the prize pool is, and which holes the contests are on.</p>
      </header>

      <div className={`grid gap-6 ${areas === 3 ? 'md:grid-cols-3' : areas === 2 ? 'md:grid-cols-2' : ''}`}>
        <Area title="Prize pool">
          <div role="radiogroup" aria-label="How the prize pool is set" className="space-y-1">
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3 py-2 text-sm text-ink">
              <input type="radio" name="payout-basis" className="mt-0.5 h-5 w-5 accent-fairway-700" checked={basis === 'per_player'} disabled={locked} onChange={() => onBasis('per_player')} />
              <span>
                By attendance
                <span className="block text-xs text-ink-muted">Pot contribution × players = <strong className="tabular-nums">{money(attendancePot)}</strong> ({playerCount} × {money(potContribution)})</span>
              </span>
            </label>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 py-2 text-sm text-ink">
              <input type="radio" name="payout-basis" className="h-5 w-5 accent-fairway-700" checked={basis === 'fixed'} disabled={locked} onChange={() => onBasis('fixed')} />
              Fixed total
            </label>
          </div>
          {basis === 'fixed' && (
            <label htmlFor={fixedId} className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
              Total pot $
              <input id={fixedId} type="number" min="0" step="1" value={fixedTotal} disabled={locked} placeholder="e.g. 500"
                onChange={e => onFixedTotal(e.target.value)}
                className="input h-11 w-32 tabular-nums disabled:cursor-not-allowed disabled:bg-surface-container disabled:text-ink-muted" />
            </label>
          )}
        </Area>

        {hasLongDrive && (
          <Area title="Long drive hole">
            <input id={ldId} type="number" min="1" max="18" value={longDriveHole} disabled={locked} placeholder="Hole #"
              aria-label="Long drive hole number" onChange={e => onLongDriveHole(e.target.value)}
              className="input h-11 w-28 tabular-nums disabled:cursor-not-allowed disabled:bg-surface-container disabled:text-ink-muted" />
            <p className="mt-2 text-xs text-ink-muted">Highlighted on scorecards.</p>
          </Area>
        )}

        {hasCtp && (
          <Area title="Closest to pin holes">
            <div className="mb-3 flex flex-wrap gap-2">
              {ctpHoles.length === 0 && <p className="text-xs text-ink-muted">No holes yet. Add them below.</p>}
              {ctpHoles.map(h => (
                <span key={h} className="inline-flex items-center gap-1 rounded-full bg-status-active-bg py-1 pl-3 pr-1 text-xs font-semibold text-status-active-text">
                  Hole {h}
                  {!locked && (
                    <button type="button" aria-label={`Remove hole ${h}`} onClick={() => onRemoveHole(h)}
                      className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!locked && (
              <div className="flex flex-wrap items-center gap-2">
                <input id={holeId} type="number" min="1" max="18" value={ctpInput} placeholder="Hole #" aria-label="Closest to pin hole number"
                  onChange={e => onCtpInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onAddHole())}
                  className="input h-11 w-24 tabular-nums" />
                <ActionButton onClick={onAddHole}>Add</ActionButton>
                {canAddPar3s && <ActionButton variant="ghost" onClick={onAddAllPar3s}>Add all par 3s</ActionButton>}
              </div>
            )}
          </Area>
        )}
      </div>
    </section>
  )
}

/**
 * FlightsTeesCard — "Flights & tees" card on the Players page.
 *
 *   Flights & tees
 *   Choose which tees each flight plays from.
 *   ┌ Flight A ──── 3 players ┐  ┌ Flight B ──── 1 players ┐
 *   │ Tees [ Not assigned  v ]│  │ Tees [ Not assigned  v ]│
 *   └─────────────────────────┘  └─────────────────────────┘
 *
 * Presentational. The page passes one panel per flight (or a single panel when the
 * event has no flights) with the current tee and the existing change handler, so the
 * tee-assignment logic is untouched. Panels sit side by side and stack on narrow screens.
 *
 * Panel: { key, title, count?, value, onChange(teeName) }
 * Tee:   { name, color?, slope, rating }  — option text matches the old dropdown.
 */

import { useId } from 'react'

export function teeOptionLabel(t) {
  return `${t.name}${t.color ? ` (${t.color})` : ''} — Slope ${t.slope} / Rating ${t.rating}`
}

function TeePanel({ panel, tees }) {
  const selectId = useId()
  return (
    <div className="rounded-sm border border-surface-border bg-surface-container p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-ink">{panel.title}</h3>
        {panel.count != null && (
          <span className="text-xs text-ink-muted">{panel.count} player{panel.count !== 1 ? 's' : ''}</span>
        )}
      </div>
      <label htmlFor={selectId} className="label mt-3">Tees</label>
      <select
        id={selectId}
        className="input bg-white"
        value={panel.value ?? ''}
        onChange={e => panel.onChange(e.target.value)}
        aria-label={`Tees for ${panel.title}`}
      >
        <option value="">Not assigned</option>
        {tees.map(t => (
          <option key={t.name} value={t.name}>{teeOptionLabel(t)}</option>
        ))}
      </select>
    </div>
  )
}

export default function FlightsTeesCard({ id = 'flights-tees', panels, tees, useFlights = true, className = '' }) {
  return (
    <section id={id} className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-4">
        <h2 className="text-lg font-bold text-ink">Flights &amp; tees</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          {useFlights ? 'Choose which tees each flight plays from.' : 'Choose which tees players play from.'}
        </p>
      </header>
      <div className={`grid gap-4 ${panels.length > 1 ? 'sm:grid-cols-2' : 'max-w-sm'}`}>
        {panels.map(p => <TeePanel key={p.key} panel={p} tees={tees} />)}
      </div>
    </section>
  )
}

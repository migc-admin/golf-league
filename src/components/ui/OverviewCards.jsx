/**
 * OverviewCards — the two summary cards beside each other on the Overview page.
 *
 *   EventDetailsCard   label-over-value grid (3 columns, 2 below ~700px) + an Edit button
 *   ParticipantsCard   2×2 stat tiles + a "View players" button
 *
 * Purely presentational: the page decides which fields/stats to pass and wires the
 * buttons. Values that are missing render as an em dash. `formatMoney` gives every
 * currency value the same look ($165.00).
 */

import { ActionButton } from './Button'

export function formatMoney(n) {
  const v = Number(n)
  return Number.isFinite(v) ? `$${v.toFixed(2)}` : '—'
}

function CardShell({ id, title, action, children, className = '' }) {
  return (
    <section id={id} className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

export function EventDetailsCard({ id = 'event-details', fields, onEdit, className = '' }) {
  return (
    <CardShell
      id={id}
      title="Event details"
      className={className}
      action={onEdit && <ActionButton size="sm" onClick={onEdit}>Edit</ActionButton>}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 min-[700px]:grid-cols-3">
        {fields.map(f => (
          <div key={f.label} className="min-w-0">
            <dt className="text-xs text-ink-muted">{f.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{f.value ?? '—'}</dd>
            {f.helper && <p className="mt-0.5 text-xs text-ink-muted">{f.helper}</p>}
          </div>
        ))}
      </dl>
    </CardShell>
  )
}

export function ParticipantsCard({ id = 'players-summary', stats, onViewPlayers, className = '' }) {
  return (
    <CardShell
      id={id}
      title="Participants"
      className={className}
      action={onViewPlayers && <ActionButton size="sm" onClick={onViewPlayers}>View players</ActionButton>}
    >
      <div className="grid grid-cols-2 gap-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-sm bg-surface-container px-4 py-3">
            <p className="text-xs text-ink-muted">{s.label}</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-ink">{s.value ?? '—'}</p>
            {s.helper && <p className="mt-0.5 text-xs text-ink-muted">{s.helper}</p>}
          </div>
        ))}
      </div>
    </CardShell>
  )
}

import EventCard from './EventCard'

function Side({ name, strokes }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 truncate text-[15px] font-bold text-ink">{name}</span>
      {strokes > 0 && <span className="shrink-0 text-xs font-semibold text-ink-muted tabular-nums">+{strokes}</span>}
    </div>
  )
}

/**
 * Matchups card. Only rendered when match pairings exist.
 * Props: rows (from matchupRows), subtitle (e.g. "Team A vs Team B"), onSeePairings.
 */
export default function MatchupsCard({ rows, subtitle, onSeePairings }) {
  if (!rows?.length) return null
  return (
    <EventCard title="Matchups">
      {subtitle && <p className="-mt-1 mb-3 text-sm text-ink-muted">{subtitle}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map(r => (
          <li key={r.id} className="rounded-sm border border-surface-border bg-surface-dim p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Match {r.number}</div>
            <Side {...r.a} />
            <div className="my-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted" aria-hidden="true">vs</div>
            <Side {...r.b} />
          </li>
        ))}
      </ul>
      {onSeePairings && (
        <button
          type="button"
          onClick={onSeePairings}
          className="mt-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-fairway-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500"
        >
          Tee times &amp; pairings →
        </button>
      )}
    </EventCard>
  )
}

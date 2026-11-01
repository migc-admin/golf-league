/**
 * InsightsGrid — the "Insights" tab: season records and averages as a grid of small cards
 * (label, bold headline, green detail line). Presentational over seasonInsights().
 */
export default function InsightsGrid({ cards }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(c => (
        <li key={c.key} className="flex flex-col justify-between rounded-sm border border-surface-border bg-white p-5 shadow-card">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{c.label}</div>
          <div className="mt-2 text-xl font-bold leading-snug text-ink">{c.title}</div>
          <div className="mt-1 text-sm font-medium text-fairway-700">{c.sub}</div>
        </li>
      ))}
    </ul>
  )
}

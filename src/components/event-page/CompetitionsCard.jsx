import EventCard from './EventCard'

/**
 * Competitions & side games. `groups` comes from competitionGroups(event): only what the
 * event actually has enabled, empty groups already dropped.
 */
export default function CompetitionsCard({ groups }) {
  if (!groups?.length) return null
  return (
    <EventCard title="Competitions & side games">
      <div className="flex flex-col gap-5">
        {groups.map(g => (
          <div key={g.title}>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">{g.title}</h3>
            <ul className="divide-y divide-surface-border">
              {g.rows.map(r => (
                <li key={r.title} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold text-ink">
                      {r.title}
                      {r.detail && <span className="font-normal text-ink-muted"> ({r.detail})</span>}
                    </span>
                    {r.sepEntry && (
                      <span className="rounded-full border border-fairway-200 bg-fairway-50 px-2 py-0.5 text-[11px] font-semibold text-fairway-700">
                        Separate entry
                      </span>
                    )}
                  </div>
                  {r.variants.length > 0 && (
                    <span className="text-sm text-ink-muted">{r.variants.join(' · ')}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </EventCard>
  )
}

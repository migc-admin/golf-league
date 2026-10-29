import EventCard from './EventCard'
import { dedupeSponsors } from '../../lib/eventPageView'

function Tile({ sponsor }) {
  const inner = (
    <div className="flex aspect-[3/2] w-full items-center justify-center rounded-sm border border-surface-border bg-surface-dim p-3">
      {sponsor.logo_url ? (
        <img src={sponsor.logo_url} alt={sponsor.name ?? 'Sponsor'} className="max-h-full max-w-full object-contain" loading="lazy" />
      ) : (
        <span className="text-center text-sm font-bold text-ink">{sponsor.name}</span>
      )}
    </div>
  )
  return sponsor.url ? (
    <a href={sponsor.url} target="_blank" rel="noopener noreferrer" aria-label={sponsor.name ?? 'Sponsor'}
      className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500">
      {inner}
    </a>
  ) : inner
}

/** "Sponsored by" logo tiles (3:2). Repeats are removed; hidden when there are no sponsors. */
export default function SponsorsCard({ sponsors }) {
  const list = dedupeSponsors(sponsors)
  if (list.length === 0) return null
  return (
    <EventCard title="Sponsored by">
      <ul className="grid grid-cols-2 gap-3">
        {list.map((s, i) => <li key={`${s.name}-${i}`}><Tile sponsor={s} /></li>)}
      </ul>
    </EventCard>
  )
}

/**
 * TripItineraryCard — every meal, round, social event and check-in / check-out, grouped by day.
 *
 *   FRI    | 9:30 AM   GOLF    Sand Hollow
 *   Sep 11 | 3:00 PM   STAY    Check-in · Zion Canyon Mist Resort House
 *
 * Presentational: the days come from buildItinerary (lib/tripItinerary.js).
 */
import SectionCard from '../ui/SectionCard'
import { ActionButton } from '../ui/Button'
import { time12 } from '../../lib/tripItinerary'

export const TAGS = {
  GOLF:   { label: 'Golf',   cls: 'bg-status-active-bg text-status-active-text' },
  MEAL:   { label: 'Meal',   cls: 'bg-status-upcoming-bg text-status-upcoming-text' },
  SOCIAL: { label: 'Social', cls: 'bg-surface-high text-ink-muted' },
  STAY:   { label: 'Stay',   cls: 'border border-surface-highest bg-white text-ink-muted' },
}

export function TypeTag({ tag }) {
  const t = TAGS[tag]
  if (!t) return null
  return (
    <span className={`inline-flex h-5 w-[58px] shrink-0 items-center justify-center rounded-sm text-[10px] font-bold uppercase tracking-wide ${t.cls}`}>
      {t.label}
    </span>
  )
}

function Legend() {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {Object.keys(TAGS).map(k => (
        <span key={k} className="inline-flex items-center gap-1.5"><TypeTag tag={k} /></span>
      ))}
    </span>
  )
}

function dayParts(date) {
  const d = new Date(`${date}T00:00:00`)
  return {
    abbr: d.toLocaleDateString('en-US', { weekday: 'short' }),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    num: d.getDate(),
  }
}

function Row({ item }) {
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
      <span className={`w-[76px] shrink-0 pt-px text-sm font-semibold tabular-nums ${item.time ? 'text-fairway-700' : 'text-ink-muted font-medium'}`}>
        {item.time ? time12(item.time) : 'Time TBD'}
      </span>
      <span className="pt-px">{item.tag ? <TypeTag tag={item.tag} /> : <span className="inline-block w-[58px]" aria-hidden="true" />}</span>
      <span className="min-w-[140px] flex-1">
        <span className="block text-sm font-bold text-ink">{item.title}</span>
        {item.sub && <span className="block text-xs text-ink-muted">{item.sub}</span>}
      </span>
    </li>
  )
}

/** The day-by-day timeline itself, read-only. Shared by the admin card and the public trip page. */
export function ItineraryDays({ days, emptyText }) {
  if (days.length === 0) return <p className="text-sm text-ink-muted">{emptyText}</p>
  return (
    <div className="divide-y divide-surface-border">
      {days.map((day, i) => {
        const p = day.date ? dayParts(day.date) : null
        return (
          <section key={day.date ?? `tbd-${i}`} className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-x-4">
            <div>
              {p ? (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-fairway-700">{p.abbr}</p>
                  <p className="text-2xl font-bold leading-none text-ink tabular-nums">{p.num}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{p.month}</p>
                </>
              ) : (
                <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">Date TBD</p>
              )}
            </div>
            <div className="min-w-0 border-l-2 border-fairway-200 pl-3 sm:pl-4">
              {day.items.length === 0
                ? <p className="py-2 text-sm text-ink-muted">Nothing scheduled</p>
                : <ul>{day.items.map(item => <Row key={item.key} item={item} />)}</ul>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default function TripItineraryCard({ days, onAddItem }) {
  return (
    <SectionCard
      title="Itinerary"
      subtitle={<Legend />}
      headerAction={<ActionButton variant="secondary" onClick={onAddItem}>+ Add item</ActionButton>}
    >
      <ItineraryDays days={days} emptyText="Nothing scheduled yet. Add meals, social events and lodging, or add a round below." />
    </SectionCard>
  )
}

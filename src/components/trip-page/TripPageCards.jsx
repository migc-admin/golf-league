/**
 * The body cards of the public trip page. All read-only, all built on the event page's EventCard.
 */
import { Link } from 'react-router-dom'
import EventCard from '../event-page/EventCard'
import Button from '../ui/Button'
import { ItineraryDays } from '../trip/TripItineraryCard'
import { time12 } from '../../lib/tripItinerary'
import { mapEmbedUrl } from '../../lib/eventPageView'
import { airportRowName, shortDistance, initials } from '../../lib/tripView'

export function RoundsCard({ rounds, leagueSlug, orgSlug, onStandings }) {
  if (rounds.length === 0) return null
  return (
    <EventCard
      title="Rounds"
      aside={<button type="button" onClick={onStandings} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-fairway-700 underline">Trip standings →</button>}
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {rounds.map(ev => {
          const d = ev.event_date ? new Date(`${ev.event_date}T00:00:00`) : null
          const to = orgSlug ? `/${orgSlug}/${leagueSlug}/${ev.slug}/event` : `/${leagueSlug}/${ev.slug}`
          return (
            <li key={ev.id} className="flex items-start gap-3 rounded-sm border border-surface-border p-3">
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-sm bg-fairway-50 text-fairway-700">
                {d && <span className="text-[10px] font-bold uppercase tracking-wide">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>}
                {d && <span className="text-xl font-extrabold leading-none tabular-nums">{d.getDate()}</span>}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-ink">{ev.name || `Event #${ev.event_number}`}</p>
                {ev.course?.name && <p className="text-sm text-ink-muted">{ev.course.name}</p>}
                {ev.slug && (
                  <Link to={to} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-fairway-700 hover:underline">
                    Event page, pairings &amp; results →
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </EventCard>
  )
}

export function ScheduleCard({ days }) {
  return (
    <EventCard title="Schedule">
      <ItineraryDays days={days} emptyText="Nothing scheduled yet." />
    </EventCard>
  )
}

function TimeBox({ label, date, time }) {
  const day = date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null
  return (
    <div className="rounded-sm border border-surface-border bg-surface-container px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">{label}</p>
      {day ? (
        <>
          <p className="mt-1 text-sm font-bold text-ink">{day}</p>
          <p className="text-xs text-ink-muted">{time ? time12(time) : 'Time TBD'}</p>
        </>
      ) : <p className="mt-1 text-sm text-ink-muted">Not set</p>}
    </div>
  )
}

export function StayingCard({ lodging }) {
  const l = lodging ?? {}
  const has = !!(l.name || l.address || l.booking_company || l.checkin_date || l.checkout_date)
  if (!has) return null
  const embed = mapEmbedUrl(l.address)
  const mapsUrl = l.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address)}` : null
  const sub = [l.address, l.booking_company ? `Booked via ${l.booking_company}` : null].filter(Boolean).join(' · ')
  return (
    <EventCard title="Where we're staying" id="where-staying" className="scroll-mt-20">
      {embed && (
        <div className="mb-4 aspect-[16/10] w-full overflow-hidden rounded-sm border border-surface-border bg-surface-container">
          <iframe title="Lodging location map" src={embed} className="block h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      )}
      {l.name && <div className="text-[15px] font-bold text-ink">{l.name}</div>}
      {sub && <div className="mt-0.5 text-sm text-ink-muted">{sub}</div>}
      {(l.checkin_date || l.checkout_date) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <TimeBox label="Check-in" date={l.checkin_date} time={l.checkin_time} />
          <TimeBox label="Check-out" date={l.checkout_date} time={l.checkout_time} />
        </div>
      )}
      {mapsUrl && (
        <Button href={mapsUrl} target="_blank" rel="noopener noreferrer" icon="external" iconAfter size="lg" className="mt-4 w-full">Get directions</Button>
      )}
    </EventCard>
  )
}

export function GettingThereCard({ airports, travelInfo }) {
  const list = (airports ?? []).filter(a => a.code || a.name || a.distance)
  if (list.length === 0 && !travelInfo) return null
  return (
    <EventCard title="Getting there">
      {list.length > 0 && (
        <ul className="divide-y divide-surface-border">
          {list.map((a, i) => (
            <li key={i} className="flex items-baseline gap-3 py-2.5 first:pt-0 last:pb-0">
              {a.code && <span className="w-10 shrink-0 text-[15px] font-bold text-fairway-700">{a.code}</span>}
              <span className="min-w-0 flex-1 text-sm font-medium text-ink">{airportRowName(a.name)}</span>
              {a.distance && <span className="shrink-0 text-sm text-ink-muted">{shortDistance(a.distance)}</span>}
            </li>
          ))}
        </ul>
      )}
      {travelInfo && (
        <div className={list.length > 0 ? 'mt-3 border-t border-surface-border pt-3' : ''}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">Travel and transportation</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{travelInfo}</p>
        </div>
      )}
    </EventCard>
  )
}

export function WhosGoingCard({ names }) {
  if (names.length === 0) return null
  return (
    <EventCard title="Who's going" aside={<span className="text-sm font-semibold text-ink-muted">{names.length}</span>}>
      <ul className="flex flex-wrap gap-2">
        {names.map((n, i) => (
          <li key={`${n}-${i}`} className="inline-flex items-center gap-2 rounded-full bg-surface-dim py-1 pl-1 pr-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fairway-50 text-[10px] font-bold text-fairway-700" aria-hidden="true">{initials(n)}</span>
            <span className="text-sm font-medium text-ink">{n}</span>
          </li>
        ))}
      </ul>
    </EventCard>
  )
}

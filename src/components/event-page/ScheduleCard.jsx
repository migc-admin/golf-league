import EventCard from './EventCard'
import { time12 } from '../../lib/eventPageView'

/** Vertical timeline. `entries` comes from scheduleEntries(); null/empty hides the card. */
export default function ScheduleCard({ entries }) {
  if (!entries?.length) return null
  return (
    <EventCard title="Schedule">
      <ol>
        {entries.map((e, i) => {
          const last = i === entries.length - 1
          const when = e.timeLabel ?? time12(e.time)
          return (
            <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
              {!last && <span className="absolute left-[5px] top-4 bottom-0 w-px bg-surface-highest" aria-hidden="true" />}
              <span className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full bg-fairway-700" aria-hidden="true" />
              <div className="min-w-0">
                {when && <div className="text-sm font-bold text-fairway-700 tabular-nums">{when}</div>}
                <div className="text-[15px] font-bold text-ink">{e.label}</div>
                {e.description && <div className="mt-0.5 text-sm text-ink-muted">{e.description}</div>}
              </div>
            </li>
          )
        })}
      </ol>
    </EventCard>
  )
}

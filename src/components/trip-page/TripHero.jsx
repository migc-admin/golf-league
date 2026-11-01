/**
 * TripHero — the top of the public trip page, laid out like the public event page hero.
 *
 *   [GOLF TRIP] [Upcoming]                                  (cover photo, 4:3)
 *   Sand Valley 2026
 *   ───
 *   [cal]  Thu, Sep 10 – Mon, Sep 14, 2026 / 4 nights · 2 rounds
 *   [home] Zion Canyon Mist Resort House / Hurricane, UT · Directions
 *   [plane] Fly into SGU or LAS / St. George 23 mi · Las Vegas 144 mi
 *   [ TRIP STARTS IN  06 : 12 : 31 ]  9 golfers going · Check in ...   [See the schedule]
 *
 * Presentational. The countdown reuses getRemaining (the event page's tick logic).
 */
import { useEffect, useState } from 'react'
import { getRemaining } from '../Countdown'
import Button from '../ui/Button'
import { FactRow, CalendarIcon } from '../event-page/EventHero'

const HomeIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" />
  </svg>
)
const PlaneIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.5 13.5L3 11l1.5-1.5 9 .5 4.5-4.5a2 2 0 013 3L16.5 13l.5 9L15.5 23.5 13 16l-4 4-1-3z" transform="scale(0.9) translate(1 -1)" />
  </svg>
)

const STATUS = {
  upcoming: { label: 'Upcoming', cls: 'bg-status-upcoming-bg text-status-upcoming-text', dot: true },
  active:   { label: 'In progress', cls: 'bg-fairway-700 text-white' },
  complete: { label: 'Complete', cls: 'bg-fairway-700 text-white' },
}

function Unit({ value, label }) {
  return (
    <div className="flex min-w-[56px] flex-col items-center">
      <div className="text-[28px] font-extrabold leading-none text-white tabular-nums">{String(value).padStart(2, '0')}</div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-fairway-200">{label}</div>
    </div>
  )
}

function Countdown({ targetDate }) {
  const [remaining, setRemaining] = useState(() => getRemaining(targetDate))
  useEffect(() => {
    const tick = () => setRemaining(getRemaining(targetDate))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetDate])
  if (!remaining) return null
  const part = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
  return (
    <div className="bg-fairway-700 px-5 py-4 text-center" role="timer" aria-label={`${part(remaining.days, 'day')}, ${part(remaining.hours, 'hour')}, ${part(remaining.minutes, 'minute')} until the trip starts`}>
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-200" aria-hidden="true">Trip starts in</div>
      <div className="flex items-start justify-center gap-2 sm:gap-3" aria-hidden="true">
        <Unit value={remaining.days} label="Days" />
        <Unit value={remaining.hours} label="Hrs" />
        <Unit value={remaining.minutes} label="Min" />
      </div>
    </div>
  )
}

function DayBand({ day, total }) {
  return (
    <div className="bg-fairway-700 px-5 py-4 text-center">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-200">Trip in progress</div>
      <div className="text-[28px] font-extrabold leading-none text-white tabular-nums">Day {day} of {total}</div>
    </div>
  )
}

function Cover({ src, alt, fallback }) {
  if (src) return <img src={src} alt={alt} className="block aspect-[4/3] w-full rounded-sm object-cover" />
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-sm bg-surface-high text-5xl font-extrabold text-ink-muted" aria-hidden="true">
      {fallback}
    </div>
  )
}

export default function TripHero({
  title, status, facts, coverUrl, targetDate, progress, goingCount, checkIn,
  onDirections, onSeeSchedule, onSeeStandings,
}) {
  const st = STATUS[status] ?? STATUS.upcoming
  return (
    <section className="border-b border-surface-border bg-white">
      <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-12 lg:py-10">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-fairway-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-fairway-700">Golf trip</span>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>
              {st.dot && <span className="h-2 w-2 rounded-full bg-status-upcoming-text" aria-hidden="true" />}
              {st.label}
            </span>
          </div>

          <div>
            <h1 className="text-[clamp(28px,6vw,44px)] font-extrabold leading-[1.08] text-ink" style={{ letterSpacing: '-0.03em' }}>{title}</h1>
            <div className="mt-3 h-1 w-11 rounded-full bg-status-upcoming-text" aria-hidden="true" />
          </div>

          <div className="flex flex-col gap-4">
            {facts.dates && (
              <FactRow icon={CalendarIcon}>
                <div className="text-[15px] font-bold text-ink">{facts.dates.title}</div>
                {facts.dates.sub && <div className="text-sm text-ink-muted">{facts.dates.sub}</div>}
              </FactRow>
            )}
            {facts.lodging && (
              <FactRow icon={HomeIcon}>
                <div className="text-[15px] font-bold text-ink">{facts.lodging.title}</div>
                <div className="text-sm text-ink-muted">
                  {facts.lodging.city}
                  {facts.lodging.city && <span aria-hidden="true"> · </span>}
                  <button type="button" onClick={onDirections} className="inline-flex min-h-[44px] items-center font-semibold text-fairway-700 underline sm:min-h-0">Directions</button>
                </div>
              </FactRow>
            )}
            {facts.fly && (
              <FactRow icon={PlaneIcon}>
                <div className="text-[15px] font-bold text-ink">{facts.fly.title}</div>
                {facts.fly.sub && <div className="text-sm text-ink-muted">{facts.fly.sub}</div>}
              </FactRow>
            )}
          </div>

          {status === 'complete' ? (
            <Button type="button" size="lg" className="w-full self-start sm:w-auto" onClick={onSeeStandings}>See trip standings →</Button>
          ) : (
            <div className="overflow-hidden rounded-sm border border-surface-border bg-white">
              {status === 'active' && progress ? <DayBand day={progress.day} total={progress.total} /> : targetDate && <Countdown targetDate={targetDate} />}
              <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[15px] font-bold text-ink">{goingCount} golfer{goingCount === 1 ? '' : 's'} going</div>
                  {checkIn && <div className="text-sm text-ink-muted">{checkIn}</div>}
                </div>
                <Button type="button" size="lg" className="w-full sm:w-auto" onClick={onSeeSchedule}>See the schedule</Button>
              </div>
            </div>
          )}
        </div>

        <Cover src={coverUrl} alt={`${title} cover photo`} fallback={String(title ?? '').slice(0, 2).toUpperCase()} />
      </div>
    </section>
  )
}

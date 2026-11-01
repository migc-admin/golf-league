/**
 * SeasonHero — the top of the public league page, laid out like the trip and event page heroes.
 *
 *   [SEASON 2026]                                    ┌ [NOV 15] NEXT EVENT            ┐
 *   Season standings                                 │          Playoffs – Round 2    │
 *   ───                                              │          Twin Oaks · ...  Register →
 *   6 events played · 37 players in the money        └────────────────────────────────┘
 *
 * Presentational. `next` is { mon, day, name, sub, href, cta } or null (card hidden).
 */
import { Link } from 'react-router-dom'

function NextEventCard({ next }) {
  return (
    <div className="flex items-center gap-4 rounded-sm border border-fairway-700 bg-white p-4">
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-sm bg-fairway-700 text-white" aria-hidden="true">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-status-upcoming-bg">{next.mon}</span>
        <span className="text-xl font-extrabold leading-none tabular-nums">{next.day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">Next event</div>
        <div className="truncate text-[15px] font-bold text-ink">{next.name}</div>
        {next.sub && <div className="text-sm text-ink-muted">{next.sub}</div>}
      </div>
      <Link to={next.href} className="inline-flex min-h-[44px] shrink-0 items-center text-sm font-bold text-fairway-700 hover:underline">{next.cta}</Link>
    </div>
  )
}

export default function SeasonHero({ pill, title, meta, next }) {
  return (
    <section className="border-b border-surface-border bg-white">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10 lg:py-10">
        <div className="flex min-w-0 flex-col gap-4">
          {pill && (
            <span className="inline-flex items-center self-start rounded-full bg-fairway-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-fairway-700">{pill}</span>
          )}
          <div>
            <h1 className="text-[clamp(28px,6vw,44px)] font-extrabold leading-[1.08] text-ink" style={{ letterSpacing: '-0.03em' }}>{title}</h1>
            <div className="mt-3 h-1 w-11 rounded-full bg-status-upcoming-text" aria-hidden="true" />
          </div>
          {meta && <p className="text-[15px] text-ink-muted">{meta}</p>}
        </div>
        {next && <div className="w-full lg:w-[370px] lg:shrink-0"><NextEventCard next={next} /></div>}
      </div>
    </section>
  )
}

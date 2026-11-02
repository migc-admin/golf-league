/**
 * SideCards — the narrow column of the public league page: Side game leaders and Results by event.
 * Presentational over rows from sideRows() and a prepared events list.
 */
import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { UNNAMED, parseLocalDate } from '../../lib/seasonView'

const SIDE_PAGE = 10
const money = n => `$${Number(n).toFixed(2)}`
const CARD = 'rounded-sm border border-surface-border bg-white p-5 sm:p-6'

// Every payout line behind a player's side-game totals, grouped by event
function SideBreakdown({ source, events, hrefs }) {
  const shown = events.filter(ev => source?.itemsByEvent?.[ev.id]?.length)
  return (
    <div className="space-y-3 bg-surface-dim px-3 pb-3 pt-2.5">
      {shown.map(ev => {
        const d = parseLocalDate(ev.event_date)
        return (
          <div key={ev.id}>
            <p className="mb-1 text-xs font-semibold text-ink-muted">
              {hrefs[ev.id]
                ? <Link to={hrefs[ev.id]} className="inline-flex min-h-[44px] items-center text-fairway-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500">Event #{ev.event_number}{ev.name ? ` — ${ev.name}` : ''}</Link>
                : <>Event #{ev.event_number}{ev.name ? ` — ${ev.name}` : ''}</>}
              {d ? ` · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
            </p>
            <div className="space-y-0.5">
              {source.itemsByEvent[ev.id].map((item, j) => (
                <div key={j} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-ink-muted">{item.category}</span>
                  <span className="font-medium tabular-nums text-ink">{money(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function SideLeadersCard({ rows, events = [], hrefs = {}, subtitle, hasSkins, hasCTP, hasLD, hasLP }) {
  const [showAll, setShowAll] = useState(false)
  const [open, setOpen] = useState(null)
  const colCount = 2 + [hasSkins, hasCTP, hasLD, hasLP].filter(Boolean).length
  const visible = showAll ? rows : rows.slice(0, SIDE_PAGE)
  const num = n => (n ? n : '–')
  return (
    <section className={CARD} aria-labelledby="side-leaders-title">
      <h2 id="side-leaders-title" className="text-lg font-bold text-ink">Side game leaders</h2>
      <p className="mb-3 text-sm text-ink-muted">{subtitle}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
            <th scope="col" className="py-2 pr-2 text-left font-bold">Player</th>
            {hasSkins && <th scope="col" className="px-1.5 py-2 text-center font-bold">Skins</th>}
            {hasCTP && <th scope="col" className="px-1.5 py-2 text-center font-bold">CTP</th>}
            {hasLD && <th scope="col" className="px-1.5 py-2 text-center font-bold">LD</th>}
            {hasLP && <th scope="col" className="px-1.5 py-2 text-center font-bold">LP</th>}
            <th scope="col" className="py-2 pl-2 text-right font-bold">Side $</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(r => {
            const isOpen = open === r.key
            return (
              <Fragment key={r.key}>
                <tr className={`border-b border-surface-border last:border-b-0 ${isOpen ? 'bg-surface-dim' : ''}`}>
                  <td className={`py-0 pr-2 font-semibold ${r.name ? 'text-ink' : 'italic text-ink-muted'}`}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : r.key)}
                      className="flex min-h-[44px] w-full items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500"
                    >
                      <span>{r.name ?? UNNAMED}</span>
                    </button>
                  </td>
                  {hasSkins && <td className="px-1.5 py-2.5 text-center tabular-nums text-ink-muted">{num(r.skins)}</td>}
                  {hasCTP && <td className="px-1.5 py-2.5 text-center tabular-nums text-ink-muted">{num(r.ctp)}</td>}
                  {hasLD && <td className="px-1.5 py-2.5 text-center tabular-nums text-ink-muted">{num(r.ld)}</td>}
                  {hasLP && <td className="px-1.5 py-2.5 text-center tabular-nums text-ink-muted">{num(r.lp)}</td>}
                  <td className="py-2.5 pl-2 text-right font-bold tabular-nums text-ink">{r.total > 0 ? money(r.total) : '–'}</td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-surface-border"><td colSpan={colCount} className="p-0"><SideBreakdown source={r.source} events={events} hrefs={hrefs} /></td></tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {rows.length > SIDE_PAGE && (
        <button
          type="button"
          onClick={() => setShowAll(v => !v)}
          className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-sm border border-surface-border bg-white text-sm font-semibold text-ink hover:bg-surface-dim"
        >
          {showAll ? 'Show fewer' : 'Show all'}
        </button>
      )}
    </section>
  )
}

const Chevron = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
)

/** `items` are { key, mon, day, name, course, href }. */
export function ResultsByEventCard({ items, onAllEvents }) {
  return (
    <section className={CARD} aria-labelledby="results-title">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="results-title" className="text-lg font-bold text-ink">Results by event</h2>
        <button type="button" onClick={onAllEvents} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-fairway-700 underline">All events →</button>
      </div>
      <ul>
        {items.map(it => (
          <li key={it.key} className="border-t border-surface-border first:border-t-0">
            <Link to={it.href} className="flex min-h-[56px] items-center gap-3 py-2 hover:bg-surface-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500">
              <span className="flex w-10 shrink-0 flex-col items-center leading-none" aria-hidden="true">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-fairway-700">{it.mon}</span>
                <span className="mt-1 text-lg font-extrabold tabular-nums text-ink">{it.day}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink"><span className="sr-only">{it.mon} {it.day}, </span>{it.name}</span>
                {it.course && <span className="block text-xs text-ink-muted">{it.course}</span>}
              </span>
              <span className="shrink-0 text-ink-muted">{Chevron}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

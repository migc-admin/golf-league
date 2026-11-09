/**
 * MoneyListCard — the season money list: search, top 15 then "Show all players", and a tap-to-open
 * per-event breakdown on every row (the same breakdown the old caret opened).
 *
 * Presentational over rows from moneyRows(). `events` are the league's completed events.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { UNNAMED, parseLocalDate } from '../../lib/seasonView'
import RankBadge from './RankBadge'

const PAGE = 10
const money = n => `$${Number(n).toFixed(2)}`
const COLS = 'grid-cols-[36px_minmax(0,1fr)_auto] sm:grid-cols-[44px_minmax(0,1fr)_64px_104px]'

function Breakdown({ source, events, hrefs }) {
  const shown = events.filter(ev => source.itemsByEvent?.[ev.id]?.length)
  return (
    <div className="space-y-3 bg-surface-dim px-4 pb-4 pt-3 sm:pl-[60px]">
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
              <div className="mt-0.5 flex items-center justify-between border-t border-surface-border pt-0.5 text-xs font-semibold text-ink">
                <span>Event total</span>
                <span className="tabular-nums">{money(source.byEvent[ev.id])}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function MoneyListCard({ rows, events, subtitle, hrefs = {} }) {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [open, setOpen] = useState(null)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => (q ? rows.filter(r => (r.name ?? UNNAMED).toLowerCase().includes(q)) : rows), [rows, q])
  const visible = q || showAll ? filtered : filtered.slice(0, PAGE)

  return (
    <section className="rounded-sm border border-surface-border bg-white p-5 sm:p-6" aria-labelledby="money-list-title">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="money-list-title" className="text-lg font-bold text-ink">Money list</h2>
          <p className="text-sm text-ink-muted">{subtitle}</p>
        </div>
        <div className="sm:w-52 sm:shrink-0">
          <label htmlFor="money-find" className="sr-only">Find a player</label>
          <input
            id="money-find"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Find a player"
            className="input min-h-[44px] w-full"
          />
        </div>
      </div>

      <div className={`grid ${COLS} items-center gap-x-2 border-b border-surface-border pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted`}>
        <span>Rank</span>
        <span>Player</span>
        <span className="hidden text-right sm:block">Events</span>
        <span className="text-right">Earnings</span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No players match “{query.trim()}”.</p>
      ) : (
        <ul>
          {visible.map(r => {
            const isOpen = open === r.key
            return (
              <li key={r.key} className="border-b border-surface-border last:border-b-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : r.key)}
                  className={`grid min-h-[48px] w-full ${COLS} items-center gap-x-2 py-2 text-left transition-colors hover:bg-surface-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 ${isOpen ? 'bg-surface-dim' : ''}`}
                >
                  <RankBadge n={r.rank} />
                  <span className="min-w-0">
                    <span className={`block truncate text-[15px] font-semibold ${r.name ? 'text-ink' : 'italic text-ink-muted'}`}>{r.name ?? UNNAMED}</span>
                    <span className="mt-1 block h-1 max-w-[260px] rounded-full bg-surface-high" aria-hidden="true">
                      <span className="block h-1 rounded-full bg-fairway-700" style={{ width: `${r.pct}%` }} />
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted sm:hidden">{r.events} event{r.events === 1 ? '' : 's'} · {money(r.perEvent)} per event</span>
                  </span>
                  <span className="hidden text-right text-sm tabular-nums text-ink-muted sm:block">{r.events}</span>
                  <span className="text-right text-[15px] font-bold tabular-nums text-ink">{money(r.earnings)}</span>
                </button>
                {isOpen && <Breakdown source={r.source} events={events} hrefs={hrefs} />}
              </li>
            )
          })}
        </ul>
      )}

      {!q && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm text-ink-muted">Showing {visible.length} of {rows.length}</span>
          {rows.length > PAGE && (
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              className="inline-flex min-h-[44px] items-center rounded-sm border border-surface-border bg-white px-5 text-sm font-semibold text-ink hover:bg-surface-dim"
            >
              {showAll ? 'Show fewer' : 'Show all players'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

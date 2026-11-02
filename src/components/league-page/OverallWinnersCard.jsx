/**
 * OverallWinnersCard — how many times each player has finished 1st, 2nd or 3rd in their flight
 * this season (net score, full round). One table per flight. Tap a player to open the events behind
 * their counts; tied players share a place and each one opens on their own.
 * Presentational over the result of overallWinners().
 */
import { useState } from 'react'
import RankBadge from './RankBadge'
import { parseLocalDate } from '../../lib/seasonView'

const PAGE = 5
const COLS = 'grid-cols-[36px_minmax(0,1fr)_36px_36px_36px] sm:grid-cols-[44px_minmax(0,1fr)_56px_56px_56px]'
const count = n => (n ? n : '–')
const ORD = { 1: '1st', 2: '2nd', 3: '3rd' }

const vsPar = n => (n == null ? '' : n === 0 ? 'E' : n > 0 ? `+${n}` : `−${Math.abs(n)}`)
const dateText = str => {
  const d = parseLocalDate(str)
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
}

function Finishes({ player, id }) {
  return (
    <div id={id} className="bg-surface-dim pb-3 pl-[44px] pr-2 pt-1 sm:pl-[52px]">
      <p className="mb-1 text-xs font-semibold text-ink-muted">{player.name} · finishes in the top three</p>
      <ul className="divide-y divide-surface-border">
        {player.finishes.map(f => (
          <li key={f.eventId} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{f.eventName}</span>
              <span className="block text-xs text-ink-muted">{dateText(f.date)}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-bold text-ink">{f.tied ? 'Tied ' : ''}{ORD[f.place]}</span>
              <span className="block text-xs tabular-nums text-ink-muted">Net {f.net}{f.vsPar != null ? ` (${vsPar(f.vsPar)})` : ''}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Counts({ r }) {
  return (
    <>
      <span className="text-center text-sm tabular-nums text-ink">{count(r.first)}</span>
      <span className="text-center text-sm tabular-nums text-ink">{count(r.second)}</span>
      <span className="text-center text-sm tabular-nums text-ink">{count(r.third)}</span>
    </>
  )
}

const ROW_BTN = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500'

function FlightTable({ flight, showHeading }) {
  const [showAll, setShowAll] = useState(false)
  const [open, setOpen] = useState(null)
  const rows = showAll ? flight.rows : flight.rows.slice(0, PAGE)
  const toggle = id => setOpen(open === id ? null : id)

  return (
    <div>
      {showHeading && <h3 className="mb-1 text-[15px] font-bold text-ink">{flight.label} overall standings</h3>}
      <div className={`grid ${COLS} items-center gap-x-2 border-b border-surface-border pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted`}>
        <span>Rank</span>
        <span>Player</span>
        <span className="text-center">1st</span>
        <span className="text-center">2nd</span>
        <span className="text-center">3rd</span>
      </div>
      <ul>
        {rows.map(r => {
          const solo = r.players.length === 1
          const openPlayer = r.players.find(p => `${flight.flight}-${p.id}` === open)
          return (
            <li key={r.rank} className="border-b border-surface-border last:border-b-0">
              {solo ? (
                <button
                  type="button"
                  aria-expanded={open === `${flight.flight}-${r.players[0].id}`}
                  aria-controls={`finishes-${flight.flight}-${r.players[0].id}`}
                  onClick={() => toggle(`${flight.flight}-${r.players[0].id}`)}
                  className={`grid min-h-[48px] w-full ${COLS} items-center gap-x-2 py-2.5 text-left transition-colors hover:bg-surface-dim ${ROW_BTN} ${openPlayer ? 'bg-surface-dim' : ''}`}
                >
                  <RankBadge n={r.rank} />
                  <span className="block min-w-0 truncate text-[15px] font-semibold text-ink">{r.players[0].name}</span>
                  <Counts r={r} />
                </button>
              ) : (
                <div className={`grid ${COLS} items-start gap-x-2 py-2.5 ${openPlayer ? 'bg-surface-dim' : ''}`}>
                  <div className="pt-0.5"><RankBadge n={r.rank} /></div>
                  <div className="min-w-0">
                    <span className="block text-[15px] font-semibold text-ink">{r.players.length} Tied</span>
                    <ul className="mt-1 flex flex-wrap gap-x-1 gap-y-0">
                      {r.players.map(p => {
                        const id = `${flight.flight}-${p.id}`
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              aria-expanded={open === id}
                              aria-controls={`finishes-${id}`}
                              onClick={() => toggle(id)}
                              className={`inline-flex min-h-[44px] items-center rounded-sm px-2 text-sm font-medium underline-offset-2 hover:underline ${ROW_BTN} ${open === id ? 'bg-surface-dim text-ink' : 'text-fairway-700'}`}
                            >
                              {p.name}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  <Counts r={r} />
                </div>
              )}
              {openPlayer && <Finishes player={openPlayer} id={`finishes-${flight.flight}-${openPlayer.id}`} />}
            </li>
          )
        })}
      </ul>
      {flight.rows.length > PAGE && (
        <button
          type="button"
          onClick={() => setShowAll(v => !v)}
          className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-sm border border-surface-border bg-white text-sm font-semibold text-ink hover:bg-surface-dim"
        >
          {showAll ? 'Show fewer' : `Show all ${flight.rows.length}`}
        </button>
      )}
    </div>
  )
}

export default function OverallWinnersCard({ flights }) {
  if (flights.length === 0) return null
  return (
    <section className="rounded-sm border border-surface-border bg-white p-5 sm:p-6" aria-labelledby="overall-title">
      <h2 id="overall-title" className="text-lg font-bold text-ink">Overall winners</h2>
      <p className="mb-4 text-sm text-ink-muted">
        Times each player has finished 1st, 2nd or 3rd{flights.length > 1 ? ' in their flight' : ''}, by net score. Tap a player to see which events.
      </p>
      <div className="flex flex-col gap-6">
        {flights.map(f => <FlightTable key={f.flight} flight={f} showHeading={flights.length > 1} />)}
      </div>
    </section>
  )
}

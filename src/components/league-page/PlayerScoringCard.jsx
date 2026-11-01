/**
 * PlayerScoringCard — the "Player scoring" tab: one row per player per event they finished, with
 * handicap, gross, net, each nine and putts. Filter by tournament and player; tap a column heading
 * to sort. On a phone each round is a small card instead of a table row (no sideways scrolling).
 * Presentational over rows from playerScoringRows().
 */
import { useMemo, useState } from 'react'
import { sortScoringRows, filterScoringRows, scoringFilterOptions } from '../../lib/playerScoring'
import { parseLocalDate } from '../../lib/seasonView'

const PAGE = 25
const dash = '–'
const val = n => (n == null ? dash : n)
const dateText = str => {
  const d = parseLocalDate(str)
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
}

const COLUMNS = [
  { key: 'player', label: 'Player', align: 'left' },
  { key: 'event', label: 'Tournament', align: 'left' },
  { key: 'flight', label: 'Flight', align: 'center' },
  { key: 'hcp', label: 'HCP', align: 'right' },
  { key: 'gross', label: 'Gross', align: 'right' },
  { key: 'net', label: 'Net', align: 'right' },
  { key: 'front9', label: 'Front 9', align: 'right' },
  { key: 'back9', label: 'Back 9', align: 'right' },
  { key: 'putts', label: 'Putts', align: 'right' },
]
const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' }

function FlightBadge({ flight }) {
  if (!flight) return <span className="text-ink-muted">{dash}</span>
  const tint = flight === 'A' ? 'bg-status-upcoming-bg text-status-upcoming-text' : 'bg-fairway-50 text-fairway-700'
  return <span className={`inline-flex h-6 w-6 items-center justify-center rounded-sm text-xs font-bold ${tint}`}>{flight}</span>
}

const SELECT = 'input min-h-[44px] w-full'

export default function PlayerScoringCard({ rows }) {
  const [eventId, setEventId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [sort, setSort] = useState({ key: 'player', dir: 'asc' })
  const [showAll, setShowAll] = useState(false)

  const options = useMemo(() => scoringFilterOptions(rows), [rows])
  const filtered = useMemo(() => sortScoringRows(filterScoringRows(rows, { eventId, playerId }), sort.key, sort.dir), [rows, eventId, playerId, sort])
  const visible = showAll ? filtered : filtered.slice(0, PAGE)

  function sortBy(key) {
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'player' || key === 'event' || key === 'flight' ? 'asc' : 'asc' }))
  }
  const ariaSort = key => (sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none')

  return (
    <section className="rounded-sm border border-surface-border bg-white p-5 sm:p-6" aria-labelledby="scoring-title">
      <h2 id="scoring-title" className="text-lg font-bold text-ink">Player gross and net scoring</h2>
      <p className="mb-4 text-sm text-ink-muted">Every completed round, one row per player per event. Net is gross less course handicap.</p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="scoring-event" className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Tournament</label>
          <select id="scoring-event" value={eventId} onChange={e => { setEventId(e.target.value); setShowAll(false) }} className={SELECT}>
            <option value="">All tournaments</option>
            {options.events.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="scoring-player" className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Player</label>
          <select id="scoring-player" value={playerId} onChange={e => { setPlayerId(e.target.value); setShowAll(false) }} className={SELECT}>
            <option value="">All players</option>
            {options.players.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div className="sm:hidden">
          <label htmlFor="scoring-sort" className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Sort by</label>
          <select
            id="scoring-sort"
            value={`${sort.key}:${sort.dir}`}
            onChange={e => { const [key, dir] = e.target.value.split(':'); setSort({ key, dir }) }}
            className={SELECT}
          >
            {COLUMNS.flatMap(c => [
              <option key={`${c.key}:asc`} value={`${c.key}:asc`}>{c.label}, low to high</option>,
              <option key={`${c.key}:desc`} value={`${c.key}:desc`}>{c.label}, high to low</option>,
            ])}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No rounds match those filters.</p>
      ) : (
        <>
          {/* Wider screens: table with sortable headings */}
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  {COLUMNS.map(c => (
                    <th key={c.key} scope="col" aria-sort={ariaSort(c.key)} className={`${ALIGN[c.align]} font-bold`}>
                      <button
                        type="button"
                        onClick={() => sortBy(c.key)}
                        className={`inline-flex min-h-[44px] items-center gap-1 uppercase tracking-[0.08em] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 ${c.align === 'right' ? 'justify-end' : ''} ${sort.key === c.key ? 'text-fairway-700' : ''}`}
                      >
                        {c.label}
                        <span aria-hidden="true" className="text-[10px]">{sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.key} className="border-b border-surface-border last:border-b-0">
                    <td className="py-2.5 pr-2 font-semibold text-ink">{r.player}</td>
                    <td className="py-2.5 pr-2 text-ink">{r.event}<span className="block text-xs text-ink-muted">{dateText(r.date)}</span></td>
                    <td className="py-2.5 text-center"><FlightBadge flight={r.flight} /></td>
                    <td className="py-2.5 text-right tabular-nums text-ink-muted">{val(r.hcp)}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink">{val(r.gross)}</td>
                    <td className="py-2.5 text-right font-bold tabular-nums text-ink">{val(r.net)}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-muted">{val(r.front9)}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-muted">{val(r.back9)}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-muted">{val(r.putts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: one small card per round */}
          <ul className="sm:hidden">
            {visible.map(r => (
              <li key={r.key} className="border-b border-surface-border py-3 last:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[15px] font-semibold text-ink">{r.player}</span>
                  <FlightBadge flight={r.flight} />
                </div>
                <div className="text-sm text-ink-muted">{r.event} · {dateText(r.date)}</div>
                <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-sm">
                  {[['Gross', r.gross], ['Net', r.net, true], ['HCP', r.hcp], ['Front 9', r.front9], ['Back 9', r.back9], ['Putts', r.putts]].map(([label, v, strong]) => (
                    <div key={label}>
                      <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">{label}</dt>
                      <dd className={`tabular-nums ${strong ? 'font-bold text-ink' : 'text-ink'}`}>{val(v)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm text-ink-muted">Showing {visible.length} of {filtered.length}</span>
            {filtered.length > PAGE && (
              <button
                type="button"
                onClick={() => setShowAll(v => !v)}
                className="inline-flex min-h-[44px] items-center rounded-sm border border-surface-border bg-white px-5 text-sm font-semibold text-ink hover:bg-surface-dim"
              >
                {showAll ? 'Show fewer' : `Show all ${filtered.length}`}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}

/**
 * FlightPrizesCard — ONE table for every flight's prizes (it replaces the separate Flight A and
 * Flight B tables).
 *
 *   Prize        | Flight A · 10 players | Flight B · 9 players |  Total
 *   18-Hole Net
 *     1st        |  $ [ 5.00 ] = $50.00  |  $ [ 5.00 ] = $45.00 |  $95.00
 *   …
 *   Per player   |  $11.00 · $110.00     |  $11.00 · $99.00     |  $209.00
 *
 * Rows come from the keys in the saved config (`buildFlightTable`), never hard-coded. By default
 * every flight has the SAME amounts: you edit Flight A and the others follow. Turn on "Different
 * amounts per flight" to edit each flight on its own. Either way the values are saved to the same
 * per-flight keys as before.
 *
 * Presentational and controlled: `onSet(keys, value)` is the page's existing setVal applied to each key.
 */

import PrizeInput from './PrizeInput'
import { money } from '../../lib/payoutView'

const n = v => Number(v) || 0

export default function FlightPrizesCard({
  table, flightLetters, flightCounts, config, multiplierOf, onSet,
  different, onToggleDifferent, locked = false, className = '',
}) {
  if (table.length === 0) return null

  // Per-flight sums for the subtotal row.
  const perPlayer = Object.fromEntries(flightLetters.map(l => [l, 0]))
  const totals = Object.fromEntries(flightLetters.map(l => [l, 0]))
  for (const g of table) for (const r of g.rows) for (const l of flightLetters) {
    const key = r.cells[l]
    if (!key) continue
    perPlayer[l] += n(config[key])
    totals[l] += n(config[key]) * multiplierOf(key)
  }
  const grand = flightLetters.reduce((s, l) => s + totals[l], 0)

  return (
    <section id="flight-prizes" className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Flight prizes</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {different
              ? 'Each flight has its own amounts. Values are dollars per player.'
              : 'Every flight pays the same amounts. Edit Flight A and the others follow. Values are dollars per player.'}
          </p>
        </div>
        {flightLetters.length > 1 && (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="h-5 w-5 accent-fairway-700"
              checked={different}
              disabled={locked}
              onChange={e => onToggleDifferent(e.target.checked)}
            />
            Different amounts per flight
          </label>
        )}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] font-bold uppercase tracking-widest text-ink-muted">
              <th scope="col" className="py-2 pr-3">Prize</th>
              {flightLetters.map(l => (
                <th key={l} scope="col" className="px-3 py-2">Flight {l} · {flightCounts[l] ?? 0} players</th>
              ))}
              <th scope="col" className="py-2 pl-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {table.map(g => (
              <FragmentRows key={g.family} group={g} {...{ flightLetters, config, multiplierOf, onSet, different, locked }} />
            ))}
            <tr className="border-t-2 border-surface-border bg-surface-container font-semibold text-ink">
              <th scope="row" className="py-3 pr-3 pl-2 text-left">Per player</th>
              {flightLetters.map(l => (
                <td key={l} className="px-3 py-3 tabular-nums">{money(perPlayer[l])} · {money(totals[l])}</td>
              ))}
              <td className="py-3 pl-3 pr-2 text-right tabular-nums">{money(grand)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function FragmentRows({ group, flightLetters, config, multiplierOf, onSet, different, locked }) {
  return (
    <>
      <tr>
        <th colSpan={flightLetters.length + 2} scope="colgroup" className="pb-1 pt-4 text-left text-[11px] font-bold uppercase tracking-widest text-ink-muted">
          {group.label}
        </th>
      </tr>
      {group.rows.map(r => {
        const keys = flightLetters.map(l => r.cells[l]).filter(Boolean)
        const rowTotal = keys.reduce((s, k) => s + n(config[k]) * multiplierOf(k), 0)
        const first = flightLetters.find(l => r.cells[l])
        return (
          <tr key={`${group.family}-${r.prize}`} className="border-t border-surface-border">
            <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">{r.prize}</th>
            {flightLetters.map(l => {
              const key = r.cells[l]
              if (!key) return <td key={l} className="px-3 py-2 text-ink-muted">—</td>
              const mirrored = !different && l !== first
              return (
                <td key={l} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <PrizeInput
                      label={`${group.label} ${r.prize} Flight ${l} dollars per player`}
                      value={config[key]}
                      disabled={locked || mirrored}
                      onChange={v => onSet(different ? [key] : keys, v)}
                    />
                    <span className="text-xs tabular-nums text-ink-muted">= {money(n(config[key]) * multiplierOf(key))}</span>
                  </div>
                </td>
              )
            })}
            <td className="py-2 pl-3 text-right font-semibold tabular-nums text-ink">{money(rowTotal)}</td>
          </tr>
        )
      })}
    </>
  )
}

/**
 * FullFieldPrizesCard — prizes everyone plays for (Low putts, Closest to pin, any no-flight
 * scoring). Titled "Side game prizes" on events with flights; the page passes a plainer title when
 * there are no flights (then it also holds the scoring prizes). Columns: Prize | $ per player | Total.
 *
 * Closest to pin is ONE row ("Closest to pin · each hole", "Holes 3, 8, 13, 16 · $X per hole")
 * when every hole has the same amount, and one row per hole when they differ — so nothing is ever
 * hidden. Editing the combined row sets every hole, exactly as if you had edited each one.
 *
 * Presentational and controlled: `onSet(keys, value)` is the page's existing setVal per key.
 */

import PrizeInput from './PrizeInput'
import { money, ctpRows, parseKey } from '../../lib/payoutView'

const n = v => Number(v) || 0

function labelOf(key) {
  const p = parseKey(key)
  return p.rank || p.family === 'nassau_net' || p.family === 'nassau_gross' ? `${p.familyLabel} — ${p.prize}` : p.familyLabel
}

export default function FullFieldPrizesCard({ keys, config, multiplierOf, totalPlayers, onSet, locked = false, title = 'Side game prizes', subtotalLabel = 'Side games', className = '' }) {
  const plain = keys.filter(k => parseKey(k).family !== 'ctp')
  const ctp = ctpRows(config, keys)
  const rows = [
    ...plain.map(k => ({ id: k, label: labelOf(k), helper: null, keys: [k], amount: n(config[k]), count: 1 })),
    ...ctp.map(r => r.combined
      ? { id: 'ctp-all', label: 'Closest to pin · each hole', helper: `Holes ${r.holes.join(', ')} · ${money(r.amount * totalPlayers)} per hole`, keys: r.keys, amount: r.amount, count: r.keys.length }
      : { id: r.keys[0], label: `Closest to pin · Hole ${r.holes[0]}`, helper: null, keys: r.keys, amount: r.amount, count: 1 }),
  ]
  if (rows.length === 0) return null

  const total = rows.reduce((s, r) => s + r.amount * r.count * totalPlayers, 0)
  const perPlayer = rows.reduce((s, r) => s + r.amount * r.count, 0)

  return (
    <section id="full-field-prizes" className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-4">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-ink-muted">Everyone plays for these: {totalPlayers} players. Values are dollars per player.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] font-bold uppercase tracking-widest text-ink-muted">
              <th scope="col" className="py-2 pr-3">Prize</th>
              <th scope="col" className="px-3 py-2">$ per player</th>
              <th scope="col" className="py-2 pl-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-surface-border">
                <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">
                  {r.label}
                  {r.helper && <span className="block text-xs text-ink-muted">{r.helper}</span>}
                </th>
                <td className="px-3 py-2">
                  <PrizeInput label={`${r.label} dollars per player`} value={config[r.keys[0]]} disabled={locked} onChange={v => onSet(r.keys, v)} />
                </td>
                <td className="py-2 pl-3 text-right font-semibold tabular-nums text-ink">{money(r.amount * r.count * totalPlayers)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-surface-border bg-surface-container font-semibold text-ink">
              <th scope="row" className="py-3 pr-3 pl-2 text-left">{subtotalLabel}</th>
              <td className="px-3 py-3 tabular-nums">{money(perPlayer)} per player</td>
              <td className="py-3 pl-3 pr-2 text-right tabular-nums">{money(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

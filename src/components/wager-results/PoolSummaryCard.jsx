/**
 * PoolSummaryCard — "Pool Summary": four centered stat cells in a responsive grid with 1px
 * dividers between them. These are the ONLY places the pool colors appear on the results page:
 * WIN green, PLACE blue, Match purple, Total Pot forest green.
 *
 * `pools` is { win, place, match, total } from the results view-model; `betsLabel` is the
 * header subtitle ("76 bets settled" / "N active bets").
 */

import ResultsCard from './ResultsCard'
import { money } from '../../lib/wagerResultsView'

const CELLS = [
  { key: 'win',   label: 'WIN Pool',   color: 'text-[#2E7D4F]' },
  { key: 'place', label: 'PLACE Pool', color: 'text-[#2B59A0]' },
  { key: 'match', label: 'Match Pool', color: 'text-[#6B46C1]' },
  { key: 'total', label: 'Total Pot',  color: 'text-fairway-700' },
]

export default function PoolSummaryCard({ pools, betsLabel, className = '' }) {
  return (
    <ResultsCard title="Pool Summary" subtitle={betsLabel} className={className}>
      {/* Negative top/left margins hide the outer edge of the cell borders, so only the
          lines BETWEEN cells show — however many cells land on each row. */}
      <div className="overflow-hidden">
        <dl className="-ml-px -mt-px grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          {CELLS.map(c => (
            <div key={c.key} className="border-l border-t border-[#E4E1D8] px-4 py-5 text-center">
              <dt className="text-[13px] text-[#5F5F5A]">{c.label}</dt>
              <dd className={`mt-1 text-[28px] font-bold leading-tight tabular-nums ${c.color}`}>{money(pools[c.key])}</dd>
            </div>
          ))}
        </dl>
      </div>
    </ResultsCard>
  )
}

/**
 * LiveOddsCard — "Live Odds" in the same styling as the other results cards. Shown in the PNG
 * while an event is still being played (the results page itself doesn't show odds). `rows`
 * come from `oddsRows`: amount bet and odds (pool ÷ amount) per player for WIN and PLACE.
 */

import ResultsCard from './ResultsCard'
import { money } from '../../lib/wagerResultsView'

export default function LiveOddsCard({ rows, className = '' }) {
  return (
    <ResultsCard title="Live Odds" subtitle="Odds are the pool divided by the amount bet on that player" className={className}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5F5F5A]">
              <th scope="col" className="px-4 py-2.5 text-left">Player</th>
              <th scope="col" className="px-4 py-2.5 text-right">WIN amt</th>
              <th scope="col" className="px-4 py-2.5 text-right">WIN odds</th>
              <th scope="col" className="px-4 py-2.5 text-right">PLACE amt</th>
              <th scope="col" className="px-4 py-2.5 text-right">PLACE odds</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}-${i}`} className="border-t border-[#F0EDE5]">
                <td className="px-4 py-2.5 font-bold text-[#1A1A1A]">{r.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#1A1A1A]">{r.winAmt > 0 ? money(r.winAmt) : '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#5F5F5A]">{r.winOdds}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#1A1A1A]">{r.placeAmt > 0 ? money(r.placeAmt) : '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#5F5F5A]">{r.placeOdds}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ResultsCard>
  )
}

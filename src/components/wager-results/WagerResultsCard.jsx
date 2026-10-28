/**
 * WagerResultsCard — "Wager Results": one bordered panel per pool (WIN, PLACE), winners only.
 *
 *   WIN pool                                                       Pool $165.00
 *   (T1 at net 72: John Nothdurft & Paul Hsieh)
 *   Whole pool split among bettors on the winner, pro rata to stake; payout includes stake.
 *   BETTOR            PICKED            STAKE     PAYOUT       NET
 *   Darrick Sogabe    John Nothdurft    $5.00     $82.50    +$77.50
 *
 * Presentational: `panels` come from the results view-model (already winners only, with Net
 * worked out), so nothing here calculates money. The table sits in a sideways-scrolling box
 * so it never widens the page on a phone. Gold winner-pill colors are local to this page.
 */

import ResultsCard from './ResultsCard'
import { money, netText } from '../../lib/wagerResultsView'

export function WinnerPill({ children }) {
  return (
    <span className="inline-block rounded-full border border-[#E3C77A] bg-[#FBF3DC] px-3 py-1 text-[13px] font-semibold text-[#6E5110]">
      {children}
    </span>
  )
}

function PoolPanel({ panel }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E4E1D8]">
      <div className="bg-[#FAF9F5] px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-bold text-[#1A1A1A]">{panel.title}</h3>
          <span className="text-[13px] text-[#5F5F5A]">Pool {money(panel.pool)}</span>
        </div>
        <div className="mt-2"><WinnerPill>{panel.pill}</WinnerPill></div>
        <p className="mt-2 text-[13px] text-[#5F5F5A]">{panel.note}</p>
      </div>

      {panel.rows.length === 0 ? (
        <p className="border-t border-[#F0EDE5] px-4 py-4 text-sm text-[#5F5F5A]">No winning bets.</p>
      ) : (
        <div className="overflow-x-auto border-t border-[#F0EDE5]">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5F5F5A]">
                <th scope="col" className="px-4 py-2.5 text-left">Bettor</th>
                <th scope="col" className="px-4 py-2.5 text-left">Picked</th>
                <th scope="col" className="px-4 py-2.5 text-right">Stake</th>
                <th scope="col" className="px-4 py-2.5 text-right">Payout</th>
                <th scope="col" className="px-4 py-2.5 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {panel.rows.map((r, i) => (
                <tr key={`${r.name}-${i}`} className="border-t border-[#F0EDE5]">
                  <td className="px-4 py-3 font-bold text-[#1A1A1A]">{r.name}</td>
                  <td className="px-4 py-3 text-[#1A1A1A]">{r.picked}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#5F5F5A]">{money(r.stake)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-fairway-700">{money(r.payout)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-fairway-700">{netText(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function WagerResultsCard({ panels, final = true, emptyMessage = 'No results to show yet.', className = '' }) {
  const subtitle = `${final ? 'Final · Low net score' : 'Live · Updates as scores are entered'} · Winners only · Payout includes stake`
  return (
    <ResultsCard title="Wager Results" subtitle={subtitle} className={className}>
      <div className="space-y-4 p-4 sm:p-5">
        {panels.length === 0
          ? <p className="py-3 text-center text-sm text-[#5F5F5A]">{emptyMessage}</p>
          : panels.map(p => <PoolPanel key={p.key} panel={p} />)}
      </div>
    </ResultsCard>
  )
}

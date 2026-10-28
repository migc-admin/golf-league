/**
 * MatchWagersCard — "Match Play Wagers": one small card per decided match, winners only.
 *
 *   MATCH 2
 *   John Nothdurft vs Mat Vigil                                   Pool $45.00
 *   4&3 · Final
 *   (Winner: John Nothdurft)
 *   BETTOR                       STAKE     PAYOUT      NET
 *   Mat Vigil                   $10.00     $18.00    +$8.00
 *
 * Presentational: `matches` come from the results view-model (winning bettors only, Net
 * worked out). A halved match shows the "Halved · Stakes refunded" pill with payout equal to
 * stake and Net $0.00. Cards flow two per row on wide screens and one on a phone; the bettor
 * rows sit in a small sideways-scrolling box so they never widen the page.
 */

import ResultsCard from './ResultsCard'
import { WinnerPill } from './WagerResultsCard'
import { money, netText } from '../../lib/wagerResultsView'

const ROW = 'grid grid-cols-[1fr_68px_76px_68px] items-center gap-2 px-4'

function MatchCard({ match }) {
  return (
    <article className="overflow-hidden rounded-xl border border-[#E4E1D8]">
      <header className="flex items-start justify-between gap-3 bg-[#FAF9F5] px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5F5F5A]">Match {match.number}</p>
          <h3 className="mt-0.5 text-base font-bold text-[#1A1A1A]">{match.a} vs {match.b}</h3>
          {match.resultLine && <p className="mt-0.5 text-[13px] text-[#5F5F5A]">{match.resultLine}</p>}
        </div>
        <span className="shrink-0 text-[13px] text-[#5F5F5A]">Pool {money(match.pool)}</span>
      </header>

      <div className="border-t border-[#F0EDE5] px-4 pt-3.5 pb-1">
        <WinnerPill>{match.pill}</WinnerPill>
      </div>

      {match.rows.length === 0 ? (
        <p className="px-4 pt-2 pb-4 text-[13px] text-[#5F5F5A]">{match.note ?? 'No winning bets.'}</p>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[320px]">
            <div className={`${ROW} py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5F5F5A]`}>
              <span>Bettor</span><span className="text-right">Stake</span><span className="text-right">Payout</span><span className="text-right">Net</span>
            </div>
            {match.rows.map((r, i) => (
              <div key={`${r.name}-${i}`} className={`${ROW} border-t border-[#F0EDE5] py-3 text-sm`}>
                <span className="min-w-0 font-bold text-[#1A1A1A]">{r.name}</span>
                <span className="text-right tabular-nums text-[#5F5F5A]">{money(r.stake)}</span>
                <span className="text-right font-bold tabular-nums text-fairway-700">{money(r.payout)}</span>
                <span className="text-right tabular-nums text-fairway-700">{netText(r.net)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

export default function MatchWagersCard({ matches, emptyMessage = 'No decided matches to show yet.', className = '' }) {
  return (
    <ResultsCard
      title="Match Play Wagers"
      subtitle="Pool per match · Winners only · Halved = stakes refunded · Payout includes stake"
      className={className}
    >
      <div className="p-4 sm:p-5">
        {matches.length === 0 ? (
          <p className="py-3 text-center text-sm text-[#5F5F5A]">{emptyMessage}</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] gap-5">
            {matches.map(m => <MatchCard key={m.id ?? m.number} match={m} />)}
          </div>
        )}
      </div>
    </ResultsCard>
  )
}

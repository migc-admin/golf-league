/**
 * WagerShareCard — the shareable image of the wager results (PNG export).
 *
 * Rendered off-screen by WagerAdmin and captured with html-to-image. It is the results page
 * without the search box, built from the very same components and the same view-model, so the
 * image always matches the page: header, Pool Summary, Wager Results, Match Play Wagers, and the
 * footer. While an event is still being played it also includes Live Odds (the page doesn't).
 * Winners only.
 */

import WagerResultsHeader from './wager-results/WagerResultsHeader'
import PoolSummaryCard from './wager-results/PoolSummaryCard'
import WagerResultsCard from './wager-results/WagerResultsCard'
import MatchWagersCard from './wager-results/MatchWagersCard'
import LiveOddsCard from './wager-results/LiveOddsCard'

export const WAGER_CARD_WIDTH = 1120

export const WAGER_FOOTER = 'Full pool paid to winner(s). If no one picks the winner, funds roll to the club. Halved matches refund stakes.'

export default function WagerShareCard({ event, eventDate, model, logoUrl }) {
  const hasResults = model.panels.length > 0
  return (
    <div
      style={{ width: WAGER_CARD_WIDTH, boxSizing: 'border-box' }}
      className="space-y-6 bg-[#F5F4F0] p-8 font-sans text-[#1A1A1A]"
    >
      <WagerResultsHeader
        clubName={event.league?.name}
        title={`${event.name ?? `Event #${event.event_number}`} · Wagers`}
        meta={[event.course?.name, eventDate].filter(Boolean).join(' · ')}
        statusLabel={model.statusLabel}
        final={model.final}
        logoUrl={logoUrl}
        showSearch={false}
      />

      <PoolSummaryCard pools={model.pools} betsLabel={model.betsLabel} />

      {hasResults && <WagerResultsCard panels={model.panels} final={model.final} />}

      {model.matches.length > 0 && <MatchWagersCard matches={model.matches} />}

      {!model.final && model.odds.length > 0 && <LiveOddsCard rows={model.odds} />}

      <p className="text-center text-[11px] text-[#9ca3af]">{WAGER_FOOTER}</p>
    </div>
  )
}

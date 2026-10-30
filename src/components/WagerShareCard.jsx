/**
 * WagerShareCard — the shareable image of the wagers (PNG export from the admin board).
 *
 * Rendered off-screen by WagerAdmin and captured with html-to-image. It uses the same building
 * blocks and the same view-model as the redesigned pages: league header, pool tiles, then either
 * the winning pools (once the event is final) or live odds and the match pools (while it is still
 * being played). Winners only; no bettor is listed before the results are final.
 */

import LeagueMark from './ui/LeagueMark'
import StatTiles from './ui/StatTiles'
import { PoolCard } from './wager/ResultsViews'
import { OddsCard, MatchPoolsCard } from './wager/AdminBoard'
import { poolView } from '../lib/wagerSummaryView'
import { money } from '../lib/wagerResultsView'
import { useEmbeddedLogo } from '../lib/useEmbeddedLogo'

export const WAGER_CARD_WIDTH = 720

export const WAGER_FOOTER = 'Full pool paid to winner(s). If no one picks the winner, funds roll to the club. Halved matches refund stakes.'

export const CARD_BACKGROUND = '#f4f3f0' // surface-dim

export default function WagerShareCard({ event, eventDate, model, logoUrl, matchCards = [], playerName = id => id }) {
  // Embed the logo so the capture never races a network request (initials show if it can't load).
  const { logo } = useEmbeddedLogo(logoUrl)
  const cards = poolView(model)
  const tiles = [
    { label: 'Win pool', value: money(model.pools.win) },
    { label: 'Place pool', value: money(model.pools.place) },
    { label: 'Match pools', value: money(model.pools.match) },
    { label: 'Total pot', value: money(model.pools.total), helper: model.betsLabel, tone: 'good' },
  ]
  return (
    <div
      style={{ width: WAGER_CARD_WIDTH, boxSizing: 'border-box', background: CARD_BACKGROUND }}
      className="space-y-5 p-6 font-sans text-ink"
    >
      <header>
        <div className="flex items-center gap-3">
          <LeagueMark name={event.league?.name} logoUrl={logo} size={44} />
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">{event.league?.name}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-[28px] font-extrabold leading-tight text-ink" style={{ letterSpacing: '-0.02em' }}>
            {model.final ? 'Wager results' : 'Wager odds'}
          </h1>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${model.final ? 'bg-surface-high text-ink-muted' : 'bg-status-active-bg text-status-active-text'}`}>
            {model.statusLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {[event.name ?? `Event #${event.event_number}`, event.course?.name, eventDate].filter(Boolean).join(' · ')}
        </p>
      </header>

      <StatTiles tiles={tiles} />

      {model.final
        ? (cards.length > 0 && <div className="space-y-4">{cards.map(c => <PoolCard key={c.key} card={c} />)}</div>)
        : (
          <>
            <OddsCard rows={model.odds} />
            <MatchPoolsCard cards={matchCards} playerName={playerName} />
          </>
        )}

      <p className="text-center text-xs text-ink-muted">{WAGER_FOOTER}</p>
    </div>
  )
}

/**
 * WagerPayoutSummary — the one-page, US Letter "Wager payout summary" (print / save as PDF).
 *
 * Presentational: everything comes from buildSummary(model) (lib/wagerSummaryView.js), which is
 * built from the settlement the app already calculates. Uses the platform's header, stat-tile and
 * card styles (no solid color band) and the shared ExportHeader with the event's own league logo.
 * Table rows never split across pages, and column headings repeat if the list runs long.
 */

import ExportHeader from '../ui/ExportHeader'
import StatTiles from '../ui/StatTiles'
import { money, netText } from '../../lib/wagerResultsView'

export const SUMMARY_WIDTH = '7.7in'

const th = 'px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted'
const row = { breakInside: 'avoid', pageBreakInside: 'avoid' }

// Chips are tinted by bet type so a row reads at a glance: WIN green, PLACE gold tint, match white.
const CHIP = {
  WIN:   'border-fairway-200 bg-status-active-bg text-status-active-text',
  PLACE: 'border-surface-border bg-status-upcoming-bg text-status-upcoming-text',
  MATCH: 'border-surface-highest bg-white text-ink',
}

export function Chip({ label, payout, detail }) {
  const tone = CHIP[label === 'WIN' || label === 'PLACE' ? label : 'MATCH']
  const chip = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs leading-none ${tone} ${detail ? 'cursor-help' : ''}`}
      {...(detail ? { tabIndex: 0, title: detail } : {})}
    >
      <span className="font-bold">{label}</span>
      <span className="font-semibold tabular-nums">{money(payout)}</span>
    </span>
  )
  if (!detail) return chip
  // Styled tooltip on hover/focus; the title attribute above is the fallback.
  return (
    <span className="group relative inline-flex">
      {chip}
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 hidden whitespace-nowrap rounded-sm bg-fairway-800 px-2 py-1 text-xs font-medium text-white shadow-card group-hover:block group-focus-within:block">
        {label.startsWith('M') ? `Match ${label.slice(1)}: ${detail}` : detail}
      </span>
    </span>
  )
}

export function StatusPill({ status }) {
  const tone = status.kind === 'ties'
    ? 'bg-status-active-bg text-status-active-text'
    : status.kind === 'club' ? 'bg-surface-high text-ink-muted' : 'bg-status-upcoming-bg text-status-upcoming-text'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {status.kind === 'ties' ? '✓ ' : ''}{status.label}
    </span>
  )
}

export function summaryTiles(summary) {
  const t = summary.tiles
  return [
    { label: 'Total pot', value: money(t.pot.value), helper: t.pot.breakdown },
    { label: 'Paid out', value: money(t.paid.value), helper: `${t.paid.ties ? '✓ ' : ''}${t.paid.helper}`, tone: t.paid.ties ? 'good' : 'warn' },
    { label: 'Bets settled', value: t.settled.value, helper: t.settled.helper },
    { label: 'Top earner', value: t.top?.name ?? '—', helper: t.top?.helper },
  ]
}

export default function WagerPayoutSummary({ leagueName, logoUrl, eventName, meta, summary, generatedOn }) {
  const { bettors, totals, tieOut, tieTotals, tiles } = summary
  return (
    <div className="bg-white font-sans text-ink" style={{ width: SUMMARY_WIDTH, margin: '0 auto' }}>
      <ExportHeader
        leagueName={leagueName}
        logoUrl={logoUrl}
        title="Wager payout summary"
        pill="Final · Settled"
        meta={meta}
        right={[`Generated ${generatedOn}`, 'Payouts include stake']}
      />

      <StatTiles tiles={summaryTiles(summary)} className="mt-4 !grid-cols-4" />

      <section className="mt-4 rounded-sm border border-surface-border">
        <h2 className="px-4 pt-3 text-[15px] font-bold text-ink">Payout by bettor</h2>
        <table className="mt-1 w-full border-collapse text-[12px]">
          <thead style={{ display: 'table-header-group' }}>
            <tr className="border-b border-surface-border text-left">
              <th className={`${th} w-6`}>#</th>
              <th className={th}>Bettor</th>
              <th className={th}>Winning bets</th>
              <th className={`${th} text-right`}>Staked</th>
              <th className={`${th} text-right`}>Payout</th>
              <th className={`${th} text-right`}>Net</th>
            </tr>
          </thead>
          <tbody>
            {bettors.map(b => (
              <tr key={b.name} className="border-b border-surface-border align-middle" style={row}>
                <td className="px-3 py-1.5 text-ink-muted tabular-nums">{b.rank}</td>
                <td className="px-3 py-1.5 font-bold">{b.name}</td>
                <td className="px-3 py-1.5"><div className="flex flex-wrap gap-1">{b.chips.map((c, i) => <Chip key={i} {...c} />)}</div></td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink-muted">{money(b.staked)}</td>
                <td className="px-3 py-1.5 text-right font-bold tabular-nums">{money(b.payout)}</td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-fairway-700">{netText(b.net)}</td>
              </tr>
            ))}
            <tr className="bg-surface-dim font-bold" style={row}>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" colSpan={2}>{totals.winners} winner{totals.winners === 1 ? '' : 's'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(totals.staked)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(totals.payout)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-fairway-700">{netText(totals.net)}</td>
            </tr>
          </tbody>
        </table>
        <p className="px-4 pb-3 pt-2 text-[11px] text-ink-muted">
          Net counts winning bets only. The {netText(totals.net)} profit equals the stakes from the {tiles.settled.losing} losing bets.
        </p>
      </section>

      <section className="mt-4 rounded-sm border border-surface-border" style={row}>
        <h2 className="px-4 pt-3 text-[15px] font-bold text-ink">Tie-out to the {money(tiles.pot.value)} pot</h2>
        <table className="mt-1 w-full border-collapse text-[12px]">
          <thead style={{ display: 'table-header-group' }}>
            <tr className="border-b border-surface-border text-left">
              <th className={th}>Pool</th>
              <th className={th}>Winner</th>
              <th className={`${th} text-right`}>Winning bets</th>
              <th className={`${th} text-right`}>Pool size</th>
              <th className={`${th} text-right`}>Paid out</th>
              <th className={`${th} text-right`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {tieOut.map(r => (
              <tr key={r.key} className="border-b border-surface-border" style={row}>
                <td className="px-3 py-1.5 font-bold">{r.pool}</td>
                <td className="px-3 py-1.5 text-ink-muted">{r.winner}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{r.winningBets}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(r.poolSize)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(r.paidOut)}</td>
                <td className="px-3 py-1.5 text-right"><StatusPill status={r.status} /></td>
              </tr>
            ))}
            <tr className="bg-surface-dim font-bold" style={row}>
              <td className="px-3 py-2" colSpan={2}>Total</td>
              <td className="px-3 py-2 text-right tabular-nums">{tieTotals.winningBets}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(tieTotals.poolSize)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(tieTotals.paidOut)}</td>
              <td className="px-3 py-2 text-right"><StatusPill status={tieTotals.status} /></td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="mt-4 flex items-end justify-between text-[10px] text-ink-muted" style={row}>
        <span>Source: {eventName} wager settlement, {generatedOn}</span>
        <span>Powered by Scorify Golf</span>
      </footer>
    </div>
  )
}

/**
 * PayoutsPerPlayerSheet — the "Payouts per player" PNG (1000px): four stat tiles and one table card
 * (# | Player + flight tag | prize chips | Total), highest total first. Presentational: data comes
 * from payoutsPerPlayerView (lib/payoutsPerPlayerView.js).
 */
import ExportHeader from '../ui/ExportHeader'
import StatTiles from '../ui/StatTiles'
import { ExportSheet, SmallHead, FlightTag, ExportFooter } from './ExportParts'
import { money } from '../../lib/resultsView'

const cols = 'grid-cols-[36px_minmax(0,1.1fr)_minmax(0,2.4fr)_96px]'

export default function PayoutsPerPlayerSheet({ view, leagueName, logoUrl, className = '' }) {
  return (
    <ExportSheet className={className}>
      <ExportHeader
        leagueName={leagueName}
        logoUrl={logoUrl}
        title="Payouts per player"
        pill="Final"
        meta={[view.eventName, view.courseName, view.dateShort].filter(Boolean).join(' · ')}
      />

      <StatTiles tiles={view.tiles} className="mt-5 !grid-cols-4" />

      <section className="mt-5 rounded border border-surface-border bg-white px-4 pb-3 pt-3">
        <div className={`grid ${cols} items-end gap-x-3 border-b border-surface-border px-2 pb-2`}>
          <SmallHead>#</SmallHead><SmallHead>Player</SmallHead><SmallHead>Prizes</SmallHead><SmallHead className="text-right">Total</SmallHead>
        </div>
        {view.rows.map(r => (
          <div key={r.rank} className={`grid ${cols} items-center gap-x-3 border-b border-surface-border px-2 py-2.5`} style={{ breakInside: 'avoid' }}>
            <span className="text-[12px] tabular-nums text-ink-muted">{r.rank}</span>
            <span className="text-[14px] font-bold">{r.name}<FlightTag flight={r.flight} /></span>
            <div className="flex flex-wrap gap-1.5">
              {r.chips.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-sm bg-surface-dim px-2 py-1 text-[11px] leading-none text-ink">
                  <span>{c.label}</span><span className="font-bold tabular-nums">{money(c.amount)}</span>
                </span>
              ))}
            </div>
            <span className="text-right text-[16px] font-extrabold tabular-nums">{money(r.total)}</span>
          </div>
        ))}
        <div className={`mt-2 grid ${cols} items-center gap-x-3 rounded-sm bg-surface px-2 py-2.5 text-[13px] font-bold`}>
          <span />
          <span>{view.totals.paid} players paid</span>
          <span className="font-medium text-ink-muted">{view.totals.noPayout.length > 0 ? `No payout: ${view.totals.noPayout.join(' · ')}` : ''}</span>
          <span className="text-right tabular-nums">{money(view.totals.paidOut)}</span>
        </div>
      </section>

      <p className="mt-3 text-[11px] text-ink-muted">Tied places share the combined prize equally (shown as "tie").</p>
      <ExportFooter left={`Final results · ${view.dateShort}`} />
    </ExportSheet>
  )
}

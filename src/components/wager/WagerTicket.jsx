import LeagueMark from '../ui/LeagueMark'
import { money } from '../../lib/wagerResultsView'

/**
 * WagerTicket — the bettor's receipt. Presentational: everything comes from buildTicketView.
 * Max 420px wide, centered. The outer wrapper carries the page background so a PNG capture of it
 * keeps the scalloped edges and tear-line notches looking cut out of the paper.
 * Monospace is used only for the ticket id.
 */
const PAGE_BG = '#f4f3f0' // surface-dim; also the PNG background so notches read as cut-outs

const PAY = {
  venmo:  { label: 'VENMO',    cls: 'bg-status-active-bg text-status-active-text' },
  cash:   { label: 'CASH',     cls: 'bg-surface-high text-ink-muted' },
  unpaid: { label: 'NOT PAID', cls: 'bg-status-upcoming-bg text-status-upcoming-text' },
}

export const TICKET_PNG_BACKGROUND = PAGE_BG

const scallop = (top) => ({
  height: 7,
  backgroundImage: `radial-gradient(circle at 7px ${top ? '0' : '7px'}, ${PAGE_BG} 5px, transparent 5.5px)`,
  backgroundSize: '14px 7px',
  backgroundRepeat: 'repeat-x',
})

function Tear() {
  return (
    <div className="relative h-5" aria-hidden="true">
      <span className="absolute -left-2.5 top-0 h-5 w-5 rounded-full" style={{ background: PAGE_BG }} />
      <span className="absolute -right-2.5 top-0 h-5 w-5 rounded-full" style={{ background: PAGE_BG }} />
      <span className="absolute inset-x-6 top-1/2 border-t border-dashed border-surface-highest" />
    </div>
  )
}

/** Decorative barcode: bar widths come from the ticket id so each ticket looks its own. */
function Barcode({ seed }) {
  const bars = []
  let x = 0
  for (let i = 0; x < 300; i++) {
    const c = seed.charCodeAt(i % seed.length) + i * 7
    const w = 1 + (c % 3)
    if (i % 2 === 0) bars.push(<rect key={i} x={x} y={0} width={w} height={44} />)
    x += w + (c % 2) + 1
  }
  return (
    <svg viewBox="0 0 300 44" preserveAspectRatio="none" className="h-11 w-full fill-ink" aria-hidden="true">{bars}</svg>
  )
}

function placedLabel(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${t}`
}

function BetRow({ bet }) {
  const pay = PAY[bet.pay]
  const r = bet.result
  return (
    <li className="border-t border-surface-border px-5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">{bet.context}</p>
          <p className="mt-0.5 break-words text-[15px] font-bold leading-snug text-ink">{bet.pick}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-bold tabular-nums text-ink">{money(bet.amount)}</p>
          <span className={`mt-1 inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${pay.cls}`}>{pay.label}</span>
        </div>
      </div>
      {r?.kind === 'won' && (
        <div className="mt-2 flex items-center justify-between rounded-sm bg-status-active-bg px-3 py-1.5 text-sm font-bold text-status-active-text">
          <span>✓ Won</span><span className="tabular-nums">{r.text}</span>
        </div>
      )}
      {r && r.kind !== 'won' && <p className="mt-1.5 text-xs text-ink-muted">{r.text}</p>}
    </li>
  )
}

export default function WagerTicket({ view, leagueName, logoUrl, eventName }) {
  const { totals, settled } = view
  return (
    <div className="mx-auto w-full max-w-[420px] px-0 py-2" style={{ background: PAGE_BG }}>
      <div className="relative bg-white font-sans text-ink shadow-card">
        <div className="absolute inset-x-0 -top-px" style={scallop(true)} aria-hidden="true" />

        <header className="px-5 pb-4 pt-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <LeagueMark name={leagueName} logoUrl={logoUrl} size={48} />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase leading-snug tracking-[0.1em] text-fairway-700">{leagueName}</p>
                <h1 className="text-2xl font-extrabold leading-tight text-ink" style={{ letterSpacing: '-0.02em' }}>Wager ticket</h1>
              </div>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${view.final ? 'bg-status-active-bg text-status-active-text' : 'bg-status-upcoming-bg text-status-upcoming-text'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${view.final ? 'bg-fairway-500' : 'bg-current'}`} aria-hidden="true" />
              {view.final ? 'Settled' : 'Pending'}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-sm border border-surface-border bg-surface-dim px-4 py-3 text-sm">
            <div className="min-w-0">
              <dt className="text-[11px] text-ink-muted">Ticket</dt>
              <dd className="break-all font-mono text-[13px] font-bold">{view.id}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] text-ink-muted">Bettor</dt>
              <dd className="break-words font-bold">{view.bettor}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] text-ink-muted">Event</dt>
              <dd className="break-words font-bold">{eventName}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] text-ink-muted">Placed</dt>
              <dd className="font-bold">{placedLabel(view.placedAt)}</dd>
            </div>
          </dl>
        </header>

        <Tear />

        {view.groups.map(g => (
          <section key={g.key} className="pb-2">
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">{g.title}</h2>
              <span className="text-xs text-ink-muted">{g.bets.length} {g.bets.length === 1 ? 'bet' : 'bets'}</span>
            </div>
            <ul>{g.bets.map(b => <BetRow key={b.id} bet={b} />)}</ul>
          </section>
        ))}

        <Tear />

        <section className="px-5 pb-4 pt-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-base font-bold">Ticket cost</p>
            <p className="text-[28px] font-extrabold tabular-nums leading-none">{money(totals.cost)}</p>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {totals.count} {totals.count === 1 ? 'bet' : 'bets'}{totals.each != null ? ` · ${money(totals.each)} each` : ''}
          </p>
          <dl className="mt-2 space-y-1 text-sm text-ink-muted">
            {totals.cash > 0 && <div className="flex justify-between"><dt>Paid cash</dt><dd className="tabular-nums">{money(totals.cash)}</dd></div>}
            {totals.venmo > 0 && <div className="flex justify-between"><dt>Paid Venmo</dt><dd className="tabular-nums">{money(totals.venmo)}</dd></div>}
            {totals.unpaid > 0 && <div className="flex justify-between"><dt>Not paid</dt><dd className="tabular-nums">{money(totals.unpaid)}</dd></div>}
          </dl>

          {settled && (
            <div className="mt-4 rounded-sm bg-status-active-bg px-4 py-3 text-status-active-text">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-bold">Total payout</p>
                <p className="text-2xl font-extrabold tabular-nums">{money(settled.payout)}</p>
              </div>
              <div className="mt-1 flex justify-between text-sm font-semibold">
                <span>{settled.won} of {settled.count} bets won</span>
                <span className="tabular-nums">Net {settled.netLabel}</span>
              </div>
            </div>
          )}
        </section>

        <footer className="px-5 pb-7 pt-1 text-center">
          <Barcode seed={view.id} />
          <p className="mt-2 font-mono text-xs tracking-wider text-ink-muted">{view.id}</p>
          <p className="mt-2 text-xs text-ink-muted">Show this ticket at the wager desk to collect cash winnings.</p>
        </footer>

        <div className="absolute inset-x-0 -bottom-px" style={scallop(false)} aria-hidden="true" />
      </div>
    </div>
  )
}

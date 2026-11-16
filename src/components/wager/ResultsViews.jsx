/**
 * ResultsViews — the card body of the wager results page: "Find your name" + the
 * "By bettor | By pool" toggle, and the two views. Presentational and controlled; the page owns
 * the search text and the view. Rows come from lib/wagerSummaryView.js. Money uses the standard
 * text color (no per-pool colors). On a phone each bettor is a small stacked block, so nothing
 * scrolls sideways.
 */

import { useId, useState } from 'react'
import SegmentedToggle from '../ui/SegmentedToggle'
import { Chip, StatusPill } from './WagerPayoutSummary'
import { money, netText, matchesQuery } from '../../lib/wagerResultsView'

export const VIEW_OPTIONS = [
  { value: 'bettor', label: 'By bettor' },
  { value: 'pool', label: 'By pool' },
]

export function ResultsToolbar({ query, onQuery, view, onView }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-3 border-b border-surface-border p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
      <div className="w-full sm:max-w-xs">
        <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">Find your name</label>
        <input
          id={id}
          type="search"
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="Search by bettor name"
          autoComplete="off"
          className="h-11 w-full rounded-sm border border-surface-highest bg-white px-3 text-sm text-ink placeholder:text-ink-muted focus:border-fairway-700 focus:outline-none focus:ring-2 focus:ring-fairway-500"
        />
      </div>
      <SegmentedToggle options={VIEW_OPTIONS} value={view} onChange={onView} label="Results view" />
    </div>
  )
}

const HEAD = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted'

export function BettorView({ rows, totals, losing, searching, legend }) {
  // Hover (or tap/focus) a chip to see what it stands for, e.g. M3 -> "Match 3: Paguyo vs Lopez".
  const detailOf = Object.fromEntries((legend ?? []).map(l => [l.label, l.text]))
  if (rows.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-ink-muted">
        {searching ? 'No winning bets match that name. Didn’t see your name? None of your picks won this time.' : 'No results yet. They appear once scores are entered.'}
      </p>
    )
  }
  return (
    <div>
      <div className={`hidden grid-cols-[32px_minmax(120px,1fr)_minmax(0,2fr)_80px_90px_90px] items-center gap-3 border-b border-surface-border px-5 py-2.5 sm:grid ${HEAD}`}>
        <span>#</span><span>Bettor</span><span>Winning bets</span>
        <span className="text-right">Staked</span><span className="text-right">Payout</span><span className="text-right">Net</span>
      </div>
      <ul>
        {rows.map(r => (
          <li key={r.name} className="border-b border-surface-border px-4 py-3 last:border-b-0 sm:px-5">
            <div className="grid grid-cols-[28px_1fr_auto] items-start gap-x-3 gap-y-2 sm:grid-cols-[32px_minmax(120px,1fr)_minmax(0,2fr)_80px_90px_90px] sm:items-center">
              <span className="pt-0.5 text-sm tabular-nums text-ink-muted">{r.rank}</span>
              <span className="min-w-0 break-words text-[15px] font-bold text-ink">{r.name}</span>
              <span className="text-right sm:order-last sm:col-start-6">
                <span className="block text-[15px] font-semibold tabular-nums text-fairway-700">{netText(r.net)}</span>
              </span>
              <div className="col-span-3 flex flex-wrap gap-1.5 sm:order-3 sm:col-span-1 sm:col-start-3">
                {r.chips.map((c, i) => <Chip key={i} {...c} detail={detailOf[c.label]} />)}
              </div>
              <span className="hidden text-right text-sm tabular-nums text-ink-muted sm:order-4 sm:block">{money(r.staked)}</span>
              <span className="hidden text-right text-[15px] font-bold tabular-nums text-ink sm:order-5 sm:block">{money(r.payout)}</span>
              <span className="col-span-3 flex justify-between text-xs text-ink-muted sm:hidden">
                <span>Staked {money(r.staked)}</span>
                <span className="font-bold text-ink">Payout {money(r.payout)}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {!searching && totals && (
        <div className="flex items-center justify-between gap-3 bg-surface-dim px-4 py-3 text-sm font-bold text-ink sm:grid sm:grid-cols-[32px_minmax(120px,1fr)_minmax(0,2fr)_80px_90px_90px] sm:justify-normal sm:px-5">
          {/* Same grid as the rows above so each total sits directly under its column. */}
          <span className="sm:col-span-3">{totals.winners} winner{totals.winners === 1 ? '' : 's'}</span>
          <span className="flex gap-4 tabular-nums sm:contents">
            <span className="hidden text-right text-ink-muted sm:block">{money(totals.staked)}</span>
            <span className="sm:text-right">{money(totals.payout)}</span>
            <span className="text-fairway-700 sm:text-right">{netText(totals.net)}</span>
          </span>
        </div>
      )}
      <p className="px-4 py-3 text-xs text-ink-muted sm:px-5">
        Payout includes your stake. Net counts winning bets only. Didn’t see your name? None of your picks won this time.
        {!searching && totals && losing > 0 ? ` The ${netText(totals.net)} profit equals the stakes from the ${losing} losing bets.` : ''}
      </p>
    </div>
  )
}

export function PoolCard({ card }) {
  return (
    <article className="overflow-hidden rounded-sm border border-surface-border bg-white">
      <header className="border-b border-surface-border bg-surface-dim px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={HEAD}>{card.kind}</p>
            <h3 className="mt-0.5 text-[15px] font-bold leading-snug text-ink">{card.title}</h3>
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums text-ink">{money(card.pool)}</span>
        </div>
        <span className="mt-2 inline-block rounded-full bg-status-active-bg px-2.5 py-0.5 text-xs font-semibold text-status-active-text">{card.pill}</span>
        {card.note && <p className="mt-2 text-xs text-ink-muted">{card.note}</p>}
      </header>
      {card.rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-ink-muted">No winning bets.</p>
      ) : (
        <div>
          <div className={`grid grid-cols-[1fr_64px_72px_72px] gap-2 px-4 py-2 ${HEAD}`}>
            <span>Bettor</span><span className="text-right">Stake</span><span className="text-right">Payout</span><span className="text-right">Net</span>
          </div>
          {card.rows.map((r, i) => (
            <div key={`${r.name}-${i}`} className="grid grid-cols-[1fr_64px_72px_72px] items-center gap-2 border-t border-surface-border px-4 py-2.5 text-sm">
              <span className="min-w-0 break-words font-bold text-ink">{r.name}</span>
              <span className="text-right tabular-nums text-ink-muted">{money(r.stake)}</span>
              <span className="text-right font-bold tabular-nums text-ink">{money(r.payout)}</span>
              <span className="text-right tabular-nums text-fairway-700">{netText(r.net)}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

export function PoolView({ cards, searching }) {
  if (cards.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-ink-muted">
        {searching ? 'No winning bets match that name.' : 'No results yet. They appear once scores are entered.'}
      </p>
    )
  }
  return (
    <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
      {cards.map(c => <PoolCard key={c.key} card={c} />)}
    </div>
  )
}

export { StatusPill }

// ─── All bets (public, read-only) ────────────────────────────────────────────

const BET_FILTERS = [
  { value: 'all', label: 'All' }, { value: 'win', label: 'Win' }, { value: 'place', label: 'Place' }, { value: 'match', label: 'Match' },
]
const BET_TAG = {
  win:   'bg-status-active-bg text-status-active-text',
  place: 'bg-status-upcoming-bg text-status-upcoming-text',
  match: 'bg-surface-high text-ink-muted',
}
const BET_ROW = 'sm:grid-cols-[minmax(120px,1.2fr)_72px_minmax(120px,1.4fr)_88px]'
const BETS_PAGE = 10

/**
 * Every bet placed on the event, shown once betting has closed: bettor, bet type, pick and
 * stake. Read-only, with no payment details. Rows come from publicBetRows (lib/wagerResultsView).
 * Filter by type or search a bettor; the first 10 show, the rest expand.
 */
export function AllBetsPublicCard({ rows }) {
  const id = useId()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const shown = rows.filter(r => (filter === 'all' || r.kind === filter) && matchesQuery(r.bettor, query))
  const visible = showAll ? shown : shown.slice(0, BETS_PAGE)
  const total = shown.reduce((t, r) => t + r.amount, 0)
  const narrowed = filter !== 'all' || query.trim().length > 0

  return (
    <section className="overflow-hidden rounded-sm border border-surface-border bg-white" aria-labelledby={`${id}-title`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-surface-border px-4 py-3 sm:px-5">
        <h2 id={`${id}-title`} className="text-lg font-bold text-ink">All bets</h2>
        <p className="text-sm text-ink-muted">
          {rows.length === 0 ? 'No bets were placed' : `${shown.length}${narrowed ? ` of ${rows.length}` : ''} bet${(narrowed ? rows.length : shown.length) === 1 ? '' : 's'} · ${money(total)}`}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-muted">No bets were placed on this event.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 border-b border-surface-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <SegmentedToggle options={BET_FILTERS} value={filter} onChange={v => { setFilter(v); setShowAll(false) }} label="Filter bets by type" />
            <input
              type="search" value={query} onChange={e => { setQuery(e.target.value); setShowAll(false) }}
              placeholder="Search by bettor" aria-label="Search bets by bettor" autoComplete="off"
              className="h-11 w-full rounded-sm border border-surface-highest bg-white px-3 text-sm text-ink placeholder:text-ink-muted focus:border-fairway-700 focus:outline-none focus:ring-2 focus:ring-fairway-500 sm:max-w-[220px]"
            />
          </div>
          <div className={`hidden gap-3 border-b border-surface-border px-5 py-2.5 sm:grid ${BET_ROW} ${HEAD}`}>
            <span>Bettor</span><span>Type</span><span>Pick</span><span className="text-right">Stake</span>
          </div>
          {shown.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">No bets match.</p>
          ) : (
            <ul>
              {visible.map(r => (
                <li key={r.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-surface-border px-4 py-3 last:border-b-0 sm:grid sm:px-5 ${BET_ROW}`}>
                  <p className="w-full min-w-0 break-words text-[15px] font-bold text-ink sm:w-auto">{r.bettor}</p>
                  <div><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${BET_TAG[r.kind]}`}>{r.tag}</span></div>
                  <p className="min-w-0 flex-1 break-words text-sm text-ink">{r.pick}</p>
                  <p className="text-sm font-bold tabular-nums text-ink sm:text-right">{money(r.amount)}</p>
                </li>
              ))}
            </ul>
          )}
          {shown.length > BETS_PAGE && (
            <div className="border-t border-surface-border px-4 py-2 text-center">
              <button
                type="button"
                onClick={() => setShowAll(a => !a)}
                aria-expanded={showAll}
                className="min-h-[44px] rounded-sm px-4 text-sm font-semibold text-fairway-700 hover:bg-surface-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500"
              >
                {showAll ? 'Show fewer' : `Show all ${shown.length}`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

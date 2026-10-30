/**
 * Pieces of the admin wager board (presentation only). Every handler comes from the page and
 * works exactly as it did: add a manual bet, close/re-open betting, set a bet's payment method,
 * remove / restore a bet, remove all.
 */

import { useState } from 'react'
import Button from '../ui/Button'
import SegmentedToggle from '../ui/SegmentedToggle'
import { matchesQuery } from '../../lib/wagerResultsView'

export const fmt = n => `$${Number(n).toFixed(2)}`
const HEAD = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted'
const DANGER_OUTLINE = '!border-red-300 !text-red-600 hover:!bg-red-50'

// ─── Betting status bar ──────────────────────────────────────────────────────

export function BettingStatusBar({ open, count, note, canToggle, toggling, onToggle }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-sm border px-4 py-3 ${open ? 'border-surface-border bg-status-active-bg' : 'border-surface-border bg-white'}`}>
      <div className="min-w-0">
        <p className={`flex items-center gap-2 text-sm font-bold ${open ? 'text-status-active-text' : 'text-ink'}`}>
          <span className={`h-2 w-2 rounded-full ${open ? 'bg-fairway-500' : 'bg-surface-outline'}`} aria-hidden="true" />
          {open ? `Betting is open · ${count} bet${count === 1 ? '' : 's'}` : 'Betting is closed. Bets taken in person can still be added below.'}
        </p>
        {note && <p className="mt-0.5 text-xs text-ink-muted">{note}</p>}
      </div>
      {canToggle && (
        open
          ? <Button variant="secondary" className={DANGER_OUTLINE} loading={toggling} onClick={() => { if (window.confirm('Close betting? Players will no longer be able to place bets from the bet form.')) onToggle() }}>Close betting</Button>
          : <Button variant="secondary" loading={toggling} onClick={onToggle}>Re-open betting</Button>
      )}
    </div>
  )
}

// ─── All bets ────────────────────────────────────────────────────────────────

const TAG = {
  WIN:   'bg-status-active-bg text-status-active-text',
  PLACE: 'bg-status-upcoming-bg text-status-upcoming-text',
  MATCH: 'bg-surface-high text-ink-muted',
}

export function TypeTag({ w, pairings }) {
  const m = w.match_pairing_id ? pairings.find(p => p.id === w.match_pairing_id) : null
  const kind = w.match_pairing_id ? 'MATCH' : w.pick_1st ? 'WIN' : 'PLACE'
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${TAG[kind]}`}>{kind === 'MATCH' ? `M${m?.match_number ?? ''}` : kind}</span>
}

function PaidBy({ w, acting, onChange, removed }) {
  const tone = w.payment_method ? 'border-surface-highest bg-white text-ink' : 'border-surface-border bg-status-upcoming-bg text-status-upcoming-text'
  if (removed) return <span className="text-xs text-ink-muted">{w.payment_method ? (w.payment_method === 'venmo' ? 'Venmo' : 'Cash') : 'Not paid'}</span>
  return (
    <select
      aria-label={`Paid by, ${w.bettor_name}`}
      value={w.payment_method ?? ''}
      disabled={acting === w.id}
      onChange={e => onChange(w.id, e.target.value)}
      className={`h-9 rounded-sm border px-2 text-xs font-semibold ${tone}`}
    >
      <option value="">Not paid</option>
      <option value="venmo">Venmo</option>
      <option value="cash">Cash</option>
    </select>
  )
}

const ROW = 'sm:grid-cols-[minmax(120px,1.2fr)_64px_minmax(100px,1.2fr)_72px_116px_84px]'

function BetLine({ w, pairings, playerName, acting, onPayment, onDelete, onRestore, removed = false }) {
  return (
    <li className={`flex flex-col gap-2 border-b border-surface-border px-4 py-3 last:border-b-0 sm:grid sm:items-center sm:gap-3 ${ROW} ${removed ? 'opacity-70' : ''}`}>
      <div className="min-w-0">
        <p className="break-words text-[15px] font-bold text-ink">{w.bettor_name}</p>
        <p className="text-[11px] text-ink-muted">{new Date(w.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
      </div>
      <div><TypeTag w={w} pairings={pairings} /></div>
      <p className="min-w-0 break-words text-sm text-ink">{playerName(w.pick_1st ?? w.pick_2nd ?? w.pick_match)}</p>
      <p className="text-sm font-bold tabular-nums text-ink sm:text-right">{fmt(w.amount)}</p>
      <div><PaidBy w={w} acting={acting} onChange={onPayment} removed={removed} /></div>
      <div className="sm:text-right">
        {removed
          ? <Button size="sm" variant="secondary" disabled={acting === w.id} onClick={() => onRestore(w.id)}>{acting === w.id ? '…' : 'Restore'}</Button>
          : <Button size="sm" variant="secondary" className={DANGER_OUTLINE} disabled={acting === w.id} onClick={() => onDelete(w.id)}>{acting === w.id ? '…' : 'Delete'}</Button>}
      </div>
    </li>
  )
}

const FILTERS = [
  { value: 'all', label: 'All' }, { value: 'win', label: 'Win' }, { value: 'place', label: 'Place' }, { value: 'match', label: 'Match' },
]
const kindOf = w => (w.match_pairing_id ? 'match' : w.pick_1st ? 'win' : 'place')

export function AllBetsCard({ bets, pairings, playerName, acting, onPayment, onDelete, onClearAll, onCopyLink }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const shown = bets.filter(w => (filter === 'all' || kindOf(w) === filter) && matchesQuery(w.bettor_name, query))
  const visible = showAll ? shown : shown.slice(0, 10)

  return (
    <section className="overflow-hidden rounded-sm border border-surface-border bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
        <h2 className="text-lg font-bold text-ink">All bets</h2>
        {bets.length > 0 && <Button size="sm" variant="secondary" className={DANGER_OUTLINE} onClick={onClearAll}>Remove all</Button>}
      </header>

      {bets.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-ink-muted">No bets yet. Share the bet form link.</p>
          <Button className="mt-3" variant="secondary" icon="copy" onClick={onCopyLink}>Copy bet form link</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 border-b border-surface-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedToggle options={FILTERS} value={filter} onChange={v => { setFilter(v); setShowAll(false) }} label="Filter bets" />
            <input
              type="search" value={query} onChange={e => { setQuery(e.target.value); setShowAll(false) }}
              placeholder="Search by bettor" aria-label="Search bets by bettor" autoComplete="off"
              className="h-11 w-full rounded-sm border border-surface-highest bg-white px-3 text-sm text-ink placeholder:text-ink-muted focus:border-fairway-700 focus:outline-none focus:ring-2 focus:ring-fairway-500 sm:max-w-[220px]"
            />
          </div>
          <div className={`hidden gap-3 border-b border-surface-border px-4 py-2 sm:grid ${ROW} ${HEAD}`}>
            <span>Bettor</span><span>Type</span><span>Pick</span><span className="text-right">Stake</span><span>Paid by</span><span />
          </div>
          {shown.length === 0
            ? <p className="px-4 py-8 text-center text-sm text-ink-muted">No bets match.</p>
            : <ul>{visible.map(w => <BetLine key={w.id} w={w} pairings={pairings} playerName={playerName} acting={acting} onPayment={onPayment} onDelete={onDelete} />)}</ul>}
          {shown.length > 10 && (
            <div className="border-t border-surface-border px-4 py-2 text-center">
              <Button variant="ghost" onClick={() => setShowAll(a => !a)}>{showAll ? 'Show fewer' : `Show all ${shown.length}`}</Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export function RemovedBetsCard({ bets, pairings, playerName, acting, onRestore }) {
  if (bets.length === 0) return null
  return (
    <details className="group overflow-hidden rounded-sm border border-surface-border bg-white">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-ink [&::-webkit-details-marker]:hidden">
        <span>Removed bets ({bets.length})</span>
        <svg className="text-ink-muted transition-transform group-open:rotate-180" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <ul className="border-t border-surface-border">
        {bets.map(w => <BetLine key={w.id} w={w} pairings={pairings} playerName={playerName} acting={acting} onRestore={onRestore} removed />)}
      </ul>
    </details>
  )
}

// ─── Add a bet taken in person ───────────────────────────────────────────────

const field = 'h-11 w-full rounded-sm border border-surface-highest bg-white px-3 text-sm text-ink placeholder:text-ink-muted focus:border-fairway-700 focus:outline-none focus:ring-2 focus:ring-fairway-500'
const label = 'mb-1 block text-xs font-semibold text-ink-muted'

const KINDS = [
  { value: 'win', label: 'WIN (1st)' }, { value: 'place', label: 'PLACE (1st or 2nd)' }, { value: 'match', label: 'MATCH' },
]

/** Admin-only form for a bet taken in person. Always available, even after betting has closed. */
export function ManualBetCard({ players, pairings, playerName, bettorNames, onAdd }) {
  const [bettor,    setBettor]    = useState('')
  const [kind,      setKind]      = useState('win')
  const [playerId,  setPlayerId]  = useState('')
  const [matchId,   setMatchId]   = useState('')
  const [matchPick, setMatchPick] = useState('')
  const [amount,    setAmount]    = useState('')
  const [method,    setMethod]    = useState('')
  const [saving,    setSaving]    = useState(false)

  const sortedPlayers = [...players].sort((a, b) => playerName(a.player_id).localeCompare(playerName(b.player_id)))
  const match = pairings.find(m => m.id === matchId)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    const saved = await onAdd({ bettor, kind, playerId, matchId, matchPick, amount, method })
    setSaving(false)
    if (saved) { setPlayerId(''); setMatchId(''); setMatchPick(''); setAmount('') } // keep name + type for the next bet
  }

  return (
    <section className="rounded-sm border border-surface-border bg-white p-5">
      <h2 className="text-lg font-bold text-ink">Add a bet taken in person</h2>
      <p className="mt-0.5 text-sm text-ink-muted">Shows up on the board, the Excel export and the PNG right away. Works any time, even after betting has closed.</p>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <div>
          <label className={label} htmlFor="mb-name">Bettor name</label>
          <input id="mb-name" list="mb-names" className={field} value={bettor} onChange={e => setBettor(e.target.value)} placeholder="First Last" autoComplete="off" />
          <datalist id="mb-names">{bettorNames.map(n => <option key={n} value={n} />)}</datalist>
        </div>

        <SegmentedToggle options={KINDS} value={kind} onChange={setKind} label="Bet type" className="w-full [&>button]:flex-1" />

        {kind !== 'match' ? (
          <div>
            <label className={label} htmlFor="mb-player">Player</label>
            <select id="mb-player" className={field} value={playerId} onChange={e => setPlayerId(e.target.value)}>
              <option value="">Select player</option>
              {sortedPlayers.map(p => <option key={p.player_id} value={p.player_id}>{playerName(p.player_id)}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className={label} htmlFor="mb-match">Match</label>
              <select id="mb-match" className={field} value={matchId} onChange={e => { setMatchId(e.target.value); setMatchPick('') }}>
                <option value="">Select match</option>
                {pairings.map(m => <option key={m.id} value={m.id}>Match {m.match_number}: {playerName(m.player_a_id)} vs {playerName(m.player_b_id)}</option>)}
              </select>
            </div>
            {match && (
              <div>
                <label className={label} htmlFor="mb-pick">Picked to win</label>
                <select id="mb-pick" className={field} value={matchPick} onChange={e => setMatchPick(e.target.value)}>
                  <option value="">Select winner</option>
                  <option value={match.player_a_id}>{playerName(match.player_a_id)}</option>
                  <option value={match.player_b_id}>{playerName(match.player_b_id)}</option>
                </select>
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="mb-amount">Amount ($)</label>
            <input id="mb-amount" type="number" min="0" step="0.01" inputMode="decimal" className={field} value={amount} onChange={e => setAmount(e.target.value)} placeholder="5" />
          </div>
          <div>
            <label className={label} htmlFor="mb-method">Paid by</label>
            <select id="mb-method" className={field} value={method} onChange={e => setMethod(e.target.value)}>
              <option value="">Not set</option>
              <option value="cash">Cash</option>
              <option value="venmo">Venmo</option>
            </select>
          </div>
        </div>

        <button
          type="submit" disabled={saving}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-sm bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {saving ? 'Adding…' : 'Add bet'}
        </button>
      </form>
    </section>
  )
}

// ─── Smaller cards ───────────────────────────────────────────────────────────

export function Card({ title, aside, children }) {
  return (
    <section className="overflow-hidden rounded-sm border border-surface-border bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-surface-border px-4 py-3">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {aside && <span className="text-xs text-ink-muted">{aside}</span>}
      </header>
      {children}
    </section>
  )
}

export function PaymentsCard({ rows, totals }) {
  if (rows.length === 0) return null
  return (
    <Card title="Payments" aside={`Venmo ${fmt(totals.venmo)} · Cash ${fmt(totals.cash)}${totals.unset > 0 ? ` · Not set ${fmt(totals.unset)}` : ''}`}>
      <div className={`grid grid-cols-[1fr_72px_72px_72px_80px] gap-2 border-b border-surface-border px-4 py-2 ${HEAD}`}>
        <span>Bettor</span><span className="text-right">Venmo</span><span className="text-right">Cash</span><span className="text-right">Not set</span><span className="text-right">Total</span>
      </div>
      {rows.map(r => (
        <div key={r.name} className="grid grid-cols-[1fr_72px_72px_72px_80px] items-center gap-2 border-b border-surface-border px-4 py-2 text-sm last:border-b-0">
          <span className="min-w-0 break-words font-bold text-ink">{r.name}</span>
          <span className="text-right tabular-nums text-ink-muted">{r.venmo ? fmt(r.venmo) : '—'}</span>
          <span className="text-right tabular-nums text-ink-muted">{r.cash ? fmt(r.cash) : '—'}</span>
          <span className="text-right tabular-nums text-ink-muted">{r.unset ? fmt(r.unset) : '—'}</span>
          <span className="text-right font-bold tabular-nums text-ink">{fmt(r.venmo + r.cash + r.unset)}</span>
        </div>
      ))}
    </Card>
  )
}

export function OddsCard({ rows }) {
  if (rows.length === 0) return null
  return (
    <Card title="Live odds">
      <div className={`grid grid-cols-[1fr_72px_56px_72px_56px] gap-2 border-b border-surface-border px-4 py-2 ${HEAD}`}>
        <span>Player</span><span className="text-right">Win</span><span className="text-right">Odds</span><span className="text-right">Place</span><span className="text-right">Odds</span>
      </div>
      {rows.map(r => (
        <div key={r.name} className="grid grid-cols-[1fr_72px_56px_72px_56px] items-center gap-2 border-b border-surface-border px-4 py-2 text-sm last:border-b-0">
          <span className="min-w-0 break-words font-bold text-ink">{r.name}</span>
          <span className="text-right tabular-nums text-ink">{r.winAmt > 0 ? fmt(r.winAmt) : '—'}</span>
          <span className="text-right text-xs tabular-nums text-ink-muted">{r.winOdds}</span>
          <span className="text-right tabular-nums text-ink">{r.placeAmt > 0 ? fmt(r.placeAmt) : '—'}</span>
          <span className="text-right text-xs tabular-nums text-ink-muted">{r.placeOdds}</span>
        </div>
      ))}
    </Card>
  )
}

export function MatchPoolsCard({ cards, playerName }) {
  if (cards.length === 0) return null
  return (
    <Card title="Match pools" aside="Each match is its own pool · Halved = stakes refunded">
      <ul>
        {cards.map(({ match, sideAmt, pool, result, settlement }) => (
          <li key={match.id} className="border-b border-surface-border px-4 py-3 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold text-ink">Match {match.match_number}: {playerName(match.player_a_id)} vs {playerName(match.player_b_id)}</p>
              <span className="shrink-0 text-sm font-bold tabular-nums text-ink">{fmt(pool)}</span>
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">{result ? `${result.matchStatus}${result.winner ? ' · Final' : ''}` : 'Match not scored yet'}</p>
            <div className="mt-2 space-y-1">
              {[match.player_a_id, match.player_b_id].map(pid => {
                const amt = sideAmt[pid] ?? 0
                return (
                  <div key={pid} className="flex justify-between text-sm">
                    <span className="text-ink">{playerName(pid)}</span>
                    <span className="tabular-nums text-ink">{amt > 0 ? <>{fmt(amt)} <span className="text-xs text-ink-muted">{(pool / amt).toFixed(2)}x</span></> : <span className="text-ink-muted">—</span>}</span>
                  </div>
                )
              })}
            </div>
            {settlement?.type === 'club' && (
              <p className="mt-2 text-xs text-ink-muted">Winner: {playerName(settlement.winnerPid)}. No bets on the winner, so {fmt(pool)} rolls to the club.</p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

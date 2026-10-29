/**
 * PayoutResultsCard — the Results tab: ONE list at a time, switched by "By category | By player"
 * (By category is the default).
 *
 * By player: one collapsed row per paid player (rank, name, flight tag, "N prizes", total); click a
 * row to see what they won. By category: sections (18-Hole Net, Front 9 Net, … Full field) with
 * Flight A and Flight B side by side; tied prizes list every tied name and what each gets.
 *
 * Presentational. Every number comes from `computePayouts` (`byPlayer`, `byCategory`) exactly as
 * before — nothing is re-calculated here. Totals shown are sums of those numbers.
 */

import { useState } from 'react'
import { ActionButton } from '../ui/Button'
import SegmentedToggle from '../ui/SegmentedToggle'
import {
  money, cleanLabel, isTieLabel, categorySections, winnerDisplay, totalPaid,
} from '../../lib/payoutView'

function FlightTag({ flight }) {
  if (!flight) return null
  return (
    <span className={`inline-flex h-5 items-center rounded-sm px-1.5 text-[10px] font-bold uppercase ${
      flight === 'A' ? 'bg-status-active-bg text-status-active-text' : 'bg-surface-high text-ink-muted'
    }`}>
      {flight}
    </span>
  )
}

function TieTag() {
  return <span className="ml-2 inline-flex h-5 items-center rounded-sm bg-surface-high px-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted align-middle">Tie · split</span>
}

function Chevron({ open }) {
  return (
    <svg className={`shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function PlayerList({ byPlayer, nameOf, flightOf, noPayout }) {
  const [open, setOpen] = useState(() => new Set())
  const allOpen = byPlayer.length > 0 && open.size === byPlayer.length
  const toggle = id => setOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div>
      <div className="mb-1 flex justify-end">
        <ActionButton variant="ghost" size="sm" onClick={() => setOpen(allOpen ? new Set() : new Set(byPlayer.map(p => p.playerId)))}>
          {allOpen ? 'Collapse all' : 'Expand all'}
        </ActionButton>
      </div>
      <ul className="border-t border-surface-border">
        {byPlayer.map((p, i) => {
          const isOpen = open.has(p.playerId)
          const panelId = `prizes-${p.playerId}`
          return (
            <li key={p.playerId} className="border-b border-surface-border">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(p.playerId)}
                className="flex min-h-[56px] w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-surface-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 sm:px-3"
              >
                <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-ink-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-ink">{nameOf(p.playerId)}</span>
                  <span className="ml-2 align-middle"><FlightTag flight={flightOf(p.playerId)} /></span>
                  <span className="ml-2 text-xs text-ink-muted">{p.items.length} prize{p.items.length !== 1 ? 's' : ''}</span>
                </span>
                <span className="text-base font-bold tabular-nums text-ink">{money(p.total)}</span>
                <Chevron open={isOpen} />
              </button>
              {isOpen && (
                <div id={panelId} className="mx-1 mb-3 rounded-sm border border-surface-border bg-surface-container px-3 sm:mx-12">
                  {p.items.map((item, j) => (
                    <div key={j} className="flex items-center justify-between gap-3 border-t border-surface-border py-2 text-sm first:border-t-0">
                      <span className="text-ink">
                        {cleanLabel(item.category)}
                        {isTieLabel(item.category) && <TieTag />}
                      </span>
                      <span className="font-semibold tabular-nums text-ink">{money(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 px-1 pt-4 text-sm sm:px-3">
        <p className="text-ink-muted">{noPayout.length > 0 ? `No payout: ${noPayout.join(', ')}` : 'Everyone was paid.'}</p>
        <p className="font-bold tabular-nums text-ink">Total paid {money(totalPaid(byPlayer))}</p>
      </div>
    </div>
  )
}

/** "Skins — Flight A (14 skins)" → 14 */
function skinCount(label) {
  return Number(String(label).match(/\((\d+) skins?\)/i)?.[1] ?? 0)
}

function CategoryRow({ entry, nameOf, maxRank, longDriveHole }) {
  const { cat, parsed } = entry
  const d = winnerDisplay(cat, nameOf, maxRank[parsed.family] ?? 3)
  let place = parsed.prize
  if (cat.isSkin) place = `${skinCount(cat.label)} skin${skinCount(cat.label) !== 1 ? 's' : ''}`
  else if (parsed.family === 'long_drive') place = longDriveHole ? `Hole ${longDriveHole}` : 'Winner'
  else if (parsed.family === 'low_putts') place = 'Low putts'
  return (
    <li className="flex items-start justify-between gap-3 border-t border-surface-border py-2.5 text-sm first:border-t-0">
      <div className="flex min-w-0 gap-3">
        <span className="w-14 shrink-0 text-ink-muted">{place}</span>
        <div className="min-w-0">
          <p className={d.kind === 'none' ? 'text-status-upcoming-text' : 'font-semibold text-ink'}>{d.text}</p>
          {d.helper && <p className="text-xs text-ink-muted">{d.helper}</p>}
        </div>
      </div>
      <span className="shrink-0 font-semibold tabular-nums text-ink">{money(cat.amount)}</span>
    </li>
  )
}

function CategoryView({ byCategory, nameOf, maxRank, longDriveHole }) {
  const sections = categorySections(byCategory)
  return (
    <div className="space-y-4">
      {sections.map(sec => {
        const flights = ['A', 'B'].filter(f => sec.cats.some(c => c.parsed.flight === f))
        const hasFlights = flights.length > 0
        const columns = hasFlights ? flights : [null]
        const isSkins = sec.family === 'skins' || sec.family === 'super_skins'
        const title = sec.family === 'long_drive' && longDriveHole ? `Long drive · Hole ${longDriveHole}` : sec.title
        return (
          <section key={sec.family} className="rounded-sm border border-surface-border">
            <header className="flex items-baseline justify-between gap-3 border-b border-surface-border bg-surface-container px-4 py-2.5">
              <h3 className="text-sm font-bold text-ink">{title}</h3>
              <span className="text-sm font-semibold tabular-nums text-ink">{money(sec.total)}</span>
            </header>
            <div className={`grid gap-x-8 px-4 py-2 ${columns.length > 1 ? 'md:grid-cols-2' : ''}`}>
              {columns.map(f => {
                const rows = sec.cats.filter(c => (c.parsed.flight ?? null) === f)
                const colTotal = rows.reduce((s, c) => s + c.cat.amount, 0)
                const skins = rows.reduce((s, c) => s + skinCount(c.cat.label), 0)
                return (
                  <div key={f ?? 'all'}>
                    {hasFlights && (
                      <p className="pt-2 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                        Flight {f}
                        {isSkins && skins > 0 && <span className="ml-2 normal-case tracking-normal">{money(colTotal / skins)} per skin</span>}
                      </p>
                    )}
                    <ul>
                      {rows.map(entry => (
                        <CategoryRow key={entry.cat.key} entry={entry} nameOf={nameOf} maxRank={maxRank} longDriveHole={longDriveHole} />
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default function PayoutResultsCard({
  byPlayer, byCategory, nameOf, flightOf, noPayout = [], maxRank = {}, longDriveHole = null,
  defaultView = 'category', className = '',
}) {
  const [view, setView] = useState(defaultView)
  return (
    <section id="payout-results" className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Payout results</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {view === 'player'
              ? `${byPlayer.length} player${byPlayer.length !== 1 ? 's' : ''} paid, highest first. Select a player to see what they won.`
              : 'Every prize by contest, with the winner and the amount.'}
          </p>
        </div>
        <SegmentedToggle
          label="Group payout results by"
          value={view}
          onChange={setView}
          options={[{ value: 'category', label: 'By category' }, { value: 'player', label: 'By player' }]}
        />
      </header>

      {byPlayer.length === 0 && byCategory.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">No payouts resolved yet.</p>
      ) : view === 'player' ? (
        <PlayerList byPlayer={byPlayer} nameOf={nameOf} flightOf={flightOf} noPayout={noPayout} />
      ) : (
        <CategoryView byCategory={byCategory} nameOf={nameOf} maxRank={maxRank} longDriveHole={longDriveHole} />
      )}
    </section>
  )
}

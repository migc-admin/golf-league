/**
 * RosterCard — the "Roster" card on the Players page.
 *
 *   Roster                                             [ Search players ]
 *   ⚠ 4 players still need a flight
 *   PLAYER                          HI    FLIGHT
 *   Colin Harrison                 0.0    [A|B|Guest] [Tee v]  Edit HI  Remove
 *
 * Presentational. `players` are the page's event_players (already sorted); every control
 * calls a handler the page passes, and those are the same functions the old dropdowns and
 * buttons used:
 *   onSetFlight(ep, 'A' | 'B' | 'guest' | '')   (old flight dropdown / guest toggle)
 *   onSetTee(ep, teeName)                       (old per-player tee override)
 *   onEditHi(ep)                                (old Edit button)
 *   onRemove(ep)                                (old ✕ button)
 * On narrow screens each row stacks: name + HI on top, controls below.
 */

import { useId, useState } from 'react'
import { ActionButton } from './Button'

export function formatHi(ep) {
  const n = Number(ep?.handicap_index)
  return (Number.isFinite(n) ? n : 0).toFixed(1)
}

export function flightValue(ep) {
  return ep.is_guest ? 'guest' : (ep.flight ?? '')
}

/** Tapping the selected option clears it; tapping another selects it. */
export function nextFlightValue(current, pressed) {
  return current === pressed ? '' : pressed
}

export function needsFlight(players) {
  return players.filter(p => !p.is_guest && !p.flight).length
}

export function filterPlayers(players, query) {
  const q = query.trim().toLowerCase()
  if (!q) return players
  return players.filter(p => {
    const first = p.player?.first_name ?? ''
    const last = p.player?.last_name ?? ''
    return `${first} ${last}`.toLowerCase().includes(q) || `${last} ${first}`.toLowerCase().includes(q)
  })
}

function nameOf(ep) {
  return `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim()
}

function WarnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

function FlightToggle({ ep, name, useFlights, onSetFlight }) {
  const current = flightValue(ep)
  const options = useFlights ? [['A', 'A'], ['B', 'B'], ['guest', 'Guest']] : [['guest', 'Guest']]
  return (
    <div role="group" aria-label={`Flight for ${name}`} className="inline-flex overflow-hidden rounded-sm border border-surface-highest">
      {options.map(([value, label], i) => {
        const on = current === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => onSetFlight(ep, nextFlightValue(current, value))}
            className={`min-h-[44px] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 ${
              i > 0 ? 'border-l border-surface-highest' : ''
            } ${on ? 'bg-status-active-bg text-status-active-text' : 'bg-white text-ink hover:bg-surface-dim'}`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// One shared column template for the header and every row, so the headers line up with
// their controls. Below 1100px the table collapses into stacked rows.
const COLS_WITH_TEE = 'min-[1100px]:grid-cols-[minmax(0,1fr)_4rem_9.5rem_8rem_10rem] min-[1100px]:gap-4'
const COLS_NO_TEE   = 'min-[1100px]:grid-cols-[minmax(0,1fr)_4rem_9.5rem_10rem] min-[1100px]:gap-4'
const tableCols = hasTee => (hasTee ? COLS_WITH_TEE : COLS_NO_TEE)

function PlayerRow({ ep, tees, useFlights, onSetFlight, onSetTee, onEditHi, onRemove }) {
  const name = nameOf(ep)
  const detail = [
    ep.adjusted_handicap_index != null && ep.adjusted_handicap_index !== ep.handicap_index ? `Adj ${ep.adjusted_handicap_index}` : null,
    ep.course_handicap != null ? `CH ${ep.course_handicap}` : null,
    ep.match_play_course_handicap != null ? `MP ${ep.match_play_course_handicap}` : null,
    ep.tournament_wins_prior > 0 ? `${ep.tournament_wins_prior} win${ep.tournament_wins_prior !== 1 ? 's' : ''}` : null,
  ].filter(Boolean)

  return (
    <li className={`flex flex-col gap-3 border-t border-surface-border py-3 first:border-t-0 min-[1100px]:grid min-[1100px]:items-center ${tableCols(tees.length > 0)}`}>
      <div className="flex items-start justify-between gap-3 min-[1100px]:contents">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{name}</p>
          {detail.length > 0 && <p className="text-xs text-ink-muted">{detail.join(' · ')}</p>}
        </div>
        <span className="text-sm font-semibold tabular-nums text-ink" aria-label={`Handicap index ${formatHi(ep)}`}>
          {formatHi(ep)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 min-[1100px]:contents">
        <div><FlightToggle ep={ep} name={name} useFlights={useFlights} onSetFlight={onSetFlight} /></div>
        {tees.length > 0 && (
          <select
            className="input h-11 !w-32 shrink-0 bg-white py-0"
            value={ep.tee ?? ''}
            onChange={e => onSetTee(ep, e.target.value)}
            aria-label={`Tee for ${name}`}
          >
            <option value="">No tee set</option>
            {tees.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <ActionButton variant="ghost" label={`Edit handicap for ${name}`} aria-label={`Edit handicap for ${name}`} onClick={() => onEditHi(ep)}>
          Edit HI
        </ActionButton>
        <ActionButton variant="ghost" className="!text-red-600 hover:!text-red-700" aria-label={`Remove ${name}`} onClick={() => onRemove(ep)}>
          Remove
        </ActionButton>
      </div>
    </li>
  )
}

export default function RosterCard({
  id = 'roster', players, tees = [], useFlights = true,
  onSetFlight, onSetTee, onEditHi, onRemove, className = '',
}) {
  const [query, setQuery] = useState('')
  const searchId = useId()
  const shown = filterPlayers(players, query)
  const missing = useFlights ? needsFlight(players) : 0

  return (
    <section id={id} className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-ink">Roster</h2>
        <div className="sm:w-72">
          <label htmlFor={searchId} className="sr-only">Search players</label>
          <input id={searchId} type="search" className="input h-11" placeholder="Search players" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </header>

      {missing > 0 && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-sm border border-surface-border bg-status-upcoming-bg px-4 py-3 text-sm font-semibold text-status-upcoming-text">
          <WarnIcon />
          {missing} player{missing !== 1 ? 's' : ''} still need{missing === 1 ? 's' : ''} a flight
        </div>
      )}

      {players.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">No players added yet. Add players to this event.</p>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">No players match "{query.trim()}".</p>
      ) : (
        <>
          <div className={`hidden border-b border-surface-border pb-2 text-[11px] font-bold uppercase tracking-widest text-ink-muted min-[1100px]:grid ${tableCols(tees.length > 0)}`} aria-hidden="true">
            <span>Player</span><span>HI</span><span>Flight</span>{tees.length > 0 && <span>Tee</span>}<span />
          </div>
          <ul>
            {shown.map(ep => (
              <PlayerRow key={ep.id} ep={ep} tees={tees} useFlights={useFlights}
                onSetFlight={onSetFlight} onSetTee={onSetTee} onEditHi={onEditHi} onRemove={onRemove} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

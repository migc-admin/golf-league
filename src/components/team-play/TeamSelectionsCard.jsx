/**
 * TeamSelectionsCard — "Team selections": one card per team, ordered by rank (roster order before
 * scores exist), in a grid that fits as many ~320px columns as the screen allows.
 *
 *   The Money Team                                     1st · 14 pts
 *   PLAYING THIS EVENT · 2 of 2
 *   [x] John Nothdurft                                     10 pts
 *   [x] Mikel Hodges                                        4 pts
 *   (Show rest of roster (6))          ← locked view: one click shows the other names
 *
 * Editable view: the rest of the roster is listed as checkbox rows (44px). Players registered for
 * this event come first, enabled, with a small "IN EVENT" tag; players who are not registered are
 * greyed out and can't be picked; a team that already has its players disables the unchecked boxes
 * (unchecking one frees them); someone picked by another team shows "On {team}" with a Remove button.
 *
 * Presentational. `cards` come from `teamSelection`; every action is one of the page's existing
 * handlers (select/deselect, remove another team's pick, lock, new team, roster, delete team).
 * Teams are told apart by name and rank only — no team colors.
 */

import { useState } from 'react'
import { ActionButton } from '../ui/Button'
import { fmtPts, TEAM_SIZE } from '../../lib/teamPlayView'

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

function Checkbox({ checked, disabled, onChange, label }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={label}
      className="h-5 w-5 shrink-0 cursor-pointer accent-fairway-700 disabled:cursor-not-allowed"
    />
  )
}

function SmallTag({ children, tone = 'green' }) {
  return (
    <span className={`inline-flex h-5 items-center rounded-sm px-1.5 text-[10px] font-bold uppercase tracking-wide ${
      tone === 'green' ? 'bg-status-active-bg text-status-active-text' : 'bg-surface-high text-ink-muted'
    }`}>
      {children}
    </span>
  )
}

function TeamCard({ card, locked, onToggle, onRemoveOther, onRoster, onDeleteTeam }) {
  const [showRest, setShowRest] = useState(false)
  const { team, rank, points, sel } = card
  const restId = `rest-${team.id}`
  const scored = points != null

  return (
    <article className="overflow-hidden rounded-sm border border-surface-border bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-surface-border bg-surface-container px-4 py-3">
        <h3 className="min-w-0 truncate text-sm font-bold text-ink">{team.name}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-sm font-semibold tabular-nums text-ink-muted">
            {scored ? `${rank != null ? `${ORD[rank - 1] ?? `#${rank}`} · ` : ''}${fmtPts(points)} pts` : `${sel.selected.length + sel.rest.length} players`}
          </span>
          {!locked && onRoster && <ActionButton variant="ghost" size="sm" onClick={() => onRoster(team)}>Roster</ActionButton>}
          {!locked && onDeleteTeam && (
            <ActionButton variant="ghost" size="sm" iconOnly label={`Delete ${team.name}`} className="hover:!text-red-600" onClick={() => onDeleteTeam(team)}>✕</ActionButton>
          )}
        </div>
      </header>

      <div className="p-4">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-ink-muted">
          Playing this event · {sel.count} of {TEAM_SIZE}
        </p>

        {sel.selected.length === 0 && <p className="py-2 text-sm text-ink-muted">{locked ? 'Nobody was selected.' : 'Nobody selected yet.'}</p>}
        <ul>
          {sel.selected.map(p => (
            <li key={p.player_id}>
              <label className="flex min-h-[44px] items-center gap-3 text-sm">
                <Checkbox checked disabled={locked} label={`${p.name} is selected for ${team.name}`} onChange={() => onToggle(team.id, p.player_id)} />
                <span className="min-w-0 flex-1 font-bold text-ink">{p.name}</span>
                {p.points != null && <span className="shrink-0 tabular-nums text-ink-muted">{fmtPts(p.points)} pts</span>}
              </label>
            </li>
          ))}
        </ul>

        {locked ? (
          sel.rest.length > 0 && (
            <div className="mt-2">
              <ActionButton variant="ghost" size="sm" aria-expanded={showRest} aria-controls={restId} onClick={() => setShowRest(v => !v)}>
                {showRest ? 'Hide rest of roster' : `Show rest of roster (${sel.rest.length})`}
              </ActionButton>
              {showRest && <p id={restId} className="mt-2 text-sm text-ink-muted">{sel.rest.map(r => r.name).join(' · ')}</p>}
            </div>
          )
        ) : (
          <>
            <p className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-widest text-ink-muted">Rest of roster</p>
            {sel.rest.length === 0 && <p className="py-2 text-sm text-ink-muted">No other roster members.</p>}
            <ul>
              {sel.rest.map(r => (
                <li key={r.player_id} className={`flex min-h-[44px] items-center gap-3 text-sm ${r.disabled ? 'text-ink-muted' : 'text-ink'}`}>
                  <Checkbox checked={false} disabled={r.disabled} label={`Select ${r.name} for ${team.name}`} onChange={() => onToggle(team.id, r.player_id)} />
                  <span className="min-w-0 flex-1">{r.name}</span>
                  {r.registered && !r.otherTeamName && <SmallTag>In event</SmallTag>}
                  {!r.registered && <span className="shrink-0 text-xs">Not registered</span>}
                  {r.registered && r.otherTeamName && (
                    <span className="flex shrink-0 items-center gap-1 text-xs">
                      On {r.otherTeamName}
                      {onRemoveOther && <ActionButton variant="ghost" size="sm" onClick={() => onRemoveOther(r.otherSelectionId)}>Remove</ActionButton>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </article>
  )
}

export default function TeamSelectionsCard({
  cards, locked, headerAction = null, onToggle, onRemoveOther, onRoster, onDeleteTeam, id = 'team-selections', className = '',
}) {
  return (
    <section id={id} className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Team selections</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {locked
              ? 'Who played for each team. Rosters collapsed to save space.'
              : `Pick ${TEAM_SIZE} players per team from those registered for this event.`}
          </p>
        </div>
        {!locked && headerAction}
      </header>

      {cards.length === 0 ? (
        <p className="py-4 text-sm text-ink-muted">No teams yet.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-4">
          {cards.map(c => (
            <TeamCard key={c.team.id} card={c} locked={locked} onToggle={onToggle} onRemoveOther={onRemoveOther} onRoster={onRoster} onDeleteTeam={onDeleteTeam} />
          ))}
        </div>
      )}
    </section>
  )
}

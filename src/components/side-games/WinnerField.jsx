/**
 * WinnerField — one "who won?" dropdown on the Side Games page.
 *
 *   Flight A  /  Hole 3                       Par 3     (label above, left-aligned; "Par n" only for holes)
 *   [ Select winner                                 v ]
 *   Not entered
 *
 * Presentational and controlled. The page passes the players it may list (already filtered and
 * sorted), the saved `value` ('' none, 'NO_WINNER', or a player id) and `onChange`. `status`
 * drives the line under the dropdown: idle → "Entered"/"Not entered", saving → "Saving…",
 * saved → "Saved", error → the message. Every dropdown has a real <label>; the chevron is
 * decorative. The dropdown uses the same `.input` look as every other dropdown in the admin
 * (no special border when a winner is chosen — the status line says "Entered").
 */

import { useId } from 'react'
import { playerLabel } from '../../lib/sideGamesView'

function Chevron() {
  return (
    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" width="16" height="16"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function StatusLine({ status, value, error, disabledNote }) {
  if (disabledNote) return <p className="mt-1.5 text-xs text-ink-muted">{disabledNote}</p>
  if (status === 'error') return <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error || 'Could not save. Try again.'}</p>
  if (status === 'saving') return <p aria-live="polite" className="mt-1.5 text-xs text-ink-muted">Saving…</p>
  if (status === 'saved') return <p aria-live="polite" className="mt-1.5 text-xs font-medium text-status-active-text">Saved</p>
  return value !== ''
    ? <p className="mt-1.5 text-xs font-medium text-status-active-text">Entered</p>
    : <p className="mt-1.5 text-xs text-ink-muted">Not entered</p>
}

export default function WinnerField({
  label, par, players, value, onChange, status = 'idle', error, disabled = false, disabledNote,
}) {
  const id = useId()

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>
        {par != null && <span className="text-xs text-ink-muted">Par {par}</span>}
      </div>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          aria-describedby={`${id}-status`}
          className="input h-11 w-full appearance-none bg-white pr-10 disabled:cursor-not-allowed disabled:bg-surface-container disabled:text-ink-muted"
        >
          <option value="">Select winner</option>
          <option value="NO_WINNER">No winner</option>
          {players.map(ep => <option key={ep.player_id} value={ep.player_id}>{playerLabel(ep)}</option>)}
        </select>
        <Chevron />
      </div>
      <div id={`${id}-status`}><StatusLine status={status} value={value} error={error} disabledNote={disabled ? disabledNote : null} /></div>
    </div>
  )
}

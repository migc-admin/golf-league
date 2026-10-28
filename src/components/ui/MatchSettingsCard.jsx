/**
 * MatchSettingsCard — "Match settings", the merged Team names + Tie rules card.
 *
 *   Match settings
 *   Usually set once per season.
 *   Team names (optional)              Ties after 18 holes
 *   [Team A] [Team B]                  [x] Every match must have a winner
 *                                      Tiebreaker order [ Net total → fewest putts → … ]
 *                                                              [Save match settings]
 *
 * Presentational and controlled: the page owns the values and passes the setters, and
 * `onSave` runs BOTH existing saves (team names and tie rules). When `locked` (event complete)
 * the inputs, the checkbox and the tiebreaker select are greyed and read-only and the Save
 * button is removed. The tiebreaker select is also greyed while "must have a winner" is off.
 *
 * presets: [{ key, label }] — labels are shown with arrows between steps.
 */

import { useId } from 'react'
import { ActionButton } from './Button'
import { tiebreakOrderLabel } from '../../lib/groupsView'

export default function MatchSettingsCard({
  id = 'match-settings', locked = false,
  teamAName, teamBName, onTeamAName, onTeamBName,
  requireWinner, onRequireWinner, tiePreset, onTiePreset, presets,
  onSave, saving = false, className = '',
}) {
  const idA = useId()
  const idB = useId()
  const idCheck = useId()
  const idPreset = useId()

  return (
    <section id={id} className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-5">
        <h2 className="text-lg font-bold text-ink">Match settings</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          {locked ? 'Locked for this event. Changes apply to future events.' : 'Usually set once per season.'}
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Team names <span className="font-normal text-ink-muted">(optional)</span></h3>
          <p className="mb-3 text-xs text-ink-muted">Shown on the leaderboard and results. Leave blank for no labels.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={idA} className="label">Team A</label>
              <input id={idA} className="input h-11" value={teamAName} disabled={locked}
                onChange={e => onTeamAName(e.target.value)} placeholder="e.g. USA" />
            </div>
            <div>
              <label htmlFor={idB} className="label">Team B</label>
              <input id={idB} className="input h-11" value={teamBName} disabled={locked}
                onChange={e => onTeamBName(e.target.value)} placeholder="e.g. Europe" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Ties after 18 holes</h3>
          <div className="flex items-start gap-3">
            <input id={idCheck} type="checkbox" className="mt-1 h-5 w-5 accent-fairway-700" checked={requireWinner} disabled={locked}
              onChange={e => onRequireWinner(e.target.checked)} />
            <label htmlFor={idCheck} className="text-sm">
              <span className="font-semibold text-ink">Every match must have a winner</span>
              <span className="block text-xs text-ink-muted">Off: a tie is halved (½ point each).</span>
            </label>
          </div>

          <label htmlFor={idPreset} className="label mt-4">Tiebreaker order</label>
          <select id={idPreset} className="input h-11 bg-white" value={tiePreset} disabled={locked || !requireWinner}
            onChange={e => onTiePreset(e.target.value)}>
            {presets.map(p => <option key={p.key} value={p.key}>{tiebreakOrderLabel(p.label)}</option>)}
          </select>
          <p className="mt-1.5 text-xs text-ink-muted">
            The first step that separates the players decides it. A putt-off waits for you to pick the winner.
          </p>
        </div>
      </div>

      {!locked && (
        <footer className="mt-5 flex justify-end border-t border-surface-border pt-4">
          <ActionButton loading={saving} onClick={onSave}>Save match settings</ActionButton>
        </footer>
      )}
    </section>
  )
}

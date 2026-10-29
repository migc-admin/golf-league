/**
 * LongDriveCard — "Long Drive": one winner per flight (or one overall winner when the game is for
 * the entire field).
 *
 *   Long Drive   One winner per flight                          0 of 2
 *   Flight A
 *   [ Select winner  v ]
 *   Not entered
 *
 *   Flight B
 *   [ Select winner  v ]
 *   Not entered
 *   2 players have no flight assigned.  Assign flights
 *
 * `fields` come from `buildSideGamesPlan` (rows built from the event's own flights, each listing
 * only that flight's players). `statusOf(field)` gives { status, error } for the line under each
 * dropdown; `onChange(field, value)` is the page's save. The note links to where flights are set.
 */

import SectionCard from '../ui/SectionCard'
import WinnerField from './WinnerField'

export default function LongDriveCard({ fields, noFlight = 0, onFixFlights, statusOf, onChange, emptyNote, className = '' }) {
  const entered = fields.filter(f => f.value !== '').length
  const byFlight = fields.some(f => f.flight !== 'overall')
  return (
    <SectionCard
      title="Long Drive"
      subtitle={byFlight ? 'One winner per flight' : 'One winner for the entire field'}
      aside={`${entered} of ${fields.length}`}
      className={className}
    >
      <div className="space-y-5">
        {fields.map(f => (
          <WinnerField
            key={f.key}
            label={f.label}
            players={f.players}
            value={f.value}
            disabled={f.disabled}
            disabledNote={emptyNote ?? (byFlight ? 'No players assigned to this flight' : 'No players in this event')}
            onChange={v => onChange(f, v)}
            {...statusOf(f)}
          />
        ))}
      </div>
      {noFlight > 0 && (
        <p className="mt-5 border-t border-surface-border pt-3 text-sm text-ink-muted">
          {noFlight} player{noFlight !== 1 ? 's have' : ' has'} no flight assigned.{' '}
          {onFixFlights && (
            <button type="button" onClick={onFixFlights} className="font-semibold text-fairway-700 underline">Assign flights</button>
          )}
        </p>
      )}
    </SectionCard>
  )
}

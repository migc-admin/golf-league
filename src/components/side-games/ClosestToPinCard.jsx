/**
 * ClosestToPinCard — "Closest to Pin": one winner per par-3 hole you designated in Payout Config,
 * in hole order. Every dropdown lists everyone in the event, so one player can win several holes.
 * When CTP is set up per flight, each hole holds a field per flight instead.
 *
 *   Closest to Pin   One winner per par-3 hole                  0 of 4
 *   Hole 3                  Par 3     Hole 8                  Par 3
 *   [ Select winner  v ]              [ Select winner  v ]
 *   Not entered                       Not entered
 *
 * Holes flow in a grid (as many columns as fit ~200px), so two columns on desktop and one on a
 * phone. Presentational: `holes` come from `buildSideGamesPlan`, `statusOf` / `onChange` from the page.
 */

import SectionCard from '../ui/SectionCard'
import WinnerField from './WinnerField'

export default function ClosestToPinCard({ holes, statusOf, onChange, emptyNote, className = '' }) {
  const fields = holes.flatMap(h => h.fields)
  const entered = fields.filter(f => f.value !== '').length
  const perFlight = holes.some(h => h.fields.length > 1 || h.fields[0]?.flight !== 'overall')
  return (
    <SectionCard
      title="Closest to Pin"
      subtitle={perFlight ? 'One winner per par-3 hole, per flight' : 'One winner per par-3 hole'}
      aside={`${entered} of ${fields.length}`}
      className={className}
    >
      <div className={`grid gap-x-5 gap-y-6 ${
        perFlight ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]' : 'grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]'
      }`}>
        {holes.map(h => perFlight ? (
          <div key={h.hole}>
            <div className="mb-3 flex items-baseline justify-between border-b border-surface-border pb-2">
              <h3 className="text-sm font-semibold text-ink">Hole {h.hole}</h3>
              <span className="text-xs text-ink-muted">Par {h.par}</span>
            </div>
            {h.fields.map(f => (
              <WinnerField
                key={f.key}
                label={f.label}
                players={f.players}
                value={f.value}
                disabled={f.disabled}
                disabledNote={emptyNote ?? 'No players assigned to this flight'}
                onChange={v => onChange(f, v)}
                {...statusOf(f)}
              />
            ))}
          </div>
        ) : (
          <WinnerField
            key={h.hole}
            label={`Hole ${h.hole}`}
            par={h.par}
            players={h.fields[0].players}
            value={h.fields[0].value}
            disabled={h.fields[0].disabled}
            disabledNote={emptyNote ?? 'No players in this event'}
            onChange={v => onChange(h.fields[0], v)}
            {...statusOf(h.fields[0])}
          />
        ))}
      </div>
    </SectionCard>
  )
}

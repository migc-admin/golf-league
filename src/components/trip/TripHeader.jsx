/**
 * TripHeader — top of the trip admin page.
 *
 *   [cover]  MULLIGAN'S ISLAND GOLF CLUB · TRIP                    [Trip page ↗] [Edit trip]
 *            Sand Valley 2026  (Upcoming)
 *            Sep 10, 2026 – Sep 14, 2026 · Sand Valley, UT
 *
 * Presentational. The page supplies the trip, the organization name and the handlers.
 */
import Badge from '../ui/Badge'
import { ActionButton } from '../ui/Button'
import { tripStatus } from '../../lib/tripView'

const STATUS = {
  upcoming: { variant: 'upcoming', label: 'Upcoming' },
  active:   { variant: 'active',   label: 'In progress' },
  complete: { variant: 'complete', label: 'Complete' },
}

export default function TripHeader({ trip, clubName, meta, tripPageHref, onEdit }) {
  const status = STATUS[tripStatus(trip)]
  return (
    <header className="flex flex-col gap-4 rounded-sm border border-surface-border bg-white p-4 sm:flex-row sm:items-start sm:p-5">
      <div className="shrink-0">
        {trip.logo_url ? (
          <img src={trip.logo_url} alt="" className="h-[88px] w-[88px] rounded-sm border border-surface-border object-cover" />
        ) : (
          <div className="flex h-[88px] w-[88px] items-center justify-center rounded-sm bg-surface-high text-2xl font-bold text-ink-muted" aria-hidden="true">
            {trip.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-fairway-700">{[clubName, 'Trip'].filter(Boolean).join(' · ')}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold leading-tight text-ink" style={{ letterSpacing: '-0.02em' }}>{trip.name}</h1>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="mt-1 text-sm text-ink-muted">{meta}</p>
        {trip.description && <p className="mt-2 text-sm text-ink-muted">{trip.description}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
        {tripPageHref && (
          <ActionButton href={tripPageHref} target="_blank" variant="secondary">
            Trip page <span aria-hidden="true">↗</span>
          </ActionButton>
        )}
        <ActionButton variant="secondary" onClick={onEdit}>Edit trip</ActionButton>
      </div>
    </header>
  )
}

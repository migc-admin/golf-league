/**
 * The side column of the trip admin page: where we're staying, getting there, trip standings
 * (the old Standings Settings, same save behavior) and the delete box.
 */
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import SectionCard from '../ui/SectionCard'
import Button, { ActionButton } from '../ui/Button'
import { time12 } from '../../lib/tripItinerary'
import { DEFAULT_STANDINGS_CONFIG } from '../../pages/admin/LeagueDetail'

function dayBox(date) {
  if (!date) return { day: '', date: '' }
  const d = new Date(`${date}T00:00:00`)
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

function TimeBox({ label, date, time }) {
  const b = dayBox(date)
  return (
    <div className="rounded-sm border border-surface-border bg-surface-container px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">{label}</p>
      {date ? (
        <>
          <p className="mt-1 text-sm font-bold text-ink">{b.day}, {b.date}</p>
          <p className="text-xs text-ink-muted">{time ? time12(time) : 'Time TBD'}</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">Not set</p>
      )}
    </div>
  )
}

export function StayingCard({ trip, onEdit }) {
  const l = trip.lodging && typeof trip.lodging === 'object' ? trip.lodging : {}
  const has = !!(l.name || l.address || l.booking_company || l.checkin_date || l.checkout_date)
  const sub = [l.address, l.booking_company ? `Booked via ${l.booking_company}` : null].filter(Boolean).join(' · ')
  return (
    <SectionCard title="Where we're staying" headerAction={<ActionButton variant="ghost" onClick={onEdit}>{has ? 'Edit' : '+ Add'}</ActionButton>}>
      {!has ? (
        <p className="text-sm text-ink-muted">Add the lodging so everyone knows where to go.</p>
      ) : (
        <>
          {l.name && <p className="text-sm font-bold text-ink">{l.name}</p>}
          {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <TimeBox label="Check-in" date={l.checkin_date} time={l.checkin_time} />
            <TimeBox label="Check-out" date={l.checkout_date} time={l.checkout_time} />
          </div>
        </>
      )}
    </SectionCard>
  )
}

export function GettingThereCard({ trip, onEdit }) {
  const airports = Array.isArray(trip.nearest_airports) ? trip.nearest_airports : []
  return (
    <SectionCard title="Getting there" headerAction={<ActionButton variant="ghost" onClick={onEdit}>{airports.length || trip.travel_info ? 'Edit' : '+ Add'}</ActionButton>}>
      {airports.length === 0 && !trip.travel_info && <p className="text-sm text-ink-muted">Add the nearest airports and any travel notes.</p>}
      {airports.length > 0 && (
        <ul className="divide-y divide-surface-border">
          {airports.map((a, i) => (
            <li key={i} className="flex items-baseline gap-3 py-2 first:pt-0 last:pb-0">
              {a.code && <span className="w-10 shrink-0 text-sm font-bold text-fairway-700">{a.code}</span>}
              <span className="min-w-0 flex-1 text-sm text-ink">{a.name}</span>
              {a.distance && <span className="shrink-0 text-sm text-ink-muted">{a.distance}</span>}
            </li>
          ))}
        </ul>
      )}
      {trip.travel_info && (
        <div className={airports.length > 0 ? 'mt-3 border-t border-surface-border pt-3' : ''}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">Travel and transportation</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{trip.travel_info}</p>
        </div>
      )}
    </SectionCard>
  )
}

// ─── Trip standings ───────────────────────────────────────────────
const TOGGLES = [
  { key: 'include_scoring',    label: 'Scoring (net, gross, stableford)', help: 'Finishing places count' },
  { key: 'include_skins',      label: 'Skins',                            help: 'Skin winnings count' },
  { key: 'include_ctp',        label: 'Closest to pin',                   help: 'CTP winnings count' },
  { key: 'include_long_drive', label: 'Long drive',                       help: 'Long drive winnings count' },
  { key: 'include_low_putts',  label: 'Low putts',                        help: 'Low putts winnings count' },
]

function Switch({ checked, onChange, labelledBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 focus-visible:ring-offset-2 ${checked ? 'bg-fairway-700' : 'bg-surface-highest'}`}
    >
      <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform" style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
  )
}

export function TripStandingsCard({ league, onSaved }) {
  const saved = { ...DEFAULT_STANDINGS_CONFIG, ...(league?.standings_config ?? {}) }
  const [local, setLocal] = useState(saved)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setLocal({ ...DEFAULT_STANDINGS_CONFIG, ...(league?.standings_config ?? {}) }) }, [league])

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('leagues').update({ standings_config: local }).eq('id', league.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Standings settings saved'); onSaved() }
  }
  const dirty = JSON.stringify(local) !== JSON.stringify(saved)

  return (
    <SectionCard
      title="Trip standings"
      subtitle="What counts toward the standings page."
      headerAction={dirty ? <ActionButton variant="secondary" loading={saving} onClick={handleSave}>Save</ActionButton> : null}
    >
      <ul className="divide-y divide-surface-border">
        {TOGGLES.map(t => (
          <li key={t.key} className="flex min-h-[44px] items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <span className="min-w-0">
              <span id={`standings-${t.key}`} className="block text-sm font-semibold text-ink">{t.label}</span>
              <span className="block text-xs text-ink-muted">{t.help}</span>
            </span>
            <Switch checked={!!local[t.key]} labelledBy={`standings-${t.key}`} onChange={v => setLocal(prev => ({ ...prev, [t.key]: v }))} />
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

export function DeleteTripBox({ onDelete }) {
  return (
    <section className="rounded-sm border border-red-200 bg-red-50 p-5">
      <h2 className="text-base font-bold text-red-700">Delete trip</h2>
      <p className="mt-1 text-sm text-red-700">Removes the trip, rounds, rooms and travelers. This can't be undone.</p>
      <Button
        variant="secondary"
        className="mt-3 !border-red-300 !text-red-700 hover:!bg-red-100"
        onClick={onDelete}
      >
        Delete trip
      </Button>
    </section>
  )
}

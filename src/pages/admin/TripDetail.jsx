import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Textarea } from '../../components/ui/Input'
import ImageUpload from '../../components/ui/ImageUpload'
import StatTiles from '../../components/ui/StatTiles'
import TripTravelersRooms from '../../components/TripTravelers'
import TripHeader from '../../components/trip/TripHeader'
import TripItineraryCard from '../../components/trip/TripItineraryCard'
import TripRoundsCard from '../../components/trip/TripRoundsCard'
import { StayingCard, GettingThereCard, TripStandingsCard, DeleteTripBox } from '../../components/trip/TripSideCards'
import { buildItinerary } from '../../lib/tripItinerary'
import { tripTiles } from '../../lib/tripView'

export default function TripDetail() {
  const { tripSlug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [trip,        setTrip]        = useState(null)
  const [orgSlug,     setOrgSlug]     = useState(null)
  const [orgName,     setOrgName]     = useState('')
  const [orgTier,     setOrgTier]     = useState('free')
  const [league,      setLeague]      = useState(null)
  const [rounds,      setRounds]      = useState([])
  const [travelers,   setTravelers]   = useState([])
  const [roster,      setRoster]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [editModal,   setEditModal]   = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [infoModal,   setInfoModal]   = useState(false)

  async function load() {
    const { data } = await supabase
      .from('trips')
      .select('*, league:leagues(slug)')
      .eq('slug', tripSlug)
      .single()
    if (!data) { navigate('/admin/trips'); return }
    setTrip(data)
    if (data.org_id) {
      const { data: org } = await supabase
        .from('organizations').select('slug, name').eq('id', data.org_id).single()
      setOrgSlug(org?.slug ?? null)
      setOrgName(org?.name ?? '')
    }
    setLoading(false)
  }

  // The trip's hidden league: its rounds (events) and standings settings.
  async function loadLeague(t = trip) {
    if (!t?.league_id) return
    const { data: lg } = await supabase
      .from('leagues')
      .select('id, name, slug, season_year, logo_url, team_play_label, standings_config')
      .eq('id', t.league_id)
      .single()
    if (lg) setLeague(lg)
    const { data: ev } = await supabase
      .from('events')
      .select('id, event_number, name, slug, event_date, start_time, status, display_order, course:courses(name)')
      .eq('league_id', t.league_id)
      .order('display_order', { ascending: true, nullsFirst: false })
    setRounds(ev ?? [])
  }

  async function loadTravelers(t = trip) {
    if (!t) return
    const [{ data: tr }, { data: p }] = await Promise.all([
      supabase.from('trip_travelers')
        .select('*, player:players(id, first_name, last_name, email)')
        .eq('trip_id', t.id),
      supabase.from('players')
        .select('id, first_name, last_name, email')
        .eq('org_id', t.org_id)
        .order('last_name'),
    ])
    setTravelers(tr || [])
    setRoster(p || [])
  }

  useEffect(() => {
    if (tripSlug) load()
  }, [tripSlug])

  useEffect(() => {
    if (trip) { loadLeague(trip); loadTravelers(trip) }
  }, [trip?.id])

  // Same owner / platform-admin "Club" override the league page uses for Team play.
  useEffect(() => {
    async function tier() {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('is_owner, is_platform_admin').eq('id', user.id).single()
      const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
      const { data: org } = prof?.org_id
        ? await supabase.from('organizations').select('tier').eq('id', prof.org_id).single()
        : { data: null }
      setOrgTier(profile?.is_owner || profile?.is_platform_admin ? 'club' : (org?.tier ?? 'free'))
    }
    tier()
  }, [user])

  async function handleDeleteTrip() {
    if (!trip?.league_id) return
    const { error } = await supabase.from('leagues').delete().eq('id', trip.league_id)
    if (error) toast.error(error.message)
    else { toast.success('Trip deleted'); navigate('/admin/trips') }
  }

  const days  = useMemo(() => (trip ? buildItinerary({ trip, rounds }) : []), [trip, rounds])
  const tiles = useMemo(() => (trip ? tripTiles({ trip, travelers, rounds }) : []), [trip, travelers, rounds])

  if (loading || !trip) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-sm bg-surface-high" />
        <div className="h-40 rounded-sm bg-surface-high" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/admin/trips" className="inline-flex min-h-[44px] items-center text-sm text-ink-muted hover:text-ink">← All trips</Link>
      </div>

      <TripHeader
        trip={trip}
        clubName={orgName}
        meta={`${formatDateRange(trip.start_date, trip.end_date)}${trip.location ? ` · ${trip.location}` : ''}`}
        tripPageHref={orgSlug ? `/${orgSlug}/trip/${trip.slug}` : null}
        onEdit={() => setEditModal(true)}
      />

      <StatTiles tiles={tiles} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-5">
          <TripItineraryCard days={days} onAddItem={() => setInfoModal(true)} />
          {league && (
            <TripRoundsCard league={league} rounds={rounds} setRounds={setRounds} orgSlug={orgSlug} orgTier={orgTier} />
          )}
          <TripTravelersRooms trip={trip} travelers={travelers} roster={roster} onReload={() => loadTravelers(trip)} />
        </div>

        <aside className="min-w-0 space-y-5">
          <StayingCard trip={trip} onEdit={() => setInfoModal(true)} />
          <GettingThereCard trip={trip} onEdit={() => setInfoModal(true)} />
          {league && <TripStandingsCard league={league} onSaved={() => loadLeague(trip)} />}
          <DeleteTripBox onDelete={() => setDeleteModal(true)} />
        </aside>
      </div>

      <EditTripModal
        open={editModal}
        onClose={() => setEditModal(false)}
        trip={trip}
        onSaved={() => { setEditModal(false); load() }}
      />

      <DeleteTripModal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        trip={trip}
        onConfirm={handleDeleteTrip}
      />

      <TripInfoModal
        open={infoModal}
        onClose={() => setInfoModal(false)}
        trip={trip}
        onSaved={() => { setInfoModal(false); load() }}
      />
    </div>
  )
}

const EMPTY_ITINERARY_ENTRY = { date: '', text: '' }
const EMPTY_AIRPORT         = { code: '', name: '', distance: '' }
const EMPTY_SCHEDULED_ENTRY = { date: '', time: '', name: '', venue: '', location: '' }
const EMPTY_LODGING = {
  name: '', address: '', booking_company: '',
  checkin_date: '', checkin_time: '', checkout_date: '', checkout_time: '',
}

function TripInfoModal({ open, onClose, trip, onSaved }) {
  const [itinerary,     setItinerary]     = useState([])
  const [airports,      setAirports]      = useState([])
  const [lodging,       setLodging]       = useState(EMPTY_LODGING)
  const [meals,         setMeals]         = useState([])
  const [socialEvents,  setSocialEvents]  = useState([])
  const [travelInfo,    setTravelInfo]    = useState('')
  const [saving,        setSaving]        = useState(false)

  useEffect(() => {
    if (trip && open) {
      setItinerary(seedItinerary(trip.itinerary, trip.start_date))
      setAirports(Array.isArray(trip.nearest_airports) && trip.nearest_airports.length > 0 ? trip.nearest_airports : [{ ...EMPTY_AIRPORT }])
      setLodging({ ...EMPTY_LODGING, ...(trip.lodging && typeof trip.lodging === 'object' ? trip.lodging : {}) })
      setMeals(seedScheduled(trip.meals, trip.start_date))
      setSocialEvents(seedScheduled(trip.social_events, trip.start_date))
      setTravelInfo(trip.travel_info ?? '')
    }
  }, [trip, open])

  function updateItinerary(i, field, value) {
    setItinerary(prev => prev.map((entry, idx) => idx === i ? { ...entry, [field]: value } : entry))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const cleanItinerary = itinerary
      .map(entry => ({ date: (entry.date ?? '').trim(), text: (entry.text ?? '').trim() }))
      .filter(entry => entry.date || entry.text)
      .sort((a, b) => a.date.localeCompare(b.date))
    const cleanAirports = airports
      .map(a => ({ code: a.code.trim(), name: a.name.trim(), distance: a.distance.trim() }))
      .filter(a => a.code || a.name || a.distance)
    const cleanScheduled = list => list
      .map(x => ({
        date:     (x.date ?? '').trim(),
        time:     (x.time ?? '').trim(),
        name:     (x.name ?? '').trim(),
        venue:    (x.venue ?? '').trim(),
        location: (x.location ?? '').trim(),
      }))
      .filter(x => x.date || x.time || x.name || x.venue || x.location)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    const cleanMeals        = cleanScheduled(meals)
    const cleanSocialEvents = cleanScheduled(socialEvents)
    const cleanLodging = Object.fromEntries(Object.entries(lodging).map(([k, v]) => [k, (v ?? '').trim()]))

    const { error } = await supabase.from('trips').update({
      itinerary: cleanItinerary,
      nearest_airports: cleanAirports,
      lodging: cleanLodging,
      meals: cleanMeals,
      social_events: cleanSocialEvents,
      travel_info: travelInfo.trim() || null,
    }).eq('id', trip.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Trip info updated'); onSaved() }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Trip Info">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-3">
          <label className="label">Day-by-Day Schedule</label>
          {itinerary.map((entry, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <Input
                  type="date"
                  value={entry.date}
                  onChange={e => updateItinerary(i, 'date', e.target.value)}
                />
                <Textarea
                  placeholder="e.g. 3pm arrival · settle into rooms · rest of evening free"
                  value={entry.text}
                  onChange={e => updateItinerary(i, 'text', e.target.value)}
                  rows={2}
                />
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={() => setItinerary(prev => prev.filter((_, idx) => idx !== i))} aria-label="Remove entry">✕</Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="secondary" onClick={() => setItinerary(prev => [...prev, { ...EMPTY_ITINERARY_ENTRY }])}>+ Add Day</Button>
        </div>

        <div className="space-y-3">
          <label className="label">Nearest Airport(s)</label>
          {airports.map((a, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <Input placeholder="Code (e.g. MCO)" value={a.code} onChange={e => setAirports(prev => prev.map((x, idx) => idx === i ? { ...x, code: e.target.value } : x))} />
                <Input placeholder="Airport Name" value={a.name} onChange={e => setAirports(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
                <Input placeholder="Distance / drive time" value={a.distance} onChange={e => setAirports(prev => prev.map((x, idx) => idx === i ? { ...x, distance: e.target.value } : x))} />
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={() => setAirports(prev => prev.filter((_, idx) => idx !== i))} aria-label="Remove airport">✕</Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="secondary" onClick={() => setAirports(prev => [...prev, { ...EMPTY_AIRPORT }])}>+ Add Airport</Button>
        </div>

        <div className="space-y-3">
          <label className="label">Base Camp (Lodging)</label>
          <Input placeholder="Resort or house rental name" value={lodging.name} onChange={e => setLodging(l => ({ ...l, name: e.target.value }))} />
          <Input placeholder="Address" value={lodging.address} onChange={e => setLodging(l => ({ ...l, address: e.target.value }))} />
          <Input placeholder="Booking company (Airbnb, Expedia, Marriott, etc.)" value={lodging.booking_company} onChange={e => setLodging(l => ({ ...l, booking_company: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Check-in Date" type="date" value={lodging.checkin_date} onChange={e => setLodging(l => ({ ...l, checkin_date: e.target.value }))} />
            <Input label="Check-in Time" type="time" value={lodging.checkin_time} onChange={e => setLodging(l => ({ ...l, checkin_time: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Check-out Date" type="date" value={lodging.checkout_date} onChange={e => setLodging(l => ({ ...l, checkout_date: e.target.value }))} />
            <Input label="Check-out Time" type="time" value={lodging.checkout_time} onChange={e => setLodging(l => ({ ...l, checkout_time: e.target.value }))} />
          </div>
        </div>

        <ScheduledEntryEditor label="Scheduled Meals" entries={meals} setEntries={setMeals} addLabel="+ Add Meal" nameLabel="Event (Breakfast, Lunch, Dinner…)" />

        <div>
          <label className="label">Scheduled Golf</label>
          <p className="text-sm text-ink-muted">Rounds are added from the Rounds section below — no need to duplicate them here.</p>
        </div>

        <ScheduledEntryEditor label="Scheduled Social Events" entries={socialEvents} setEntries={setSocialEvents} addLabel="+ Add Event" />

        <Textarea
          label="Travel & Transportation (optional)"
          placeholder="Flights, group transport, rental cars"
          value={travelInfo}
          onChange={e => setTravelInfo(e.target.value)}
          rows={3}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  )
}

function ScheduledEntryEditor({ label, entries, setEntries, addLabel, nameLabel = 'Name' }) {
  function update(i, field, value) {
    setEntries(prev => prev.map((entry, idx) => idx === i ? { ...entry, [field]: value } : entry))
  }

  return (
    <div className="space-y-3">
      <label className="label">{label}</label>
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <Input type="date" value={entry.date} onChange={e => update(i, 'date', e.target.value)} />
            <Input type="time" value={entry.time} onChange={e => update(i, 'time', e.target.value)} />
            <Input className="col-span-2" placeholder={nameLabel} value={entry.name} onChange={e => update(i, 'name', e.target.value)} />
            <Input className="col-span-2" placeholder="Venue (optional)" value={entry.venue ?? ''} onChange={e => update(i, 'venue', e.target.value)} />
            <Input className="col-span-2" placeholder="Location/Address (optional)" value={entry.location} onChange={e => update(i, 'location', e.target.value)} />
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => setEntries(prev => prev.filter((_, idx) => idx !== i))} aria-label="Remove entry">✕</Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={() => setEntries(prev => [...prev, { ...EMPTY_SCHEDULED_ENTRY }])}>{addLabel}</Button>
    </div>
  )
}

function EditTripModal({ open, onClose, trip, onSaved }) {
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [startDate,   setStartDate]   = useState('')
  const [endDate,      setEndDate]     = useState('')
  const [location,    setLocation]    = useState('')
  const [logoUrl,     setLogoUrl]     = useState('')
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    if (trip && open) {
      setName(trip.name ?? '')
      setDescription(trip.description ?? '')
      setStartDate(trip.start_date ?? '')
      setEndDate(trip.end_date ?? '')
      setLocation(trip.location ?? '')
      setLogoUrl(trip.logo_url ?? '')
    }
  }, [trip, open])

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('trips').update({
      name: name.trim(),
      description: description.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      location: location.trim() || null,
      logo_url: logoUrl || null,
    }).eq('id', trip.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Trip updated'); onSaved() }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Trip">
      <form onSubmit={handleSave} className="space-y-4">
        <ImageUpload
          shape="rect"
          path={`orgs/${trip.org_id}/trips/${trip.id}`}
          currentUrl={logoUrl || null}
          onUploaded={url => setLogoUrl(url)}
          onRemoved={() => setLogoUrl('')}
          label="Trip Logo (optional)"
        />
        <Input label="Trip Name" value={name} onChange={e => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <Input label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <Input label="Location (optional)" value={location} onChange={e => setLocation(e.target.value)} />
        <Input label="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  )
}

function DeleteTripModal({ open, onClose, trip, onConfirm }) {
  const [confirmText, setConfirmText] = useState('')
  const [deleting,    setDeleting]    = useState(false)

  useEffect(() => {
    if (!open) setConfirmText('')
  }, [open])

  async function handleDelete() {
    setDeleting(true)
    await onConfirm()
    setDeleting(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete Trip">
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          This will permanently delete <span className="font-semibold text-ink">{trip?.name}</span> and all of its
          rounds, scores, skins, earnings, and team play data. This cannot be undone.
        </p>
        <Input
          label={<>Type <span className="font-mono font-semibold">DELETE</span> to confirm</>}
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder="DELETE"
          autoFocus
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            variant="danger"
            disabled={confirmText !== 'DELETE'}
            loading={deleting}
            onClick={handleDelete}
          >
            Delete Trip
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Meals/social events originally stored a freeform `day` string ("Fri, Jun 12") and
// a display time ("7:00 PM"). They now use a real ISO `date` and 24h `time` so the
// editor can use native date/time pickers. Normalize legacy rows on load.
// Itinerary entries originally used a freeform `label` ("Fri, Jun 12"); they now
// use a real ISO `date`. Fall back to keeping the label as text if it won't parse.
function seedItinerary(list, tripStartDate) {
  const entries = Array.isArray(list) ? list : []
  if (entries.length === 0) return [{ ...EMPTY_ITINERARY_ENTRY }]
  return entries.map(entry => ({
    date: entry.date || parseLegacyDay(entry.label, tripStartDate),
    text: entry.text ?? '',
  }))
}

function seedScheduled(list, tripStartDate) {
  const entries = Array.isArray(list) ? list : []
  if (entries.length === 0) return [{ ...EMPTY_SCHEDULED_ENTRY }]
  return entries.map(entry => ({
    date: entry.date || parseLegacyDay(entry.day, tripStartDate),
    time: toInputTime(entry.time),
    name: entry.name ?? '',
    venue: entry.venue ?? '',
    location: entry.location ?? '',
  }))
}

function parseLegacyDay(day, tripStartDate) {
  if (!day) return ''
  const year = tripStartDate ? tripStartDate.slice(0, 4) : String(new Date().getFullYear())
  // Strip a leading weekday ("Fri, ") which Date can't parse alongside a year suffix.
  const cleaned = String(day).replace(/^[A-Za-z]+,\s*/, '').trim()
  const parsed = new Date(/\d{4}/.test(cleaned) ? cleaned : `${cleaned} ${year}`)
  if (Number.isNaN(parsed.getTime())) return ''
  const mm = String(parsed.getMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getDate()).padStart(2, '0')
  return `${parsed.getFullYear()}-${mm}-${dd}`
}

function toInputTime(time) {
  if (!time) return ''
  const t = String(time).trim()
  if (/^\d{2}:\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2}):(\d{2})\s*([AaPp])[Mm]?$/)
  if (!m) return ''
  let hour = Number(m[1]) % 12
  if (m[3].toLowerCase() === 'p') hour += 12
  return `${String(hour).padStart(2, '0')}:${m[2]}`
}


function formatDateRange(start, end) {
  if (!start && !end) return 'Dates TBD'
  if (start && end && start !== end) return `${fmtDate(start)} – ${fmtDate(end)}`
  return fmtDate(start || end)
}

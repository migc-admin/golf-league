import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSubdomainOrg } from '../../lib/SubdomainContext'
import LeagueLayout from '../../components/LeagueLayout'
import { travelerName, roomLabel } from '../../components/TripTravelers'
import {
  formatScheduledDay, formatDisplayTime,
} from '../../lib/tripSchedule'
import {
  useSeasonStandings,
  EventCard,
  StatCard,
  MoneyList,
  SideGameTable,
} from '../../components/SeasonStandings'

const GREEN = '#1B4332'

export default function TripHome({ orgSlug, tripSlug, initialTab = 'overview' }) {
  const [trip,           setTrip]           = useState(null)
  const [org,            setOrg]            = useState(null)
  const [leagues,        setLeagues]        = useState([])
  const [events,         setEvents]         = useState([])
  const [travelers,      setTravelers]      = useState([])
  const [activeTab,      setActiveTab]      = useState(initialTab)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const subdomainOrg = useSubdomainOrg()
  // On a subdomain the event route is /:leagueSlug/:eventSlug; otherwise it's
  // /:orgSlug/:leagueSlug/:eventSlug/event — EventCard needs orgSlug for the latter.
  const eventLinkOrgSlug = subdomainOrg ? null : orgSlug
  const { standings, sideGameStats, standingsLoading, loadStandings } = useSeasonStandings()

  useEffect(() => {
    if (!orgSlug || !tripSlug) return
    async function load() {
      setLoading(true)

      const { data: tripData, error: tripErr } = await supabase
        .from('trips')
        .select('id, name, slug, description, start_date, end_date, location, logo_url, org_id, itinerary, nearest_airports, lodging, meals, social_events, travel_info, room_labels, league:leagues(id, slug, standings_config)')
        .eq('slug', tripSlug)
        .single()

      if (tripErr || !tripData?.league) { setError('Trip not found.'); setLoading(false); return }
      setTrip(tripData)

      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name, slug, logo_url, tier')
        .eq('id', tripData.org_id)
        .single()
      setOrg(orgData)

      const { data: allLeagues } = await supabase
        .from('leagues')
        .select('id, name, slug')
        .eq('org_id', tripData.org_id)
        .eq('is_trip_league', false)
        .order('season_year', { ascending: false })
      setLeagues(allLeagues || [])

      const { data: eventsData } = await supabase
        .from('events')
        .select('id, name, event_number, slug, status, event_date, course:courses(name)')
        .eq('league_id', tripData.league.id)
        .order('event_date', { ascending: true })
      setEvents(eventsData || [])

      const { data: travelerData } = await supabase
        .from('trip_travelers')
        .select('id, guest_name, room_number, room_order, player:players(first_name, last_name)')
        .eq('trip_id', tripData.id)
      setTravelers(travelerData || [])
      setLoading(false)
    }
    load()
  }, [orgSlug, tripSlug])

  // Load standings data when tab is first opened
  useEffect(() => {
    if (activeTab !== 'standings' || !trip?.league) return
    if (standings.length > 0) return  // already loaded
    loadStandings(trip.league.id, trip.league.standings_config)
  }, [activeTab, trip])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{error || 'Trip not found.'}</p>
      </div>
    )
  }

  const past           = events.filter(e => e.status === 'complete')
  const moneyLeader    = standings[0]
  const skinsLeader    = [...sideGameStats].sort((a, b) => b.skinsWon - a.skinsWon)[0]
  const ctpLeader      = [...sideGameStats].filter(s => s.ctpWins > 0).sort((a, b) => b.ctpWins - a.ctpWins)[0]
  const ldLeader       = [...sideGameStats].filter(s => s.ldWins > 0).sort((a, b) => b.ldWins - a.ldWins)[0]
  const hasSideStats   = sideGameStats.length > 0
  const hasSkins       = sideGameStats.some(s => s.skinsWon > 0)
  const hasCTP         = sideGameStats.some(s => s.ctpWins > 0)
  const hasLD          = sideGameStats.some(s => s.ldWins > 0)

  const tabs = ['overview', 'schedule', 'travelers', 'standings']

  return (
    <LeagueLayout org={org} leagues={leagues}>
      {/* Trip header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold" style={{ color: GREEN }}>{trip.name}</h1>
        <p className="text-gray-500 mt-1">
          {formatDateRange(trip.start_date, trip.end_date)}{trip.location ? ` · ${trip.location}` : ''}
        </p>
        {trip.description && <p className="text-gray-500 mt-2 max-w-2xl">{trip.description}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: '#ebe9e4' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 pb-3 text-sm font-semibold capitalize transition-colors"
            style={{
              color:       activeTab === tab ? GREEN : '#86868b',
              borderBottom: activeTab === tab ? `2px solid ${GREEN}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && <OverviewTab trip={trip} />}

      {/* Schedule tab */}
      {activeTab === 'schedule' && (
        <ScheduleTab trip={trip} events={events} leagueSlug={trip.league.slug} eventLinkOrgSlug={eventLinkOrgSlug} />
      )}

      {/* Travelers tab */}
      {activeTab === 'travelers' && <TravelerRooms travelers={travelers} roomLabels={trip.room_labels} />}

      {/* Standings tab */}
      {activeTab === 'standings' && (
        <div className="space-y-8">

          {/* Past rounds — shown first */}
          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-700 mb-4">Past Rounds</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {past.map(ev => <EventCard key={ev.id} event={ev} leagueSlug={trip.league.slug} orgSlug={eventLinkOrgSlug} muted />)}
              </div>
            </section>
          )}

          {/* Trip standings */}
          {standingsLoading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-7 w-7" style={{ color: GREEN }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : (
            <>
              {/* Stat hero cards */}
              {(moneyLeader || skinsLeader || ctpLeader || ldLeader) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {moneyLeader && (
                    <StatCard
                      label="Money Leader"
                      value={`${moneyLeader.player?.last_name}, ${moneyLeader.player?.first_name}`}
                      sub={`$${moneyLeader.totalEarnings.toFixed(2)}`}
                    />
                  )}
                  {hasSkins && skinsLeader && (
                    <StatCard
                      label="Skins Leader"
                      value={`${skinsLeader.player?.last_name}, ${skinsLeader.player?.first_name}`}
                      sub={`${skinsLeader.skinsWon} skin${skinsLeader.skinsWon !== 1 ? 's' : ''} won`}
                    />
                  )}
                  {hasCTP && ctpLeader && (
                    <StatCard
                      label="CTP Leader"
                      value={`${ctpLeader.player?.last_name}, ${ctpLeader.player?.first_name}`}
                      sub={`${ctpLeader.ctpWins} win${ctpLeader.ctpWins !== 1 ? 's' : ''}`}
                    />
                  )}
                  {hasLD && ldLeader && (
                    <StatCard
                      label="Long Drive Leader"
                      value={`${ldLeader.player?.last_name}, ${ldLeader.player?.first_name}`}
                      sub={`${ldLeader.ldWins} win${ldLeader.ldWins !== 1 ? 's' : ''}`}
                    />
                  )}
                </div>
              )}

              {/* Money list */}
              {standings.length === 0 ? (
                <div className="bg-white border rounded-xl p-10 text-center">
                  <p className="text-gray-500 font-medium">No earnings data yet</p>
                  <p className="text-sm text-gray-400 mt-1">Standings are calculated from completed rounds with payout configurations.</p>
                </div>
              ) : (
                <div>
                  <h2 className="text-base font-bold text-ink mb-3">Trip Money List</h2>
                  <MoneyList standings={standings} events={past} />
                </div>
              )}

              {/* Side game stats */}
              {hasSideStats && (
                <div>
                  <h2 className="text-base font-bold text-ink mb-3">Side Game Leaders</h2>
                  <SideGameTable stats={sideGameStats} hasSkins={hasSkins} hasCTP={hasCTP} hasLD={hasLD} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </LeagueLayout>
  )
}

function TravelerRooms({ travelers, roomLabels }) {
  const rooms = {}
  const unassigned = []
  for (const t of travelers) {
    if (t.room_number) (rooms[t.room_number] ??= []).push(t)
    else unassigned.push(t)
  }
  Object.values(rooms).forEach(list => list.sort((a, b) => (a.room_order ?? 0) - (b.room_order ?? 0)))
  const roomNumbers = Object.keys(rooms).map(Number).sort((a, b) => a - b)

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-700 mb-1">Travelers</h2>
        <p className="text-sm text-gray-500 mb-3">{travelers.length} going on this trip</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {[...travelers].sort((a, b) => travelerName(a).localeCompare(travelerName(b))).map(t => (
            <div key={t.id} className="bg-white border rounded-lg px-3 py-2 text-sm text-gray-700" style={{ borderColor: '#ebe9e4' }}>
              {travelerName(t)}
            </div>
          ))}
        </div>
      </div>

      {roomNumbers.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-700 mb-3">Rooms</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roomNumbers.map(n => (
              <div key={n} className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: '#ebe9e4' }}>
                <div className="px-4 py-2 border-b" style={{ borderColor: '#ebe9e4', background: '#faf9f7' }}>
                  <p className="text-sm font-bold" style={{ color: GREEN }}>{roomLabel(roomLabels, n)}</p>
                </div>
                <div className="px-4 py-2 space-y-0.5">
                  {rooms[n].map(t => (
                    <p key={t.id} className="text-sm text-gray-700">{travelerName(t)}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {unassigned.length > 0 && (
            <p className="text-sm text-gray-400 mt-3">
              Not yet assigned a room: {unassigned.map(travelerName).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function OverviewTab({ trip }) {
  const airports   = Array.isArray(trip.nearest_airports) ? trip.nearest_airports : []
  const lodging    = trip.lodging && typeof trip.lodging === 'object' ? trip.lodging : {}
  const hasLodging = !!(lodging.name || lodging.address || lodging.booking_company || lodging.checkin_date || lodging.checkout_date)
  const nights     = tripNights(trip.start_date, trip.end_date)

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4" style={{ borderColor: '#ebe9e4' }}>
      <TripInfoBlock title="Dates">
        <p className="text-sm font-semibold text-gray-700">{formatDateRange(trip.start_date, trip.end_date)}</p>
        {nights != null && <p className="text-sm text-gray-500">{nights} night{nights !== 1 ? 's' : ''}</p>}
      </TripInfoBlock>

      {airports.length > 0 && (
        <TripInfoBlock title="Nearest Airport(s)">
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: '#ebe9e4' }}>
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left font-bold text-gray-400 px-3 py-1.5 w-20">Code</th>
                  <th className="text-left font-bold text-gray-400 px-3 py-1.5">Airport</th>
                  <th className="text-left font-bold text-gray-400 px-3 py-1.5 w-32">Distance</th>
                </tr>
              </thead>
              <tbody>
                {airports.map((a, i) => (
                  <tr key={i} className={i > 0 ? 'border-t' : ''} style={{ borderColor: '#ebe9e4' }}>
                    <td className="px-3 py-1.5 font-bold text-gray-700">{a.code || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-500">{a.name || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-500">{a.distance || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TripInfoBlock>
      )}

      {hasLodging && (
        <TripInfoBlock title="Base Camp">
          <div className="rounded-lg overflow-hidden border" style={{ borderColor: '#ebe9e4' }}>
            <div className="bg-gray-50 px-4 py-3 space-y-1">
              {lodging.name && <p className="text-sm font-bold text-gray-700">{lodging.name}</p>}
              {lodging.address && <p className="text-sm text-gray-500">{lodging.address}</p>}
              {lodging.booking_company && <p className="text-sm text-gray-500">Booked via {lodging.booking_company}</p>}
            </div>
            {(lodging.checkin_date || lodging.checkout_date) && (
              <div className="px-4 py-2 text-sm text-gray-500 border-t" style={{ borderColor: '#ebe9e4' }}>
                {formatCheckInOut(lodging)}
              </div>
            )}
            {lodging.address && (
              <div className="border-t" style={{ borderColor: '#ebe9e4' }}>
                <iframe
                  title="Base camp location map"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(lodging.address)}&output=embed`}
                  width="100%"
                  height="260"
                  style={{ display: 'block', border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="px-4 py-2 border-t" style={{ borderColor: '#ebe9e4' }}>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lodging.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold underline"
                    style={{ color: GREEN }}
                  >
                    Open in Google Maps →
                  </a>
                </div>
              </div>
            )}
          </div>
        </TripInfoBlock>
      )}

      {trip.travel_info && (
        <TripInfoBlock title="Travel & Transportation">
          <p className="text-sm text-gray-500 whitespace-pre-wrap">{trip.travel_info}</p>
        </TripInfoBlock>
      )}
    </div>
  )
}

function ScheduleTab({ trip, events, leagueSlug, eventLinkOrgSlug }) {
  const meals        = Array.isArray(trip.meals) ? trip.meals : []
  const socialEvents = Array.isArray(trip.social_events) ? trip.social_events : []
  const hasAnything  = meals.length > 0 || socialEvents.length > 0 || events.length > 0

  if (!hasAnything) return <p className="text-gray-400">Nothing scheduled yet.</p>

  return (
    <div className="space-y-8">
      {events.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-700 mb-4">Golf Activities</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map(ev => (
              <EventCard key={ev.id} event={ev} leagueSlug={leagueSlug} orgSlug={eventLinkOrgSlug} muted={ev.status === 'complete'} />
            ))}
          </div>
        </section>
      )}

      {meals.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-700 mb-4">Scheduled Meals</h2>
          <div className="bg-white border rounded-xl p-5" style={{ borderColor: '#ebe9e4' }}>
            <TripInfoEntryList entries={meals} nameLabel="Event" />
          </div>
        </section>
      )}

      {socialEvents.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-700 mb-4">Social Events</h2>
          <div className="bg-white border rounded-xl p-5" style={{ borderColor: '#ebe9e4' }}>
            <TripInfoEntryList entries={socialEvents} />
          </div>
        </section>
      )}
    </div>
  )
}

function TripInfoBlock({ title, children }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5" style={{ letterSpacing: '0.04em' }}>{title}</p>
      {children}
    </div>
  )
}

function TripInfoEntryList({ entries, nameLabel = 'Name' }) {
  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: '#ebe9e4' }}>
      <table className="w-full text-sm table-fixed">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left font-bold text-gray-400 px-3 py-1.5 w-32">When</th>
            <th className="text-left font-bold text-gray-400 px-3 py-1.5">{nameLabel}</th>
            <th className="text-left font-bold text-gray-400 px-3 py-1.5">Venue</th>
            <th className="text-left font-bold text-gray-400 px-3 py-1.5">Location/Address</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={i} className={i > 0 ? 'border-t' : ''} style={{ borderColor: '#ebe9e4' }}>
              <td className="px-3 py-2 align-top">
                {formatScheduledDay(entry) && <div className="font-bold text-gray-700 leading-snug">{formatScheduledDay(entry)}</div>}
                {entry.time && <div className="text-xs text-gray-500">{formatDisplayTime(entry.time)}</div>}
                {!formatScheduledDay(entry) && !entry.time && <span className="text-gray-500">—</span>}
              </td>
              <td className="px-3 py-2 align-top text-gray-700 break-words">{entry.name || '—'}</td>
              <td className="px-3 py-2 align-top text-gray-500 break-words">{entry.venue || '—'}</td>
              <td className="px-3 py-2 align-top text-gray-500 break-words">{entry.location || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatCheckInOut(lodging) {
  const parts = []
  if (lodging.checkin_date) parts.push(`Check-in ${fmtDate(lodging.checkin_date)}${lodging.checkin_time ? ` ${lodging.checkin_time}` : ''}`)
  if (lodging.checkout_date) parts.push(`Check-out ${fmtDate(lodging.checkout_date)}${lodging.checkout_time ? ` ${lodging.checkout_time}` : ''}`)
  return parts.join(' · ')
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateRange(start, end) {
  if (!start && !end) return 'Dates TBD'
  if (start && end && start !== end) return `${fmtDate(start)} – ${fmtDate(end)}`
  return fmtDate(start || end)
}

function tripNights(start, end) {
  if (!start || !end || start === end) return null
  const ms = new Date(end + 'T00:00:00') - new Date(start + 'T00:00:00')
  return Math.round(ms / 86400000)
}

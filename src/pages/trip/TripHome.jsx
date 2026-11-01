import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSubdomainOrg } from '../../lib/SubdomainContext'
import { travelerName, roomLabel } from '../../components/TripTravelers'
import {
  useSeasonStandings,
  EventCard,
  StatCard,
  MoneyList,
  SideGameTable,
} from '../../components/SeasonStandings'
import TripSiteHeader from '../../components/trip-page/TripSiteHeader'
import TripHero from '../../components/trip-page/TripHero'
import EventTabBar from '../../components/event-page/EventTabBar'
import PageCard from '../../components/event-page/EventCard'
import { RoundsCard, ScheduleCard, StayingCard, GettingThereCard, WhosGoingCard } from '../../components/trip-page/TripPageCards'
import { buildItinerary, time12 } from '../../lib/tripItinerary'
import { tripStatus, heroFacts, dayOfTrip } from '../../lib/tripView'

const GREEN = '#1B4332'
const TABS = [
  { key: 'overview',  label: 'Overview' },
  { key: 'schedule',  label: 'Schedule' },
  { key: 'travelers', label: 'Travelers' },
  { key: 'standings', label: 'Standings' },
]

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
        .select('id, name, slug, logo_url')
        .eq('org_id', tripData.org_id)
        .eq('is_trip_league', false)
        .order('season_year', { ascending: false })
      setLeagues(allLeagues || [])

      const { data: eventsData } = await supabase
        .from('events')
        .select('id, name, event_number, slug, status, event_date, start_time, course:courses(name)')
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

  const status      = tripStatus(trip)
  const lodging     = trip.lodging && typeof trip.lodging === 'object' ? trip.lodging : {}
  const airports    = Array.isArray(trip.nearest_airports) ? trip.nearest_airports : []
  const facts       = heroFacts({ trip, rounds: events })
  const days        = buildItinerary({ trip, rounds: events })
  const names       = [...travelers].sort((a, b) => travelerName(a).localeCompare(travelerName(b))).map(travelerName)

  // The club's main league gives the site header its display name and logo; the org is the fallback.
  const mainLeague  = leagues.find(l => l.logo_url) ?? leagues[0] ?? null
  const clubName    = mainLeague?.name ?? org?.name ?? 'League'
  const clubLogo    = mainLeague?.logo_url ?? org?.logo_url ?? null
  const navLinks    = [{ key: 'home', label: 'Home', to: '/' }, ...leagues.map(lg => ({ key: lg.id, label: lg.name, to: `/${lg.slug}` }))]

  const checkIn = lodging.checkin_date
    ? `Check in ${new Date(`${lodging.checkin_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${lodging.checkin_time ? ` at ${time12(lodging.checkin_time)}` : ''}`
    : null
  const target = trip.start_date ? new Date(`${trip.start_date}T00:00:00`) : null

  function goTab(key) {
    setActiveTab(key)
    requestAnimationFrame(() => document.getElementById('trip-tabs')?.scrollIntoView({ block: 'start' }))
  }
  function showDirections() {
    setActiveTab('overview')
    setTimeout(() => document.getElementById('where-staying')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50)
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-dim">
      <TripSiteHeader name={clubName} logoUrl={clubLogo} links={navLinks} />

      <TripHero
        title={trip.name}
        status={status}
        facts={facts}
        coverUrl={trip.logo_url}
        targetDate={status === 'upcoming' ? target : null}
        progress={status === 'active' ? dayOfTrip(trip) : null}
        goingCount={travelers.length}
        checkIn={checkIn}
        onDirections={showDirections}
        onSeeSchedule={() => goTab('schedule')}
        onSeeStandings={() => goTab('standings')}
      />

      <div id="trip-tabs" className="scroll-mt-0">
        <EventTabBar tabs={TABS} value={activeTab} onChange={setActiveTab} ariaLabel="Trip sections" idPrefix="trip-tab" />
      </div>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
        {activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="flex min-w-0 flex-col gap-6">
              <RoundsCard rounds={events} leagueSlug={trip.league.slug} orgSlug={eventLinkOrgSlug} onStandings={() => goTab('standings')} />
              <ScheduleCard days={days} />
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <StayingCard lodging={lodging} />
              <GettingThereCard airports={airports} travelInfo={trip.travel_info} />
              <WhosGoingCard names={names} />
            </div>
          </div>
        )}

        {activeTab === 'schedule' && <ScheduleCard days={days} />}

        {activeTab === 'travelers' && (
          <div className="flex flex-col gap-6">
            <WhosGoingCard names={names} />
            <TravelerRooms travelers={travelers} roomLabels={trip.room_labels} />
          </div>
        )}

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
                      value={`${moneyLeader.player?.first_name} ${moneyLeader.player?.last_name}`}
                      sub={`$${moneyLeader.totalEarnings.toFixed(2)}`}
                    />
                  )}
                  {hasSkins && skinsLeader && (
                    <StatCard
                      label="Skins Leader"
                      value={`${skinsLeader.player?.first_name} ${skinsLeader.player?.last_name}`}
                      sub={`${skinsLeader.skinsWon} skin${skinsLeader.skinsWon !== 1 ? 's' : ''} won`}
                    />
                  )}
                  {hasCTP && ctpLeader && (
                    <StatCard
                      label="CTP Leader"
                      value={`${ctpLeader.player?.first_name} ${ctpLeader.player?.last_name}`}
                      sub={`${ctpLeader.ctpWins} win${ctpLeader.ctpWins !== 1 ? 's' : ''}`}
                    />
                  )}
                  {hasLD && ldLeader && (
                    <StatCard
                      label="Long Drive Leader"
                      value={`${ldLeader.player?.first_name} ${ldLeader.player?.last_name}`}
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
      </main>

      <footer className="py-5 text-center text-xs text-ink-muted">
        Powered by <a href="https://www.scorifygolf.com" target="_blank" rel="noreferrer" className="font-semibold text-ink-muted hover:underline">Scorify Golf</a>
      </footer>
    </div>
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
  if (roomNumbers.length === 0) return null

  return (
    <PageCard title="Rooms">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roomNumbers.map(n => (
          <div key={n} className="overflow-hidden rounded-sm border border-surface-border">
            <div className="border-b border-surface-border bg-surface-container px-4 py-2">
              <p className="text-sm font-bold text-fairway-700">{roomLabel(roomLabels, n)}</p>
            </div>
            <ul className="space-y-0.5 px-4 py-2">
              {rooms[n].map(t => <li key={t.id} className="text-sm text-ink">{travelerName(t)}</li>)}
            </ul>
          </div>
        ))}
      </div>
      {unassigned.length > 0 && (
        <p className="mt-3 text-sm text-ink-muted">Not yet assigned a room: {unassigned.map(travelerName).join(', ')}</p>
      )}
    </PageCard>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import LeagueLayout from '../../components/LeagueLayout'

const GREEN = '#1B4332'

function StatusBadge({ status }) {
  const styles = {
    upcoming: 'bg-blue-100 text-blue-700',
    active:   'bg-green-100 text-green-700',
    complete: 'bg-gray-100 text-gray-500',
  }
  const labels = {
    upcoming: 'Upcoming',
    active:   'Active',
    complete: 'Complete',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
      {labels[status] || status}
    </span>
  )
}

function EventCard({ event, leagueSlug, muted = false }) {
  const title = event.name || `Event #${event.event_number}`
  const date  = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null
  const course = event.course?.name

  return (
    <div className={`bg-white border rounded-xl shadow-sm p-5 flex flex-col gap-2 ${muted ? 'opacity-70' : 'hover:shadow-md transition-shadow'}`}>
      <div className="flex items-center justify-between">
        <h3 className={`font-bold text-base ${muted ? 'text-gray-500' : ''}`} style={muted ? {} : { color: GREEN }}>
          {title}
        </h3>
        <StatusBadge status={event.status} />
      </div>
      {date && <p className="text-sm text-gray-500">{date}</p>}
      {course && <p className="text-sm text-gray-400">{course}</p>}
      {event.slug && (
        <Link
          to={`/${leagueSlug}/${event.slug}`}
          className="mt-2 text-sm font-semibold self-start hover:underline"
          style={{ color: GREEN }}
        >
          View Event →
        </Link>
      )}
    </div>
  )
}

export default function LeagueHome({ orgSlug, leagueSlug }) {
  const [league,  setLeague]  = useState(null)
  const [org,     setOrg]     = useState(null)
  const [leagues, setLeagues] = useState([])
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!orgSlug || !leagueSlug) return
    async function load() {
      setLoading(true)

      // Fetch league by slug
      const { data: leagueData, error: leagueErr } = await supabase
        .from('leagues')
        .select('id, name, slug, season_year, org_id')
        .eq('slug', leagueSlug)
        .single()

      if (leagueErr || !leagueData) {
        setError('League not found.')
        setLoading(false)
        return
      }

      setLeague(leagueData)

      // Fetch org
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name, slug, logo_url, tier')
        .eq('id', leagueData.org_id)
        .single()

      setOrg(orgData)

      // Fetch all leagues for nav
      const { data: allLeagues } = await supabase
        .from('leagues')
        .select('id, name, slug')
        .eq('org_id', leagueData.org_id)
        .order('season_year', { ascending: false })

      setLeagues(allLeagues || [])

      // Fetch events for this league
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, name, event_number, slug, status, event_date, course:courses(name)')
        .eq('league_id', leagueData.id)
        .order('event_date', { ascending: false })

      setEvents(eventsData || [])
      setLoading(false)
    }
    load()
  }, [orgSlug, leagueSlug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  if (error || !league) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{error || 'League not found.'}</p>
      </div>
    )
  }

  const upcoming = events.filter((e) => e.status === 'upcoming' || e.status === 'active')
  const past     = events.filter((e) => e.status === 'complete')

  return (
    <LeagueLayout org={org} leagues={leagues}>
      {/* League header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold" style={{ color: GREEN }}>
          {league.name}
        </h1>
        {league.season_year && (
          <p className="text-gray-500 mt-1">Season {league.season_year}</p>
        )}
      </div>

      {events.length === 0 ? (
        <p className="text-gray-400">No events yet for this league.</p>
      ) : (
        <>
          {/* Upcoming / Active */}
          {upcoming.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-bold text-gray-700 mb-4">Upcoming Events</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((ev) => (
                  <EventCard key={ev.id} event={ev} leagueSlug={leagueSlug} />
                ))}
              </div>
            </section>
          )}

          {/* Past results */}
          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-700 mb-4">Past Results</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((ev) => (
                  <EventCard key={ev.id} event={ev} leagueSlug={leagueSlug} muted />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </LeagueLayout>
  )
}

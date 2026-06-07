import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Card from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/Badge'

export default function Dashboard() {
  const [stats,  setStats]  = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { count: leagueCount },
        { count: playerCount },
        { count: courseCount },
        { data: recentEvents },
      ] = await Promise.all([
        supabase.from('leagues').select('*', { count: 'exact', head: true }),
        supabase.from('players').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase
          .from('events')
          .select('id, event_date, event_number, status, entry_fee, league:leagues(name), course:courses(name)')
          .order('event_date', { ascending: false })
          .limit(8),
      ])

      setStats({ leagues: leagueCount, players: playerCount, courses: courseCount })
      setEvents(recentEvents ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <DashboardSkeleton />

  const activeEvents   = events.filter(e => e.status === 'active')
  const upcomingEvents = events.filter(e => e.status === 'upcoming')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">League administration overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Leagues"  value={stats.leagues}  to="/admin/leagues" color="bg-fairway-50 border-fairway-200" textColor="text-fairway-700" />
        <StatCard label="Players"  value={stats.players}  to="/admin/players" color="bg-blue-50 border-blue-200"       textColor="text-blue-700" />
        <StatCard label="Courses"  value={stats.courses}  to="/admin/courses" color="bg-purple-50 border-purple-200"   textColor="text-purple-700" />
      </div>

      {/* Active events */}
      {activeEvents.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            Active Events
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeEvents.map(ev => <EventCard key={ev.id} event={ev} />)}
          </div>
        </div>
      )}

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-3">Upcoming Events</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingEvents.map(ev => <EventCard key={ev.id} event={ev} />)}
          </div>
        </div>
      )}

      {/* Recent completed */}
      <div>
        <h2 className="text-base font-bold text-gray-800 mb-3">Recent Events</h2>
        <Card className="overflow-hidden p-0">
          {events.filter(e => e.status === 'complete').length === 0
            ? <p className="text-sm text-gray-400 p-5">No completed events yet.</p>
            : (
            <div className="divide-y divide-gray-100">
              {events.filter(e => e.status === 'complete').map(ev => (
                <Link
                  key={ev.id}
                  to={`/admin/events/${ev.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {ev.league?.name} — Event #{ev.event_number}
                    </div>
                    <div className="text-xs text-gray-500">{formatDate(ev.event_date)} · {ev.course?.name}</div>
                  </div>
                  <StatusBadge status={ev.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function StatCard({ label, value, to, color, textColor }) {
  return (
    <Link
      to={to}
      className={`card border p-4 sm:p-5 flex flex-col gap-1 hover:shadow-md transition-shadow ${color}`}
    >
      <span className={`text-2xl sm:text-3xl font-bold ${textColor}`}>{value ?? 0}</span>
      <span className="text-xs sm:text-sm text-gray-600 font-medium">{label}</span>
    </Link>
  )
}

function EventCard({ event: ev }) {
  return (
    <div className="card border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <Link to={`/admin/events/${ev.id}`} className="block">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-gray-900 text-sm">
              {ev.league?.name} — Event #{ev.event_number}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{ev.course?.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">{formatDate(ev.event_date)}</div>
          </div>
          <StatusBadge status={ev.status} />
        </div>
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <Link
          to={`/leaderboard/${ev.id}`}
          className="text-xs text-fairway-700 font-medium hover:underline"
        >
          View Leaderboard →
        </Link>
        <Link
          to={`/schedule/${ev.id}`}
          className="text-xs text-gray-500 font-medium hover:underline"
        >
          Pairings →
        </Link>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded" />
      <div className="grid grid-cols-3 gap-4">
        {[0,1,2].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
      </div>
      <div className="h-40 bg-gray-200 rounded-xl" />
    </div>
  )
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

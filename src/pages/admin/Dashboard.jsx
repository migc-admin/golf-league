import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import Card from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/Badge'
import { useOrg } from '../../lib/OrgContext'
import TierBadge from '../../components/ui/TierBadge'

export default function Dashboard() {
  const { user } = useAuth()
  const org = useOrg()
  const [stats,        setStats]        = useState(null)
  const [events,       setEvents]       = useState([])
  const [orgSlug,      setOrgSlug]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const showUpgradeBanner = searchParams.get('upgraded') === 'true'

  useEffect(() => {
    async function load() {
      const [
        { count: leagueCount },
        { count: playerCount },
        { count: courseCount },
        { count: eventCount },
        { data: recentEvents },
      ] = await Promise.all([
        supabase.from('leagues').select('*', { count: 'exact', head: true }),
        supabase.from('players').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase
          .from('events')
          .select('id, event_date, event_number, slug, status, entry_fee, league:leagues(name, slug), course:courses(name), event_players(count)')
          .order('event_date', { ascending: false })
          .limit(10),
      ])

      setStats({ leagues: leagueCount, players: playerCount, courses: courseCount, events: eventCount })
      setEvents(recentEvents ?? [])

      // Fetch orgSlug for route building
      if (user) {
        const { data: profile } = await supabase
          .from('profiles').select('org_id').eq('id', user.id).single()
        if (profile?.org_id) {
          const { data: org } = await supabase
            .from('organizations').select('slug').eq('id', profile.org_id).single()
          if (org?.slug) setOrgSlug(org.slug)
        }
      }

      setLoading(false)
    }
    load()
  }, [user])

  if (loading) return <DashboardSkeleton />

  const activeEvents   = events.filter(e => e.status === 'active')
  const upcomingEvents = events.filter(e => e.status === 'upcoming')
  const completedEvents = events.filter(e => e.status === 'complete')

  // Stats strip values
  const activePot = activeEvents.reduce((sum, ev) => {
    const count = ev.event_players?.[0]?.count ?? 0
    return sum + (ev.entry_fee ?? 0) * count
  }, 0)

  return (
    <div className="space-y-6">
      {showUpgradeBanner && (
        <div className="flex items-center justify-between gap-4 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-green-600 text-xl">🎉</span>
            <div>
              <p className="font-semibold text-green-800">
                You're now on the {org?.tier ? org.tier.charAt(0).toUpperCase() + org.tier.slice(1) : ''} plan!
              </p>
              <p className="text-sm text-green-700">Your account has been upgraded. All features for your plan are now active.</p>
            </div>
          </div>
          <button
            onClick={() => setSearchParams({})}
            className="text-green-500 hover:text-green-700 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Home</h1>
          <p className="text-gray-500 text-sm mt-1">League administration overview</p>
        </div>
        {org && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Plan:</span>
            <TierBadge tier={org.tier ?? 'free'} />
          </div>
        )}
      </div>

      {/* #7: Stats strip */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-[0_4px_20px_rgba(15,61,46,0.05)] grid grid-cols-2 sm:flex sm:divide-x divide-gray-100 overflow-hidden">
        <StatStrip label="Total Players" value={stats.players} to="/admin/players" />
        <StatStrip label="Events on Record" value={stats.events ?? 0} />
        <StatStrip label="Leagues" value={stats.leagues} to="/admin/leagues" />
        {activePot > 0 && (
          <StatStrip label="Active Pot" value={`$${activePot.toLocaleString()}`} highlight />
        )}
      </div>

      {/* #6: Active events — hero card treatment */}
      {activeEvents.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            Active
          </h2>
          <div className="space-y-3">
            {activeEvents.map(ev => <HeroEventCard key={ev.id} event={ev} orgSlug={orgSlug} />)}
          </div>
        </div>
      )}

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">Upcoming</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingEvents.map(ev => <EventCard key={ev.id} event={ev} orgSlug={orgSlug} />)}
          </div>
        </div>
      )}

      {/* Recent completed */}
      {completedEvents.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">Recent</h2>
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-gray-100">
              {completedEvents.map(ev => (
                <Link
                  key={ev.id}
                  to={`/admin/${orgSlug}/${ev.league?.slug}/${ev.slug}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {ev.league?.name} — Event #{ev.event_number}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{formatDate(ev.event_date)} · {ev.course?.name}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={ev.status} />
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-gray-400">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}

      {events.length === 0 && (
        <Card>
          <p className="text-sm text-gray-400 text-center py-4">No events yet. Create your first event from the Leagues page.</p>
        </Card>
      )}
    </div>
  )
}

// #7: Horizontal stat strip item
function StatStrip({ label, value, to, highlight }) {
  const inner = (
    <div className={`flex-1 px-5 py-4 text-center transition-colors ${to ? 'hover:bg-fairway-50 cursor-pointer' : ''}`}>
      <div className={`text-2xl font-bold tabular-nums ${highlight ? 'text-gold-500' : 'text-augusta-600'}`}>
        {value ?? 0}
      </div>
      <div className="text-xs text-gray-500 font-medium mt-0.5">{label}</div>
    </div>
  )
  return to ? <Link to={to} className="flex-1">{inner}</Link> : <div className="flex-1">{inner}</div>
}

// #6: Hero card for active events
function HeroEventCard({ event: ev, orgSlug }) {
  const playerCount = ev.event_players?.[0]?.count ?? 0
  const pot = playerCount && ev.entry_fee ? (playerCount * ev.entry_fee).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-[0_4px_20px_rgba(15,61,46,0.05)] overflow-hidden border-l-4 border-l-gold-400">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={ev.status} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">
              {ev.league?.name} — Event #{ev.event_number}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">{ev.course?.name} · {formatDate(ev.event_date)}</p>
            {(playerCount > 0 || pot) && (
              <div className="flex items-center gap-4 mt-3">
                {playerCount > 0 && (
                  <span className="text-sm font-semibold text-fairway-700">
                    {playerCount} {playerCount === 1 ? 'player' : 'players'}
                  </span>
                )}
                {pot && (
                  <span className="text-sm font-semibold text-gold-600 tabular-nums">
                    {pot} pot
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
          <Link
            to={`/admin/${orgSlug}/${ev.league?.slug}/${ev.slug}`}
            className="btn btn-primary btn-sm"
          >
            Manage Event
          </Link>
          <Link
            to={`/${orgSlug}/${ev.league?.slug}/${ev.slug}/leaderboard`}
            className="btn btn-secondary btn-sm"
          >
            Leaderboard
          </Link>
          <Link
            to={`/${orgSlug}/${ev.league?.slug}/${ev.slug}/schedule`}
            className="text-xs text-gray-500 font-medium hover:underline ml-1"
          >
            Pairings →
          </Link>
        </div>
      </div>
    </div>
  )
}

function EventCard({ event: ev, orgSlug }) {
  return (
    <Link to={`/admin/${orgSlug}/${ev.league?.slug}/${ev.slug}`} className="block card border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
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
      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs text-fairway-700 font-medium">View details →</span>
      </div>
    </Link>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded" />
      <div className="h-16 bg-gray-200 rounded-xl" />
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

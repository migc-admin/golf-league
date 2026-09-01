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
  const [leagues,       setLeagues]       = useState([])
  const [stats,         setStats]         = useState(null)
  const [orgSlug,       setOrgSlug]       = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [loadError,     setLoadError]     = useState(null)
  const [searchParams, setSearchParams]   = useSearchParams()
  const showUpgradeBanner = searchParams.get('upgraded') === 'true'

  useEffect(() => {
    async function load() {
      if (!user) return

      try {
      const { data: profile } = await supabase
        .from('profiles').select('org_id').eq('id', user.id).single()
      if (!profile?.org_id) { setLoading(false); return }

      const { data: orgData } = await supabase
        .from('organizations').select('slug').eq('id', profile.org_id).single()
      if (orgData?.slug) setOrgSlug(orgData.slug)

      const [
        { count: playerCount, error: e1 },
        { count: eventCount,  error: e2 },
        { data: leagueRows,   error: e3 },
      ] = await Promise.all([
        supabase.from('players').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id),
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase
          .from('leagues')
          .select('id, name, slug, season_year')
          .eq('org_id', profile.org_id)
          .order('season_year', { ascending: false }),
      ])

      if (e1 || e2 || e3) throw new Error((e1 || e2 || e3).message)

      setStats({ players: playerCount ?? 0, events: eventCount ?? 0, leagues: leagueRows?.length ?? 0 })

      // For each league, fetch its events
      if (leagueRows?.length) {
        const leagueIds = leagueRows.map(l => l.id)
        const { data: events } = await supabase
          .from('events')
          .select('id, name, event_number, slug, status, entry_fee, event_date, league_id, course:courses(name), event_players(count)')
          .in('league_id', leagueIds)
          .order('event_date', { ascending: false })

        const eventsByLeague = {}
        for (const ev of events ?? []) {
          if (!eventsByLeague[ev.league_id]) eventsByLeague[ev.league_id] = []
          eventsByLeague[ev.league_id].push(ev)
        }

        setLeagues(leagueRows.map(l => ({ ...l, events: eventsByLeague[l.id] ?? [] })))
      }

      setLoading(false)
      } catch (err) {
        setLoadError('Failed to load dashboard data. Please refresh.')
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (loading) return <DashboardSkeleton />
  if (loadError) return <div className="text-center py-16 text-red-600 font-medium">{loadError}</div>

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
          <button onClick={() => setSearchParams({})} className="text-green-500 hover:text-green-700 text-lg leading-none">×</button>
        </div>
      )}

      {/* Header */}
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

      {/* Stats strip */}
      {stats && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-[0_4px_20px_rgba(15,61,46,0.05)] grid grid-cols-3 divide-x divide-gray-100 overflow-hidden">
          <StatStrip label="Players" value={stats.players} to="/admin/players" />
          <StatStrip label="Events" value={stats.events} />
          <StatStrip label="Leagues" value={stats.leagues} to="/admin/leagues" />
        </div>
      )}

      {/* Leagues + events */}
      {leagues.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400 text-center py-4">No leagues yet. <Link to="/admin/leagues" className="text-fairway-700 font-semibold hover:underline">Create your first league →</Link></p>
        </Card>
      ) : (
        <div className="space-y-6">
          {leagues.map(league => (
            <LeagueSection key={league.id} league={league} orgSlug={orgSlug} />
          ))}
        </div>
      )}
    </div>
  )
}

function LeagueSection({ league, orgSlug }) {
  const active    = league.events.filter(e => e.status === 'active')
  const upcoming  = league.events.filter(e => e.status === 'upcoming')
  const completed = league.events.filter(e => e.status === 'complete')

  return (
    <div>
      {/* League header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-gray-900">{league.name}</h2>
          {league.season_year && (
            <span className="text-xs text-gray-400 font-medium">{league.season_year}</span>
          )}
        </div>
        <Link
          to="/admin/leagues"
          className="text-xs text-fairway-700 font-semibold hover:underline"
        >
          Manage league →
        </Link>
      </div>

      {league.events.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-6 text-center">
          <p className="text-sm text-gray-400">No events yet for this league.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-[0_2px_12px_rgba(15,61,46,0.04)] overflow-hidden">
          {/* Active events — highlighted */}
          {active.map(ev => (
            <EventRow key={ev.id} event={ev} orgSlug={orgSlug} leagueSlug={league.slug} highlight />
          ))}
          {/* Upcoming */}
          {upcoming.map(ev => (
            <EventRow key={ev.id} event={ev} orgSlug={orgSlug} leagueSlug={league.slug} />
          ))}
          {/* Completed */}
          {completed.map(ev => (
            <EventRow key={ev.id} event={ev} orgSlug={orgSlug} leagueSlug={league.slug} />
          ))}
        </div>
      )}
    </div>
  )
}

function EventRow({ event: ev, orgSlug, leagueSlug, highlight }) {
  const playerCount = ev.event_players?.[0]?.count ?? 0
  const eventName   = ev.name ?? `Event #${ev.event_number}`

  return (
    <Link
      to={`/admin/${orgSlug}/${leagueSlug}/${ev.slug}`}
      className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 group"
      style={highlight ? { borderLeft: '3px solid #D4AF37' } : {}}
    >
      <div className="flex items-center gap-3 min-w-0">
        {highlight && (
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
        )}
        <div className="min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate">{eventName}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {formatDate(ev.event_date)}{ev.course?.name ? ` · ${ev.course.name}` : ''}
            {playerCount > 0 ? ` · ${playerCount} players` : ''}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <StatusBadge status={ev.status} />
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-gray-300 group-hover:text-gray-400 transition-colors">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </Link>
  )
}

function StatStrip({ label, value, to }) {
  const inner = (
    <div className={`px-5 py-4 text-center transition-colors ${to ? 'hover:bg-fairway-50 cursor-pointer' : ''}`}>
      <div className="text-2xl font-bold tabular-nums text-augusta-600">{value ?? 0}</div>
      <div className="text-xs text-gray-500 font-medium mt-0.5">{label}</div>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : <div>{inner}</div>
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded" />
      <div className="h-16 bg-gray-200 rounded-xl" />
      <div className="h-40 bg-gray-200 rounded-xl" />
      <div className="h-40 bg-gray-200 rounded-xl" />
    </div>
  )
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

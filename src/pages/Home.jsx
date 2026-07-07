import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useOrg } from '../lib/OrgContext'

export default function Home() {
  const { user, profile, signOut, loading, profileLoading } = useAuth()
  const navigate = useNavigate()
  const org = useOrg()
  const orgName = org?.name ?? 'Golf League'
  const [events, setEvents]     = useState([])
  const [fetching, setFetching] = useState(true)

  const isAdmin       = profile?.role === 'admin'
  const isScorekeeper = profile?.role === 'scorekeeper'

  useEffect(() => {
    if (loading || profileLoading) return
    if (!user) { navigate('/login', { replace: true }); return }
    loadEvents()
  }, [user, loading, profileLoading])

  async function loadEvents() {
    setFetching(true)
    try {
      if (isAdmin) {
        // Admins see all active/upcoming events
        const { data } = await supabase
          .from('events')
          .select('id, name, slug, event_number, event_date, status, league:leagues(slug)')
          .in('status', ['active', 'upcoming'])
          .order('event_date', { ascending: true })
          .limit(10)
        setEvents(data ?? [])
      } else if (isScorekeeper) {
        // Scorekeepers see events where they have an entry
        // 1. Find player record matching their email
        const { data: playerRows } = await supabase
          .from('players')
          .select('id')
          .eq('email', user.email)
          .limit(1)
        const playerId = playerRows?.[0]?.id
        if (playerId) {
          const { data: entries } = await supabase
            .from('event_players')
            .select('event_id, events(id, name, slug, event_number, event_date, status, league:leagues(slug))')
            .eq('player_id', playerId)
          const active = (entries ?? [])
            .map(e => e.events)
            .filter(ev => ev && ['active', 'upcoming'].includes(ev.status))
            .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
          setEvents(active)
        }
      }
    } finally {
      setFetching(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <svg className="animate-spin h-8 w-8 text-fairway-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  const roleBadge = isAdmin
    ? 'bg-green-100 text-green-800'
    : isScorekeeper
    ? 'bg-blue-100 text-blue-800'
    : 'bg-gray-100 text-gray-600'

  const roleLabel = isAdmin ? 'Admin' : isScorekeeper ? 'Scorekeeper' : 'No role assigned'

  return (
    <div className="min-h-screen bg-gradient-to-br from-fairway-800 to-fairway-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt={orgName} className="w-9 h-9 rounded-full object-cover" />
          <span className="text-white font-bold" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem' }}>{orgName}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="text-fairway-200 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors border border-fairway-600 hover:border-white/30"
        >
          Sign out
        </button>
      </header>

      {/* Main card */}
      <main className="flex-1 flex flex-col items-center px-4 pt-6 pb-10">
        <div className="w-full max-w-md space-y-4">

          {/* Welcome card */}
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Signed in as</p>
                <h2 className="text-lg font-bold text-gray-900">
                  {profile?.full_name || user?.email}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleBadge}`}>
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Admin shortcut */}
          {isAdmin && (
            <div className="bg-white rounded-2xl shadow-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Admin</h3>
              <Link
                to="/admin"
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-fairway-600 text-white font-medium text-sm hover:bg-fairway-700 transition-colors"
              >
                <span>Go to Home</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}

          {/* Events */}
          {(isAdmin || isScorekeeper) && (
            <div className="bg-white rounded-2xl shadow-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                {isAdmin ? 'Active & Upcoming Events' : 'Your Events'}
              </h3>
              {fetching ? (
                <div className="space-y-2 animate-pulse">
                  {[0,1].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
                </div>
              ) : events.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No active events right now.</p>
              ) : (
                <div className="space-y-2">
                  {events.map(ev => (
                    <Link
                      key={ev.id}
                      to={`/${ev.league?.slug}/${ev.slug}/scorecard`}
                      className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:border-fairway-200 hover:bg-fairway-50 transition-colors group"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-800 group-hover:text-fairway-700">{ev.name}</div>
                        {ev.event_date && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {new Date(ev.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ev.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{ev.status}</span>
                        <svg className="w-4 h-4 text-gray-300 group-hover:text-fairway-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No role */}
          {!isAdmin && !isScorekeeper && (
            <div className="bg-white rounded-2xl shadow-xl p-5 text-center">
              <p className="text-sm text-gray-500">
                Your account doesn't have a role assigned yet.<br />
                Contact your league admin for access.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

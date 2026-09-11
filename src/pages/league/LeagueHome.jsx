import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSubdomainOrg } from '../../lib/SubdomainContext'
import LeagueLayout from '../../components/LeagueLayout'
import {
  useSeasonStandings,
  EventCard,
  StatCard,
  MoneyList,
  SideGameTable,
} from '../../components/SeasonStandings'

const GREEN = '#1B4332'

export default function LeagueHome({ orgSlug, leagueSlug, initialTab = 'events' }) {
  const [league,         setLeague]         = useState(null)
  const [org,            setOrg]            = useState(null)
  const [leagues,        setLeagues]        = useState([])
  const [events,         setEvents]         = useState([])
  const [activeTab,      setActiveTab]      = useState(initialTab)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const subdomainOrg = useSubdomainOrg()
  // On a subdomain the event route is /:leagueSlug/:eventSlug; otherwise it's
  // /:orgSlug/:leagueSlug/:eventSlug/event — EventCard needs orgSlug for the latter.
  const eventLinkOrgSlug = subdomainOrg ? null : orgSlug
  const { standings, sideGameStats, standingsLoading, loadStandings } = useSeasonStandings()

  useEffect(() => {
    if (!orgSlug || !leagueSlug) return
    async function load() {
      setLoading(true)

      const { data: leagueData, error: leagueErr } = await supabase
        .from('leagues')
        .select('id, name, slug, season_year, org_id, standings_config')
        .eq('slug', leagueSlug)
        .single()

      if (leagueErr || !leagueData) { setError('League not found.'); setLoading(false); return }
      setLeague(leagueData)

      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name, slug, logo_url, tier')
        .eq('id', leagueData.org_id)
        .single()
      setOrg(orgData)

      const { data: allLeagues } = await supabase
        .from('leagues')
        .select('id, name, slug')
        .eq('org_id', leagueData.org_id)
        .eq('is_trip_league', false)
        .order('season_year', { ascending: false })
      setLeagues(allLeagues || [])

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

  // Load standings data when tab is first opened
  useEffect(() => {
    if (activeTab !== 'standings' || !league) return
    if (standings.length > 0) return  // already loaded
    loadStandings(league.id, league.standings_config)
  }, [activeTab, league])

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

  const upcoming       = events.filter(e => e.status === 'upcoming' || e.status === 'active')
  const past           = events.filter(e => e.status === 'complete')
  const moneyLeader    = standings[0]
  const skinsLeader    = [...sideGameStats].sort((a, b) => b.skinsWon - a.skinsWon)[0]
  const ctpLeader      = [...sideGameStats].filter(s => s.ctpWins > 0).sort((a, b) => b.ctpWins - a.ctpWins)[0]
  const ldLeader       = [...sideGameStats].filter(s => s.ldWins > 0).sort((a, b) => b.ldWins - a.ldWins)[0]
  const hasSideStats   = sideGameStats.length > 0
  const hasSkins       = sideGameStats.some(s => s.skinsWon > 0)
  const hasCTP         = sideGameStats.some(s => s.ctpWins > 0)
  const hasLD          = sideGameStats.some(s => s.ldWins > 0)

  return (
    <LeagueLayout org={org} leagues={leagues}>
      {/* League header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold" style={{ color: GREEN }}>{league.name}</h1>
        {league.season_year && <p className="text-gray-500 mt-1">Season {league.season_year}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: '#ebe9e4' }}>
        {['events', 'standings'].map(tab => (
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
            {tab === 'events' ? 'Events' : 'Season'}
          </button>
        ))}
      </div>

      {/* Events tab */}
      {activeTab === 'events' && (
        <>
          {events.length === 0 ? (
            <p className="text-gray-400">No events yet for this league.</p>
          ) : (
            <>
              {upcoming.length > 0 && (
                <section className="mb-10">
                  <h2 className="text-lg font-bold text-gray-700 mb-4">Upcoming Events</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {upcoming.map(ev => <EventCard key={ev.id} event={ev} leagueSlug={leagueSlug} orgSlug={eventLinkOrgSlug} />)}
                  </div>
                </section>
              )}
              {past.length > 0 && (
                <section>
                  <h2 className="text-lg font-bold text-gray-700 mb-4">Past Results</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {past.map(ev => <EventCard key={ev.id} event={ev} leagueSlug={leagueSlug} orgSlug={eventLinkOrgSlug} muted />)}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {/* Season tab */}
      {activeTab === 'standings' && (
        <div className="space-y-8">

          {/* Past events — shown first */}
          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-700 mb-4">Past Results</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {past.map(ev => <EventCard key={ev.id} event={ev} leagueSlug={leagueSlug} orgSlug={eventLinkOrgSlug} muted />)}
              </div>
            </section>
          )}

          {/* Season standings */}
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
                  <p className="text-sm text-gray-400 mt-1">Standings are calculated from completed events with payout configurations.</p>
                </div>
              ) : (
                <div>
                  <h2 className="text-base font-bold text-ink mb-3">Season Money List</h2>
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

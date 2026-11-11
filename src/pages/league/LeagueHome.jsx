import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSubdomainOrg } from '../../lib/SubdomainContext'
import {
  useSeasonStandings,
  EventCard,
  DEFAULT_STANDINGS_CONFIG,
} from '../../components/SeasonStandings'
import TripSiteHeader from '../../components/trip-page/TripSiteHeader'
import EventTabBar from '../../components/event-page/EventTabBar'
import SeasonHero from '../../components/league-page/SeasonHero'
import LeaderTiles from '../../components/league-page/LeaderTiles'
import MoneyListCard from '../../components/league-page/MoneyListCard'
import { SideLeadersCard, ResultsByEventCard } from '../../components/league-page/SideCards'
import OverallWinnersCard from '../../components/league-page/OverallWinnersCard'
import TeamStandingsCard from '../../components/league-page/TeamStandingsCard'
import { teamSeasonView } from '../../lib/teamSeason'
import { overallWinners } from '../../lib/overallWinners'
import PlayerScoringCard from '../../components/league-page/PlayerScoringCard'
import InsightsGrid from '../../components/league-page/InsightsGrid'
import BylawsCard from '../../components/league-page/BylawsCard'
import { seasonInsights, ctpWinsByFlight, insightExclusions } from '../../lib/insights'
import { playerScoringRows } from '../../lib/playerScoring'
import { registrationState } from '../../lib/eventPageView'
import { monthDay, moneyRows, sideRows, playerName, moneyListSubtitle, sideGameSubtitle, nextEventOf, seasonMeta, UNNAMED } from '../../lib/seasonView'

const GREEN = '#1B4332'
const TABS = [
  { key: 'events',    label: 'Events' },
  { key: 'standings', label: 'Season standings' },
  { key: 'scoring',   label: 'Player scoring' },
  { key: 'insights',  label: 'Insights' },
]
const RULES_TAB = { key: 'rules', label: 'Rules & bylaws' }

export default function LeagueHome({ orgSlug, leagueSlug, initialTab = 'events' }) {
  const [league,         setLeague]         = useState(null)
  const [org,            setOrg]            = useState(null)
  const [leagues,        setLeagues]        = useState([])
  const [events,         setEvents]         = useState([])
  const [activeTab,      setActiveTab]      = useState(initialTab)
  const [bylaws,         setBylaws]         = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [nextCount,      setNextCount]      = useState(null)
  const subdomainOrg = useSubdomainOrg()
  // On a subdomain the event route is /:leagueSlug/:eventSlug; otherwise it's
  // /:orgSlug/:leagueSlug/:eventSlug/event — EventCard needs orgSlug for the latter.
  const eventLinkOrgSlug = subdomainOrg ? null : orgSlug
  const { standings, sideGameStats, standingsLoading, loadStandings, eventData } = useSeasonStandings()
  const [teamData, setTeamData] = useState(null)   // { teams, members, selections } for this league

  useEffect(() => {
    if (!orgSlug || !leagueSlug) return
    async function load() {
      setLoading(true)

      const { data: leagueData, error: leagueErr } = await supabase
        .from('leagues')
        .select('id, name, slug, season_year, org_id, standings_config, logo_url')
        .eq('slug', leagueSlug)
        .single()

      if (leagueErr || !leagueData) { setError('League not found.'); setLoading(false); return }
      setLeague(leagueData)

      // Rules & bylaws: shown only when the league has switched them on (the database
      // also hides unpublished bylaws from anyone outside the org).
      const { data: bylawsRow } = await supabase
        .from('league_bylaws')
        .select('body, is_public, updated_at')
        .eq('league_id', leagueData.id)
        .maybeSingle()
      setBylaws(bylawsRow?.is_public && bylawsRow.body?.trim() ? bylawsRow : null)

      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name, slug, logo_url, tier')
        .eq('id', leagueData.org_id)
        .single()
      setOrg(orgData)

      const { data: allLeagues } = await supabase
        .from('leagues')
        .select('id, name, slug, logo_url')
        .eq('org_id', leagueData.org_id)
        .eq('is_trip_league', false)
        .order('season_year', { ascending: false })
      setLeagues(allLeagues || [])

      const { data: eventsData } = await supabase
        .from('events')
        .select('id, name, event_number, slug, status, event_date, registration_spots, registration_open, course:courses(name)')
        .eq('league_id', leagueData.id)
        .order('event_date', { ascending: false })
      setEvents(eventsData || [])
      setLoading(false)
    }
    load()
  }, [orgSlug, leagueSlug])

  // Load standings data when tab is first opened
  useEffect(() => {
    if (activeTab === 'events' || activeTab === 'rules' || !league) return
    if (standings.length > 0) return  // already loaded
    loadStandings(league.id, league.standings_config)
  }, [activeTab, league])

  const scoringRows = useMemo(() => playerScoringRows(eventData), [eventData])
  // Insights leave out guests and no-shows; the Player scoring tab still lists every round
  const insightRows  = useMemo(() => {
    const skip = insightExclusions(eventData)
    return scoringRows.filter(r => !skip.has(r.key))
  }, [scoringRows, eventData])
  const insightCards = useMemo(() => seasonInsights(insightRows, { ctpByFlight: ctpWinsByFlight(eventData) }), [insightRows, eventData])

  // Team Play tables for this league (only read once the standings have loaded)
  useEffect(() => {
    if (!league || eventData.events.length === 0) return
    let cancelled = false
    async function loadTeams() {
      const { data: teams } = await supabase.from('tgl_teams').select('*').eq('league_id', league.id).order('name')
      if (!teams?.length) { if (!cancelled) setTeamData({ teams: [], members: [], selections: [] }); return }
      const [{ data: members }, { data: selections }] = await Promise.all([
        supabase.from('tgl_team_members').select('*').in('team_id', teams.map(t => t.id)),
        supabase.from('tgl_event_selections').select('*').in('event_id', eventData.events.map(e => e.id)),
      ])
      if (!cancelled) setTeamData({ teams, members: members ?? [], selections: selections ?? [] })
    }
    loadTeams()
    return () => { cancelled = true }
  }, [league?.id, eventData])

  // Spots left on the next event (decides "Registration open" vs "closed"), same count the event page uses
  const nextEv = nextEventOf(events)
  useEffect(() => {
    if (!nextEv || nextEv.registration_spots == null) { setNextCount(null); return }
    let cancelled = false
    supabase.from('event_players').select('id', { count: 'exact', head: true }).eq('event_id', nextEv.id)
      .then(({ count }) => { if (!cancelled) setNextCount(count ?? 0) })
    return () => { cancelled = true }
  }, [nextEv?.id, nextEv?.registration_spots])

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

  const past           = events.filter(e => e.status === 'complete')
  const moneyLeader    = standings[0]
  const skinsLeader    = [...sideGameStats].sort((a, b) => b.skinsWon - a.skinsWon)[0]
  const ctpLeader      = [...sideGameStats].filter(s => s.ctpWins > 0).sort((a, b) => b.ctpWins - a.ctpWins)[0]
  const ldLeader       = [...sideGameStats].filter(s => s.ldWins > 0).sort((a, b) => b.ldWins - a.ldWins)[0]
  const hasSideStats   = sideGameStats.length > 0
  const hasSkins       = sideGameStats.some(s => s.skinsWon > 0)
  const hasCTP         = sideGameStats.some(s => s.ctpWins > 0)
  const hasLD          = sideGameStats.some(s => s.ldWins > 0)
  const hasLP          = sideGameStats.some(s => s.lpWins > 0)
  const upcoming       = events.filter(e => e.status === 'upcoming' || e.status === 'active')

  // Site header: the club's league gives it the display name and logo; the org is the fallback.
  const mainLeague = (league.logo_url ? league : null) ?? leagues.find(l => l.logo_url) ?? league
  const clubName   = mainLeague?.name ?? org?.name ?? 'League'
  const clubLogo   = mainLeague?.logo_url ?? org?.logo_url ?? null

  const eventHref = ev => (eventLinkOrgSlug ? `/${eventLinkOrgSlug}/${leagueSlug}/${ev.slug}/event` : `/${leagueSlug}/${ev.slug}`)
  const eventHrefs = Object.fromEntries(past.filter(ev => ev.slug).map(ev => [ev.id, eventHref(ev)]))

  // Next event card
  let next = null
  if (nextEv) {
    const md = monthDay(nextEv.event_date)
    const spotsLeft = nextEv.registration_spots != null ? Math.max(0, nextEv.registration_spots - (nextCount ?? 0)) : null
    const regUrl = nextEv.slug ? `/register/${leagueSlug}/${nextEv.slug}` : null
    const reg = registrationState({ status: nextEv.status, regUrl, spotsLeft, open: nextEv.registration_open !== false })
    if (md && nextEv.slug) {
      next = {
        ...md,
        name: nextEv.name || `Event #${nextEv.event_number}`,
        sub: [nextEv.course?.name, reg.pill].filter(Boolean).join(' · '),
        href: reg.canRegister ? regUrl : eventHref(nextEv),
        cta: reg.canRegister ? 'Register →' : 'View event →',
      }
    }
  }

  const onStandings = activeTab === 'standings'
  const latest = past[0]
  const pill = league.season_year ? `Season ${league.season_year}` : null
  const onScoring = activeTab === 'scoring'
  const onInsights = activeTab === 'insights'
  const heroTitle = onStandings ? 'Season standings' : onScoring ? 'Player scoring' : onInsights ? 'Season insights' : league.name
  const heroRows = onInsights ? insightRows : scoringRows
  const heroMeta = onScoring || onInsights
    ? (heroRows.length ? `${heroRows.length} round${heroRows.length === 1 ? '' : 's'} · ${new Set(heroRows.map(r => r.playerId)).size} players · ${past.length} event${past.length === 1 ? '' : 's'}` : null)
    : onStandings
    ? seasonMeta({ played: past.length, inMoney: standings.length > 0 ? standings.length : null, latestName: latest ? (latest.name || `Event #${latest.event_number}`) : null })
    : `${past.length} event${past.length === 1 ? '' : 's'} played${upcoming.length ? ` · ${upcoming.length} upcoming` : ''}`

  const leaderName = s => playerName(s.player) ?? UNNAMED
  const tiles = []
  if (moneyLeader) tiles.push({ key: 'money', label: 'Money leader', name: leaderName(moneyLeader), sub: `$${moneyLeader.totalEarnings.toFixed(2)} · ${moneyLeader.eventsPlayed} event${moneyLeader.eventsPlayed === 1 ? '' : 's'}`, lead: true })
  if (hasSkins && skinsLeader) tiles.push({ key: 'skins', label: 'Skins leader', name: leaderName(skinsLeader), sub: `${skinsLeader.skinsWon} skin${skinsLeader.skinsWon !== 1 ? 's' : ''} won` })
  if (hasCTP && ctpLeader) tiles.push({ key: 'ctp', label: 'Closest to pin', name: leaderName(ctpLeader), sub: `${ctpLeader.ctpWins} win${ctpLeader.ctpWins !== 1 ? 's' : ''}` })
  if (hasLD && ldLeader) tiles.push({ key: 'ld', label: 'Long drive', name: leaderName(ldLeader), sub: `${ldLeader.ldWins} win${ldLeader.ldWins !== 1 ? 's' : ''}` })

  const cfg = { ...DEFAULT_STANDINGS_CONFIG, ...(league.standings_config ?? {}) }
  const resultItems = past.slice(0, 8).filter(ev => ev.slug).map(ev => ({
    key: ev.id, ...(monthDay(ev.event_date) ?? { mon: '', day: '' }),
    name: ev.name || `Event #${ev.event_number}`, course: ev.course?.name, href: eventHref(ev),
  }))

  const teamView = teamData?.teams.length
    ? teamSeasonView({ events: eventData.events, epsByEvent: eventData.epsByEvent, scoresByEvent: eventData.scoresByEvent, tglTeams: teamData.teams, tglMembers: teamData.members, tglSelections: teamData.selections })
    : null
  const overallFlights = overallWinners({ events: eventData.events, epsByEvent: eventData.epsByEvent, scoresByEvent: eventData.scoresByEvent })
  const teamEvents = past.map(ev => ({ id: ev.id, label: ev.name || `Event #${ev.event_number}` }))

  function goTab(key) {
    setActiveTab(key)
    requestAnimationFrame(() => document.getElementById('league-tabs')?.scrollIntoView({ block: 'start' }))
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-dim">
      <TripSiteHeader name={clubName} logoUrl={clubLogo} links={[]} />

      <SeasonHero pill={pill} title={heroTitle} meta={heroMeta} next={next} />

      <div id="league-tabs">
        <EventTabBar tabs={bylaws ? [...TABS, RULES_TAB] : TABS} value={activeTab} onChange={setActiveTab} ariaLabel="League sections" idPrefix="league-tab" />
      </div>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-6 sm:px-6 lg:py-8">

        {/* Events tab */}
        {activeTab === 'events' && (
          <div role="tabpanel" aria-labelledby="league-tab-events">
            {events.length === 0 ? (
              <p className="text-ink-muted">No events yet for this league.</p>
            ) : (
              <>
                {upcoming.length > 0 && (
                  <section className="mb-10">
                    <h2 className="mb-4 text-lg font-bold text-ink">Upcoming Events</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {upcoming.map(ev => <EventCard key={ev.id} event={ev} leagueSlug={leagueSlug} orgSlug={eventLinkOrgSlug} />)}
                    </div>
                  </section>
                )}
                {past.length > 0 && (
                  <section>
                    <h2 className="mb-4 text-lg font-bold text-ink">Past Results</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {past.map(ev => <EventCard key={ev.id} event={ev} leagueSlug={leagueSlug} orgSlug={eventLinkOrgSlug} muted />)}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* Season standings tab */}
        {activeTab === 'standings' && (
          <div role="tabpanel" aria-labelledby="league-tab-standings" className="flex flex-col gap-6">
            {standingsLoading ? (
              <div className="flex items-center justify-center py-16" role="status" aria-label="Loading standings">
                <svg className="h-7 w-7 animate-spin" style={{ color: GREEN }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : (
              <>
                <LeaderTiles tiles={tiles} />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start">
                  <div className="flex min-w-0 flex-col gap-6">
                    {overallFlights.length > 0 && <OverallWinnersCard flights={overallFlights} hrefs={eventHrefs} />}
                    {teamView && <TeamStandingsCard view={teamView} events={teamEvents} />}
                    {hasSideStats && (
                      <SideLeadersCard rows={sideRows(sideGameStats)} events={past} hrefs={eventHrefs} subtitle={sideGameSubtitle(cfg, { skins: hasSkins, ctp: hasCTP, ld: hasLD, lp: hasLP })} hasSkins={hasSkins} hasCTP={hasCTP} hasLD={hasLD} hasLP={hasLP} />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col gap-6">
                    {standings.length === 0 ? (
                      <div className="rounded-sm border border-surface-border bg-white p-10 text-center">
                        <p className="font-medium text-ink-muted">No earnings data yet</p>
                        <p className="mt-1 text-sm text-ink-muted">Standings are calculated from completed events with payout configurations.</p>
                      </div>
                    ) : (
                      <MoneyListCard rows={moneyRows(standings)} events={past} hrefs={eventHrefs} subtitle={moneyListSubtitle(cfg)} />
                    )}
                    {resultItems.length > 0 && <ResultsByEventCard items={resultItems} onAllEvents={() => goTab('events')} />}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {/* Player scoring tab */}
        {activeTab === 'scoring' && (
          <div role="tabpanel" aria-labelledby="league-tab-scoring">
            {standingsLoading ? (
              <div className="flex items-center justify-center py-16" role="status" aria-label="Loading scoring">
                <svg className="h-7 w-7 animate-spin" style={{ color: GREEN }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : scoringRows.length === 0 ? (
              <div className="rounded-sm border border-surface-border bg-white p-10 text-center">
                <p className="font-medium text-ink-muted">No completed rounds yet</p>
                <p className="mt-1 text-sm text-ink-muted">Scores appear here after an event is complete.</p>
              </div>
            ) : (
              <PlayerScoringCard rows={scoringRows} />
            )}
          </div>
        )}
        {/* Rules & bylaws tab */}
        {activeTab === 'rules' && (
          <div role="tabpanel" aria-labelledby="league-tab-rules">
            {bylaws ? (
              <BylawsCard leagueName={league?.name} text={bylaws.body} updatedAt={bylaws.updated_at} />
            ) : (
              <div className="rounded-sm border border-surface-border bg-white p-10 text-center">
                <p className="font-medium text-ink-muted">No rules posted yet</p>
                <p className="mt-1 text-sm text-ink-muted">Check back later or ask your league administrator.</p>
              </div>
            )}
          </div>
        )}
        {/* Insights tab */}
        {activeTab === 'insights' && (
          <div role="tabpanel" aria-labelledby="league-tab-insights">
            {standingsLoading ? (
              <div className="flex items-center justify-center py-16" role="status" aria-label="Loading insights">
                <svg className="h-7 w-7 animate-spin" style={{ color: GREEN }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : insightCards.length === 0 ? (
              <div className="rounded-sm border border-surface-border bg-white p-10 text-center">
                <p className="font-medium text-ink-muted">No completed rounds yet</p>
                <p className="mt-1 text-sm text-ink-muted">Insights appear here after an event is complete.</p>
              </div>
            ) : (
              <InsightsGrid cards={insightCards} />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-surface-border bg-white py-5 text-center text-sm text-ink-muted">
        Powered by{' '}
        <a href="https://www.scorifygolf.com" target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center font-semibold text-fairway-700 hover:underline">Scorify Golf</a>
      </footer>
    </div>
  )
}

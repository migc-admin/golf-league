import { useEffect, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import LeagueLayout from '../../components/LeagueLayout'
import { computeLeaderboards } from '../../lib/engines/scoring'
import { computeAllSkins } from '../../lib/engines/skins'
import { computePayouts } from '../../lib/engines/payouts'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'

const DEFAULT_STANDINGS_CONFIG = {
  include_scoring:    true,
  include_skins:      true,
  include_ctp:        true,
  include_long_drive: true,
  include_low_putts:  false,
}

function StatusBadge({ status }) {
  const styles = {
    upcoming: 'bg-blue-100 text-blue-700',
    active:   'bg-green-100 text-green-700',
    complete: 'bg-gray-100 text-gray-500',
  }
  const labels = { upcoming: 'Upcoming', active: 'Active', complete: 'Complete' }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
      {labels[status] || status}
    </span>
  )
}

function EventCard({ event, leagueSlug, muted = false }) {
  const title  = event.name || `Event #${event.event_number}`
  const date   = event.event_date
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
      {date   && <p className="text-sm text-gray-500">{date}</p>}
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

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border rounded-xl p-4 flex flex-col gap-1 shadow-sm">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</div>
      <div className="text-lg font-bold text-ink leading-tight">{value ?? '—'}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  )
}

export default function LeagueHome({ orgSlug, leagueSlug, initialTab = 'events' }) {
  const [league,         setLeague]         = useState(null)
  const [org,            setOrg]            = useState(null)
  const [leagues,        setLeagues]        = useState([])
  const [events,         setEvents]         = useState([])
  const [activeTab,      setActiveTab]      = useState(initialTab)
  const [standings,      setStandings]      = useState([])
  const [sideGameStats,  setSideGameStats]  = useState([])   // [{ player, skinsWon, ctpWins, ldWins, lpWins, sideTotal }]
  const [standingsLoading, setStandingsLoading] = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)

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
    loadStandings()
  }, [activeTab, league])

  async function loadStandings() {
    setStandingsLoading(true)
    const cfg = { ...DEFAULT_STANDINGS_CONFIG, ...(league.standings_config ?? {}) }

    const { data: evs } = await supabase
      .from('events')
      .select('*, course:courses(*)')
      .eq('league_id', league.id)
      .eq('status', 'complete')
      .order('event_number')

    if (!evs?.length) { setStandingsLoading(false); return }

    const eventIds = evs.map(e => e.id)
    const [{ data: allEPs }, { data: allSideGames }] = await Promise.all([
      supabase.from('event_players').select('*, player:players(*)').in('event_id', eventIds),
      supabase.from('side_games').select('*, winner:players(first_name,last_name)').in('event_id', eventIds),
    ])
    // Fetch scores per-event to avoid Supabase's 1000-row server limit
    const scoresByEvent = {}
    await Promise.all(evs.map(async ev => {
      const { data } = await supabase.from('scores').select('*').eq('event_id', ev.id)
      scoresByEvent[ev.id] = data ?? []
    }))

    const playerEarnings  = {}   // playerId → { player, totalEarnings, eventsPlayed, byEvent, itemsByEvent }
    const sideGameTotals  = {}   // playerId → { player, skinsWon, skinsTotal, ctpWins, ctpTotal, ldWins, ldTotal, lpWins, lpTotal }

    for (const ev of evs) {
      const course    = ev.course
      if (!course) continue
      const eps       = (allEPs       ?? []).filter(ep => ep.event_id === ev.id)
      const scores    = scoresByEvent[ev.id] ?? []
      const sideGames = (allSideGames ?? []).filter(sg => sg.event_id === ev.id)
      if (!eps.length) continue

      const nonGuest     = eps.filter(ep => !ep.is_guest && ep.player?.intended_role !== 'guest')
      const flightCounts = {
        A: nonGuest.filter(ep => ep.flight === 'A').length,
        B: nonGuest.filter(ep => ep.flight === 'B').length,
      }

      try {
        const leaderboards = computeLeaderboards(nonGuest, scores, course)
        const skinsResults = computeAllSkins(nonGuest, scores, course)
        const { byPlayer } = computePayouts(ev, nonGuest.length, leaderboards, sideGames, skinsResults, flightCounts)

        for (const { playerId, items } of byPlayer) {
          const ep = eps.find(e => e.player_id === playerId)
          const player = ep?.player ?? null

          // Categorize each item
          const scoringItems   = (items ?? []).filter(item => !item.category.startsWith('Skins') && !item.category.startsWith('Closest') && !item.category.startsWith('Long Drive') && !item.category.startsWith('Low Putts'))
          const skinsItems     = (items ?? []).filter(item => item.category.startsWith('Skins'))
          const ctpItems       = (items ?? []).filter(item => item.category.startsWith('Closest'))
          const ldItems        = (items ?? []).filter(item => item.category.startsWith('Long Drive'))
          const lpItems        = (items ?? []).filter(item => item.category.startsWith('Low Putts'))

          // Build included items based on config
          const includedItems = [
            ...(cfg.include_scoring    ? scoringItems : []),
            ...(cfg.include_skins      ? skinsItems   : []),
            ...(cfg.include_ctp        ? ctpItems     : []),
            ...(cfg.include_long_drive ? ldItems      : []),
            ...(cfg.include_low_putts  ? lpItems      : []),
          ]

          const includedTotal = includedItems.reduce((sum, item) => sum + item.amount, 0)

          if (includedTotal > 0) {
            if (!playerEarnings[playerId]) {
              playerEarnings[playerId] = { player, totalEarnings: 0, eventsPlayed: 0, byEvent: {}, itemsByEvent: {} }
            }
            playerEarnings[playerId].totalEarnings      += includedTotal
            playerEarnings[playerId].eventsPlayed       += 1
            playerEarnings[playerId].byEvent[ev.id]      = includedTotal
            playerEarnings[playerId].itemsByEvent[ev.id] = includedItems
          }

          // Side game stats — always tallied regardless of config (for the side game leaderboard)
          if (skinsItems.length || ctpItems.length || ldItems.length || lpItems.length) {
            if (!sideGameTotals[playerId]) {
              sideGameTotals[playerId] = { player, skinsWon: 0, skinsTotal: 0, ctpWins: 0, ctpTotal: 0, ldWins: 0, ldTotal: 0, lpWins: 0, lpTotal: 0 }
            }
            // Skins: parse hole count from label e.g. "(2 skins)"
            for (const item of skinsItems) {
              const m = item.category.match(/\((\d+) skin/)
              sideGameTotals[playerId].skinsWon   += m ? parseInt(m[1]) : 1
              sideGameTotals[playerId].skinsTotal += item.amount
            }
            sideGameTotals[playerId].ctpWins   += ctpItems.length
            sideGameTotals[playerId].ctpTotal  += ctpItems.reduce((s, i) => s + i.amount, 0)
            sideGameTotals[playerId].ldWins    += ldItems.length
            sideGameTotals[playerId].ldTotal   += ldItems.reduce((s, i) => s + i.amount, 0)
            sideGameTotals[playerId].lpWins    += lpItems.length
            sideGameTotals[playerId].lpTotal   += lpItems.reduce((s, i) => s + i.amount, 0)
          }
        }
      } catch (err) { console.error('[Standings] error for event', ev.name, err) }
    }

    const sorted = Object.values(playerEarnings).sort((a, b) => b.totalEarnings - a.totalEarnings)
    setStandings(sorted)

    const sideList = Object.values(sideGameTotals)
      .filter(s => s.skinsWon > 0 || s.ctpWins > 0 || s.ldWins > 0 || s.lpWins > 0)
      .sort((a, b) => (b.skinsWon + b.ctpWins + b.ldWins + b.lpWins) - (a.skinsWon + a.ctpWins + a.ldWins + a.lpWins))
    setSideGameStats(sideList)
    setStandingsLoading(false)
  }

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
  const cfg            = { ...DEFAULT_STANDINGS_CONFIG, ...(league.standings_config ?? {}) }
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
                    {upcoming.map(ev => <EventCard key={ev.id} event={ev} leagueSlug={leagueSlug} />)}
                  </div>
                </section>
              )}
              {past.length > 0 && (
                <section>
                  <h2 className="text-lg font-bold text-gray-700 mb-4">Past Results</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {past.map(ev => <EventCard key={ev.id} event={ev} leagueSlug={leagueSlug} muted />)}
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
                {past.map(ev => <EventCard key={ev.id} event={ev} leagueSlug={leagueSlug} muted />)}
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

// ─── Money List ───────────────────────────────────────────────────────────────
function MoneyList({ standings, events }) {
  const [expanded, setExpanded] = useState(null)
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest" style={{ background: '#f4f3f0', borderBottom: '1px solid #ebe9e4' }}>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Player</th>
            <th className="px-4 py-3 text-center">Events</th>
            <th className="px-4 py-3 text-right">Earnings</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const pid        = s.player?.id ?? i
            const isExpanded = expanded === pid
            return (
              <Fragment key={pid}>
                <tr
                  onClick={() => setExpanded(isExpanded ? null : pid)}
                  className="cursor-pointer transition-colors"
                  style={{
                    borderBottom: isExpanded ? 'none' : '1px solid #ebe9e4',
                    background: isExpanded ? '#f4f3f0' : i % 2 === 1 ? 'rgba(27,67,50,0.025)' : '#ffffff',
                  }}
                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#f9f8f6' }}
                  onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = i % 2 === 1 ? 'rgba(27,67,50,0.025)' : '#ffffff' }}
                >
                  <td className="px-4 py-3 text-base">{medals[i] ?? i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-ink">
                    <span className="flex items-center gap-1.5">
                      {s.player?.last_name}, {s.player?.first_name}
                      <svg className="w-3 h-3 text-gray-400 transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : '' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">{s.eventsPlayed}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: GREEN }}>${s.totalEarnings.toFixed(2)}</td>
                </tr>
                {isExpanded && (
                  <tr style={{ borderBottom: '1px solid #ebe9e4' }}>
                    <td colSpan={4} className="px-5 pb-4 pt-2" style={{ background: '#f9f8f6' }}>
                      <div className="space-y-3">
                        {events
                          .filter(ev => s.itemsByEvent?.[ev.id]?.length)
                          .map(ev => (
                            <div key={ev.id}>
                              <p className="text-xs font-semibold text-gray-400 mb-1">
                                Event #{ev.event_number}{ev.name ? ` — ${ev.name}` : ''}
                                {ev.event_date ? ` · ${new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                              </p>
                              <div className="space-y-0.5">
                                {s.itemsByEvent[ev.id].map((item, j) => (
                                  <div key={j} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-400">{item.category}</span>
                                    <span className="font-medium text-ink">${item.amount.toFixed(2)}</span>
                                  </div>
                                ))}
                                <div className="flex items-center justify-between text-xs font-semibold text-ink border-t pt-0.5 mt-0.5" style={{ borderColor: '#ebe9e4' }}>
                                  <span>Event total</span>
                                  <span>${s.byEvent[ev.id].toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Side Game Table ──────────────────────────────────────────────────────────
function SideGameTable({ stats, hasSkins, hasCTP, hasLD }) {
  return (
    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest" style={{ background: '#f4f3f0', borderBottom: '1px solid #ebe9e4' }}>
            <th className="px-4 py-3">Player</th>
            {hasSkins && <th className="px-4 py-3 text-center">Skins Won</th>}
            {hasCTP   && <th className="px-4 py-3 text-center">CTP Wins</th>}
            {hasLD    && <th className="px-4 py-3 text-center">Long Drive</th>}
            <th className="px-4 py-3 text-right">Side $ Total</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => {
            const sideTotal = s.skinsTotal + s.ctpTotal + s.ldTotal + s.lpTotal
            return (
              <tr key={s.player?.id ?? i} style={{ borderBottom: '1px solid #ebe9e4', background: i % 2 === 1 ? 'rgba(27,67,50,0.025)' : '#ffffff' }}>
                <td className="px-4 py-3 font-semibold text-ink">{s.player?.last_name}, {s.player?.first_name}</td>
                {hasSkins && <td className="px-4 py-3 text-center text-ink-muted">{s.skinsWon || '—'}</td>}
                {hasCTP   && <td className="px-4 py-3 text-center text-ink-muted">{s.ctpWins  || '—'}</td>}
                {hasLD    && <td className="px-4 py-3 text-center text-ink-muted">{s.ldWins   || '—'}</td>}
                <td className="px-4 py-3 text-right font-bold" style={{ color: GREEN }}>{sideTotal > 0 ? `$${sideTotal.toFixed(2)}` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

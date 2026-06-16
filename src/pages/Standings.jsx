/**
 * Season Standings
 * Cumulative earnings per player per category across all events in the league.
 * Skins excluded per spec.
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Card, { CardHeader } from '../components/ui/Card'
import { FlightBadge } from '../components/ui/Badge'

export default function Standings() {
  const { leagueId } = useParams()
  const [league,    setLeague]    = useState(null)
  const [standings, setStandings] = useState([])
  const [categories, setCategories] = useState([])
  const [events,    setEvents]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [view,      setView]      = useState('summary')  // 'summary' | 'breakdown'

  useEffect(() => {
    async function load() {
      const [
        { data: lg },
        { data: earnings },
        { data: evs },
      ] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).single(),
        supabase.from('season_earnings')
          .select('*, player:players(*)')
          .eq('league_id', leagueId)
          .not('category', 'ilike', 'skins%'),  // exclude skins per spec
        supabase.from('events')
          .select('id, event_number, event_date, status')
          .eq('league_id', leagueId)
          .eq('status', 'complete')
          .order('event_number'),
      ])

      setLeague(lg)
      setEvents(evs ?? [])

      // Build standings
      const playerMap   = {}  // playerId → { player, totalEarnings, eventCount, byCategory }
      const catSet      = new Set()

      for (const e of (earnings ?? [])) {
        const pid = e.player_id
        if (!playerMap[pid]) {
          playerMap[pid] = {
            player:         e.player,
            totalEarnings:  0,
            eventIds:       new Set(),
            byCategory:     {},
          }
        }
        playerMap[pid].totalEarnings += e.amount
        playerMap[pid].eventIds.add(e.event_id)
        playerMap[pid].byCategory[e.category] = (playerMap[pid].byCategory[e.category] ?? 0) + e.amount
        catSet.add(e.category)
      }

      const sorted = Object.values(playerMap)
        .map(p => ({ ...p, eventsPlayed: p.eventIds.size }))
        .sort((a, b) => b.totalEarnings - a.totalEarnings)

      setStandings(sorted)
      setCategories([...catSet].sort())
      setLoading(false)
    }
    load()
  }, [leagueId])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <svg className="animate-spin h-8 w-8 text-fairway-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-fairway-700 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/admin" className="text-fairway-300 text-xs hover:text-white">← Home</Link>
          <h1 className="text-xl font-bold mt-1">Season Standings</h1>
          <p className="text-fairway-200 text-sm">
            {league?.name} · {league?.season_year} · {events.length} event{events.length !== 1 ? 's' : ''} complete
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {/* View toggle */}
        <div className="flex gap-2">
          {['summary', 'breakdown'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                view === v ? 'bg-fairway-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {standings.length === 0 ? (
          <Card className="text-center py-12">
            <div className="text-4xl mb-3">🏆</div>
            <p className="text-gray-500 font-medium">No earnings recorded yet</p>
            <p className="text-sm text-gray-400 mt-1">Earnings are recorded when events are closed and payouts are calculated.</p>
          </Card>
        ) : view === 'summary' ? (
          <SummaryTable standings={standings} />
        ) : (
          <BreakdownTable standings={standings} categories={categories} />
        )}
      </div>
    </div>
  )
}

function SummaryTable({ standings }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 border-b">
            <th className="px-5 py-3">Rank</th>
            <th className="px-4 py-3">Player</th>
            <th className="px-4 py-3 text-center">Events</th>
            <th className="px-4 py-3 text-right">Total Earnings</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {standings.map((s, i) => (
            <tr key={s.player?.id} className={i < 3 ? 'bg-yellow-50/50' : ''}>
              <td className="px-5 py-3 text-base">{medals[i] ?? `${i+1}`}</td>
              <td className="px-4 py-3 font-medium text-gray-900">
                {s.player?.last_name}, {s.player?.first_name}
              </td>
              <td className="px-4 py-3 text-center text-gray-500">{s.eventsPlayed}</td>
              <td className="px-4 py-3 text-right font-bold text-fairway-700">
                ${s.totalEarnings.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function BreakdownTable({ standings, categories }) {
  // Format category label
  function catLabel(cat) {
    const map = {
      '18_net_a_1st': '18H A 1st',  '18_net_a_2nd': '18H A 2nd', '18_net_a_3rd': '18H A 3rd',
      '18_net_b_1st': '18H B 1st',  '18_net_b_2nd': '18H B 2nd', '18_net_b_3rd': '18H B 3rd',
      'f9_a_1st': 'F9 A 1st',       'f9_a_2nd': 'F9 A 2nd',
      'f9_b_1st': 'F9 B 1st',       'f9_b_2nd': 'F9 B 2nd',
      'b9_a_1st': 'B9 A 1st',       'b9_a_2nd': 'B9 A 2nd',
      'b9_b_1st': 'B9 B 1st',       'b9_b_2nd': 'B9 B 2nd',
      'low_putts': 'Putts',          'long_drive': 'Drive',
    }
    if (cat.startsWith('ctp_')) return `CTP #${cat.replace('ctp_', '')}`
    return map[cat] ?? cat
  }

  return (
    <div className="overflow-x-auto">
      <Card className="overflow-hidden p-0 min-w-max">
        <table className="text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 border-b">
              <th className="px-5 py-3 sticky left-0 bg-gray-50 z-10">Player</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3 text-center">Evts</th>
              {categories.map(cat => (
                <th key={cat} className="px-3 py-3 text-right whitespace-nowrap">{catLabel(cat)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {standings.map((s, i) => (
              <tr key={s.player?.id} className={i % 2 === 0 ? '' : 'bg-gray-50/50'}>
                <td className="px-5 py-2.5 font-medium text-gray-900 sticky left-0 bg-white z-10 whitespace-nowrap">
                  {s.player?.last_name}, {s.player?.first_name}
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-fairway-700">
                  ${s.totalEarnings.toFixed(2)}
                </td>
                <td className="px-3 py-2.5 text-center text-gray-500">{s.eventsPlayed}</td>
                {categories.map(cat => (
                  <td key={cat} className="px-3 py-2.5 text-right text-gray-600">
                    {s.byCategory[cat] ? `$${s.byCategory[cat].toFixed(2)}` : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

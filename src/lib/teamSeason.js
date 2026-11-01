// Team Play standings for the public league page: one event at a time, or the whole season.
//
// Nothing here changes how team points are earned. Each event's points come from
// computeEventTglResults (the same calculation the Team Play page runs); the season is the sum of
// every completed event's team points. Pure functions — no React, no Supabase.

import { computeEventTglResults } from './engines/tglEvent'
import { standingsRows } from './teamPlayView'

const cents = n => Math.round(Number(n) * 100)

/** Competition ranking (11, 11, 9 -> 1, 1, 3) over rows already sorted by points. Zero points get no rank. */
function rankRows(rows) {
  let rank = 0
  return rows.map((r, i) => {
    if (i === 0 || cents(r.points) !== cents(rows[i - 1].points)) rank = i + 1
    return { ...r, rank: r.points > 0 ? rank : null }
  })
}

/**
 * @param events        completed events, each with its `course`
 * @param epsByEvent    event id -> event_players rows (with `player`)
 * @param scoresByEvent event id -> scores rows
 * @param tglTeams, tglMembers, tglSelections   the league's team tables
 * @returns { byEvent: { [eventId]: rows }, season: rows, scoredEventIds: string[] }
 *   rows = [{ team, rank, points, fraction, players: [{ id, name, points }] }] highest first
 *   Season rows also carry `events`: [{ eventId, name, date, rank, points, players }] oldest first, one per scored event.
 */
export function teamSeasonView({ events, epsByEvent, scoresByEvent, tglTeams, tglMembers, tglSelections }) {
  const byEvent = {}
  const totals = Object.fromEntries(tglTeams.map(t => [t.id, 0]))
  const scoredEventIds = []

  for (const ev of events) {
    const results = computeEventTglResults({
      eventPlayers: epsByEvent[ev.id] ?? [],
      allScores: scoresByEvent[ev.id] ?? [],
      course: ev.course,
      tglSelections: tglSelections.filter(s => s.event_id === ev.id),
      tglTeams,
      tglMembers,
    })
    if (!results) continue
    scoredEventIds.push(ev.id)
    byEvent[ev.id] = standingsRows({ eventResults: results, tglTeams })
    for (const tr of results.teamResults) totals[tr.team.id] += tr.teamPoints
  }

  const sorted = tglTeams
    .map(team => ({ team, points: scoredEventIds.length ? totals[team.id] : null, players: [] }))
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
  const leader = sorted[0]?.points ?? 0
  const season = scoredEventIds.length
    ? rankRows(sorted).map(r => ({ ...r, fraction: leader > 0 ? r.points / leader : 0 }))
    : sorted.map(r => ({ ...r, rank: null, fraction: 0 }))

  const dated = events.filter(ev => byEvent[ev.id]).sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))
  const withEvents = season.map(r => ({
    ...r,
    events: dated.map(ev => {
      const mine = byEvent[ev.id].find(x => x.team.id === r.team.id)
      return { eventId: ev.id, name: ev.name || `Event #${ev.event_number}`, date: ev.event_date ?? null, rank: mine?.points > 0 ? mine.rank : null, points: mine?.points ?? null, players: mine?.players ?? [] }
    }),
  }))

  return { byEvent, season: withEvents, scoredEventIds }
}

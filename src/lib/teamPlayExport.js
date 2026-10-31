/**
 * Team play results as plain data for the PNG. Uses the same engine the Team Play page does
 * (computeEventTglResults) and the same shared-rank / bar-fraction rules (standingsRows).
 */
import { computeEventTglResults } from './engines/tglEvent'
import { standingsRows } from './teamPlayView'
import { longDateText, shortDateText } from './resultsView'

export function teamPlayExportView({ event, eventPlayers, allScores, course, tglTeams, tglMembers, tglSelections }) {
  const results = computeEventTglResults({ eventPlayers, allScores, course, tglSelections, tglTeams, tglMembers })
  const rows = standingsRows({ eventResults: results, tglTeams })
  const byTeam = Object.fromEntries((results?.teamResults ?? []).map(t => [t.team.id, t]))
  const out = rows.map(r => ({
    rank: r.rank,
    team: { name: r.team.name, color: r.team.color || null },
    points: r.points,
    fraction: r.fraction,
    players: (byTeam[r.team.id]?.selectedPlayers ?? []).map(p => ({ name: p.name, rank: p.rank ?? null, points: p.points })),
  }))
  return {
    eventName: event.name ?? (event.event_number ? `Event #${event.event_number}` : 'Event'),
    courseName: course?.name ?? '',
    dateLong: longDateText(event.event_date),
    dateShort: shortDateText(event.event_date),
    scored: results != null,
    rows: out,
    playersEach: Math.max(0, ...out.map(r => r.players.length)),
  }
}
